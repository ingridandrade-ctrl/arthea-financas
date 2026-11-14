import { prisma } from "@/lib/prisma";
import { ensureInvoice } from "./credit-cards";
import { endOfTodayBR, nowPartsBR } from "./dates";
import { ensureFinanceSchemaUpToDate } from "./migrate";

type RecurringRule = {
  id: string;
  householdId: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  description: string;
  notes: string | null;
  owner: "PARTNER_A" | "PARTNER_B" | "COUPLE";
  paidByOwner: "PARTNER_A" | "PARTNER_B" | "COUPLE" | null;
  splitRatio: number | null;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  frequency: "WEEKLY" | "MONTHLY" | "YEARLY";
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  monthOfYear: number | null;
  startDate: Date;
  endDate: Date | null;
  lastGeneratedAt: Date | null;
  active: boolean;
};

function clampDay(year: number, month: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(Math.max(day, 1), lastDay), 12, 0, 0, 0));
}

function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12, 0, 0, 0));
}

function addMonthsUTC(d: Date, months: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1, 12, 0, 0, 0));
}

function addDaysUTC(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

export function nextOccurrencesUntil(rule: RecurringRule, until: Date): Date[] {
  if (!rule.active) return [];
  const limit = rule.endDate && rule.endDate < until ? rule.endDate : until;
  const start = rule.lastGeneratedAt
    ? new Date(rule.lastGeneratedAt.getTime() + 1)
    : rule.startDate;

  const occurrences: Date[] = [];

  if (rule.frequency === "MONTHLY") {
    const day = rule.dayOfMonth ?? rule.startDate.getUTCDate();
    let cursor = startOfMonthUTC(start);
    const ruleMonthStart = startOfMonthUTC(rule.startDate);
    if (cursor < ruleMonthStart) cursor = ruleMonthStart;
    while (cursor <= limit) {
      const candidate = clampDay(cursor.getUTCFullYear(), cursor.getUTCMonth(), day);
      if (candidate >= rule.startDate && candidate >= start && candidate <= limit) {
        occurrences.push(candidate);
      }
      cursor = addMonthsUTC(cursor, 1);
    }
  } else if (rule.frequency === "WEEKLY") {
    const dow = rule.dayOfWeek ?? rule.startDate.getUTCDay();
    let cursor = clampDay(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    while (cursor <= limit) {
      if (cursor.getUTCDay() === dow && cursor >= rule.startDate && cursor >= start) {
        occurrences.push(cursor);
      }
      cursor = addDaysUTC(cursor, 1);
    }
  } else if (rule.frequency === "YEARLY") {
    const month = (rule.monthOfYear ?? rule.startDate.getUTCMonth() + 1) - 1;
    const day = rule.dayOfMonth ?? rule.startDate.getUTCDate();
    let year = start.getUTCFullYear();
    while (true) {
      const candidate = clampDay(year, month, day);
      if (candidate > limit) break;
      if (candidate >= rule.startDate && candidate >= start) {
        occurrences.push(candidate);
      }
      year += 1;
    }
  }

  return occurrences;
}

type PaidByFields = {
  type: string;
  owner: string;
  paidByOwner: string | null;
  splitRatio: number | null;
};

/** Só despesa tem "quem pagou", e só pode ser uma das duas pessoas. */
export function paidByFromRule(rule: PaidByFields): "PARTNER_A" | "PARTNER_B" | null {
  if (rule.type !== "EXPENSE") return null;
  return rule.paidByOwner === "PARTNER_A" || rule.paidByOwner === "PARTNER_B"
    ? rule.paidByOwner
    : null;
}

/** Divisão diferente de meio a meio só faz sentido em despesa do casal com pagador. */
export function splitFromRule(rule: PaidByFields): number | null {
  if (!paidByFromRule(rule) || rule.owner !== "COUPLE") return null;
  return typeof rule.splitRatio === "number" ? Math.min(Math.max(rule.splitRatio, 0), 1) : null;
}

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Gera os lançamentos das recorrências ativas. Roda sozinho quando alguém abre
 * o sistema (layout logado e painel) e no botão "Gerar agora".
 *
 * Regras:
 * - Conta a pagar (despesa fora do cartão) nasce PENDENTE e já é criada pro
 *   mês inteiro, pra aparecer em "Contas a pagar" antes do vencimento. Quem
 *   paga marca como paga.
 * - Receita, transferência e compra no cartão continuam como antes: só até
 *   hoje, já efetivadas (a compra no cartão entra na fatura dela).
 * - Meses anteriores ao atual NÃO são preenchidos automaticamente — abrir o
 *   sistema não pode mudar o total de um mês que já passou. A exceção é a
 *   regra recém-criada (`backfillRuleId`): se a pessoa escolheu uma data de
 *   início no passado, o histórico entra como já pago, como sempre foi.
 * - Se já existe um lançamento manual igual no mesmo mês (mesma conta, valor
 *   e descrição), ele é adotado pela regra em vez de duplicar.
 */
export async function runRecurringForHousehold(
  householdId: string,
  opts: { backfillRuleId?: string } = {}
) {
  // Roda antes de qualquer tela; garante que o banco já tem as colunas novas.
  await ensureFinanceSchemaUpToDate();
  const rules = await prisma.finRecurringRule.findMany({
    where: { householdId, active: true },
    include: {
      account: { select: { id: true, type: true, closingDay: true, dueDay: true } },
    },
  });

  const { year, month } = nowPartsBR();
  const monthStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  const todayEnd = endOfTodayBR();

  let created = 0;
  for (const rule of rules) {
    const isCard = rule.account.type === "CREDIT_CARD";
    const isBill = rule.type === "EXPENSE" && !isCard;
    const occs = nextOccurrencesUntil(rule as any, isBill ? monthEnd : todayEnd);
    if (occs.length === 0) continue;

    for (const date of occs) {
      const beforeThisMonth = date < monthStart;
      if (beforeThisMonth && rule.id !== opts.backfillRuleId) continue;
      const pending = isBill && !beforeThisMonth;

      const result = await prisma.$transaction(async (tx) => {
        // Uma regra por vez: duas pessoas da casa abrindo o sistema no mesmo
        // segundo não podem criar a mesma conta duas vezes.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${rule.id}))`;

        const dupeExists = await tx.finTransaction.findFirst({
          where: { householdId, recurringId: rule.id, date },
          select: { id: true },
        });
        if (dupeExists) return false;

        if (rule.frequency !== "WEEKLY") {
          const sameMonthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
          const nextMonthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
          const candidates = await tx.finTransaction.findMany({
            where: {
              householdId,
              recurringId: null,
              type: rule.type,
              accountId: rule.accountId,
              amount: { gte: rule.amount - 0.005, lte: rule.amount + 0.005 },
              date: { gte: sameMonthStart, lt: nextMonthStart },
            },
            select: { id: true, description: true },
          });
          const twin = candidates.find(
            (c) => normalizeText(c.description) === normalizeText(rule.description)
          );
          if (twin) {
            await tx.finTransaction.update({
              where: { id: twin.id },
              data: { recurringId: rule.id },
            });
            return false;
          }
        }

        let invoiceId: string | null = null;
        if (rule.type === "EXPENSE" && isCard) {
          const inv = await ensureInvoice(householdId, rule.account, date);
          invoiceId = inv?.id ?? null;
        }
        await tx.finTransaction.create({
          data: {
            householdId,
            type: rule.type,
            amount: rule.amount,
            date,
            description: rule.description,
            notes: rule.notes,
            owner: rule.owner,
            // "Quem paga" da regra. Em conta pendente fica só anotado: ela
            // entra no acerto do casal quando for marcada como paga.
            paidByOwner: paidByFromRule(rule),
            splitRatio: splitFromRule(rule),
            accountId: rule.accountId,
            toAccountId: rule.type === "TRANSFER" ? rule.toAccountId : null,
            categoryId: rule.type === "TRANSFER" ? null : rule.categoryId,
            recurringId: rule.id,
            invoiceId,
            paid: !pending,
            paidAt: pending ? null : date,
          },
        });
        return true;
      });
      if (result) created += 1;
    }

    const last = occs[occs.length - 1];
    await prisma.finRecurringRule.update({
      where: { id: rule.id },
      data: { lastGeneratedAt: last },
    });
  }

  return { created };
}
