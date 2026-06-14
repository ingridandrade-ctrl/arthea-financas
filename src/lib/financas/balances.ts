import { prisma } from "@/lib/prisma";

export type AccountBalance = {
  accountId: string;
  balance: number;
};

export async function computeAccountBalances(householdId: string): Promise<AccountBalance[]> {
  const [accounts, sums] = await Promise.all([
    prisma.finAccount.findMany({
      where: { householdId, archived: false },
      select: { id: true, initialBalance: true },
    }),
    prisma.finTransaction.groupBy({
      by: ["accountId", "type"],
      where: { householdId },
      _sum: { amount: true },
    }),
  ]);

  const transfersIn = await prisma.finTransaction.groupBy({
    by: ["toAccountId"],
    where: { householdId, type: "TRANSFER", toAccountId: { not: null } },
    _sum: { amount: true },
  });

  const balanceById = new Map<string, number>();
  for (const a of accounts) balanceById.set(a.id, a.initialBalance);

  for (const row of sums) {
    const current = balanceById.get(row.accountId) ?? 0;
    const amt = row._sum.amount ?? 0;
    if (row.type === "INCOME") balanceById.set(row.accountId, current + amt);
    else if (row.type === "EXPENSE") balanceById.set(row.accountId, current - amt);
    else if (row.type === "TRANSFER") balanceById.set(row.accountId, current - amt);
  }

  for (const row of transfersIn) {
    if (!row.toAccountId) continue;
    const current = balanceById.get(row.toAccountId) ?? 0;
    balanceById.set(row.toAccountId, current + (row._sum.amount ?? 0));
  }

  return Array.from(balanceById.entries()).map(([accountId, balance]) => ({
    accountId,
    balance,
  }));
}
