import { prisma } from "@/lib/prisma";
import { installmentGroupId, parseInstallment } from "./installments";
import { merchantKey } from "./merchant-hints";
import type { MerchantHint, ParsedRow } from "./parse-invoice";

export type Inherited = {
  source: "installment" | "history";
  label: string;
};

export type EnrichedRow = ParsedRow & { inherited?: Inherited | null };

// Pré-classifica as linhas que a IA devolveu usando o que o casal já fez,
// em ordem de força:
//   1. mesma compra — parcela anterior do mesmo parcelamento (nome-base +
//      total + valor + cartão, o mesmo installmentGroupId que o commit usa
//      pra deduplicar). Dono e categoria vêm dela.
//   2. mesmo estabelecimento — histórico de 12 meses (merchant-hints), com
//      o sufixo de parcela removido da chave.
//   3. nada disso → fica o palpite da IA.
// paidByOwner NÃO é herdado de propósito: ele é preenchido no pagamento da
// fatura e é o que faz a compra entrar no acerto do casal.
export async function applyHistoryToRows(
  householdId: string,
  accountId: string,
  rows: ParsedRow[],
  hints: MerchantHint[]
): Promise<EnrichedRow[]> {
  const groupByRow = new Map<number, string>();
  rows.forEach((row, i) => {
    const parc = parseInstallment(row.description);
    if (!parc) return;
    groupByRow.set(
      i,
      installmentGroupId(accountId, parc.baseDescription, parc.total, Math.round(row.amount * 100))
    );
  });

  const groupIds = Array.from(new Set(groupByRow.values()));
  const previous = groupIds.length
    ? await prisma.finTransaction.findMany({
        where: { householdId, installmentGroupId: { in: groupIds } },
        // Projetadas por último: a parcela real importada/editada é o sinal
        // forte; a projeção só serve se for tudo que existe.
        orderBy: [{ installmentProjected: "asc" }, { installmentIndex: "desc" }],
        select: {
          installmentGroupId: true,
          installmentIndex: true,
          owner: true,
          categoryId: true,
        },
      })
    : [];

  const bestByGroup = new Map<string, (typeof previous)[number]>();
  for (const t of previous) {
    if (!t.installmentGroupId || bestByGroup.has(t.installmentGroupId)) continue;
    bestByGroup.set(t.installmentGroupId, t);
  }

  const hintByKey = new Map(hints.map((h) => [h.pattern, h]));

  return rows.map((row, i): EnrichedRow => {
    const gid = groupByRow.get(i);
    const prev = gid ? bestByGroup.get(gid) : undefined;
    if (prev) {
      const parc = parseInstallment(row.description)!;
      const sameIndex = prev.installmentIndex === parc.index;
      return {
        ...row,
        owner: prev.owner as ParsedRow["owner"],
        categoryId: prev.categoryId ?? row.categoryId,
        inherited: {
          source: "installment",
          label: sameIndex
            ? `parcela ${parc.index}/${parc.total} já no sistema`
            : `herdado da parcela ${prev.installmentIndex}/${parc.total}`,
        },
      };
    }

    const key = merchantKey(row.description);
    const hint = key ? hintByKey.get(key) : undefined;
    if (hint) {
      return {
        ...row,
        owner: hint.owner,
        categoryId: hint.categoryId ?? row.categoryId,
        inherited: { source: "history", label: `histórico (${hint.occurrences}×)` },
      };
    }

    return row;
  });
}
