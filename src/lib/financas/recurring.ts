import { prisma } from "@/lib/prisma";
import { ensureInvoice } from "./credit-cards";

type RecurringRule = {
  id: string;
  householdId: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  description: string;
  notes: string | null;
  owner: "PARTNER_A" | "PARTNER_B" | "COUPLE";
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

function endOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
}

export async function runRecurringForHousehold(householdId: string, until: Date = endOfTodayUTC()) {
  const rules = await prisma.finRecurringRule.findMany({
    where: { householdId, active: true },
    include: {
      account: { select: { id: true, type: true, closingDay: true, dueDay: true } },
    },
  });

  let created = 0;
  for (const rule of rules) {
    const occs = nextOccurrencesUntil(rule as any, until);
    if (occs.length === 0) continue;

    for (const date of occs) {
      // Wrap the dedupe check + create in a transaction so two concurrent
      // calls can't both insert the same (recurringId, date).
      const result = await prisma.$transaction(async (tx) => {
        const dupeExists = await tx.finTransaction.findFirst({
          where: { householdId, recurringId: rule.id, date },
          select: { id: true },
        });
        if (dupeExists) return false;
        let invoiceId: string | null = null;
        if (rule.type === "EXPENSE" && rule.account.type === "CREDIT_CARD") {
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
            accountId: rule.accountId,
            toAccountId: rule.type === "TRANSFER" ? rule.toAccountId : null,
            categoryId: rule.type === "TRANSFER" ? null : rule.categoryId,
            recurringId: rule.id,
            invoiceId,
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
