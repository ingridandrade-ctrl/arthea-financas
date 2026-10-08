import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";

export async function GET(req: Request) {
  try {
    const household = await requireHousehold();
    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get("year");
    const year = yearParam && /^\d{4}$/.test(yearParam) ? parseInt(yearParam, 10) : new Date().getUTCFullYear();
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));

    // Compra de cartão conta no mês da FATURA (dueDate), não no da compra —
    // mesma regra do Dashboard. Senão a parcela comprada em maio e cobrada
    // em setembro aparecia em maio no relatório anual.
    const yearRange = { gte: start, lt: end };
    const [allYearTx, accounts, allTimeForAccounts] = await Promise.all([
      prisma.finTransaction.findMany({
        where: {
          householdId: household.id,
          OR: [{ invoiceId: null, date: yearRange }, { invoice: { dueDate: yearRange } }],
        },
        select: {
          type: true,
          amount: true,
          date: true,
          categoryId: true,
          invoice: { select: { dueDate: true } },
        },
      }),
      prisma.finAccount.findMany({
        where: { householdId: household.id, archived: false },
        select: { id: true, name: true, color: true, type: true, initialBalance: true },
      }),
      prisma.finTransaction.findMany({
        where: { householdId: household.id },
        select: {
          type: true,
          amount: true,
          date: true,
          accountId: true,
          toAccountId: true,
        },
      }),
    ]);

    const monthly: { month: number; income: number; expense: number; net: number }[] = [];
    for (let m = 0; m < 12; m++) {
      monthly.push({ month: m + 1, income: 0, expense: 0, net: 0 });
    }
    let totalIncome = 0;
    let totalExpense = 0;
    for (const t of allYearTx) {
      const m = new Date(t.invoice?.dueDate ?? t.date).getUTCMonth();
      if (t.type === "INCOME") {
        monthly[m].income += t.amount;
        totalIncome += t.amount;
      } else if (t.type === "EXPENSE") {
        monthly[m].expense += t.amount;
        totalExpense += t.amount;
      }
    }
    for (const m of monthly) m.net = m.income - m.expense;

    const catTotals = new Map<string | null, number>();
    for (const t of allYearTx) {
      if (t.type !== "EXPENSE") continue;
      catTotals.set(t.categoryId, (catTotals.get(t.categoryId) ?? 0) + t.amount);
    }
    const byCategory = Array.from(catTotals, ([categoryId, amount]) => ({
      categoryId,
      _sum: { amount },
    }));

    const catIds = byCategory.map((c) => c.categoryId).filter((x): x is string => !!x);
    const cats = catIds.length
      ? await prisma.finCategory.findMany({
          where: { id: { in: catIds }, householdId: household.id },
        })
      : [];
    const catMap = new Map(cats.map((c) => [c.id, c]));
    const expensesByCategory = byCategory
      .map((row) => {
        const cat = row.categoryId ? catMap.get(row.categoryId) : null;
        return {
          categoryId: row.categoryId,
          name: cat?.name || "Sem categoria",
          color: cat?.color || "#a3a3a3",
          amount: row._sum.amount ?? 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    const accountEvolution: Record<string, number[]> = {};
    for (const acc of accounts) {
      accountEvolution[acc.id] = new Array(12).fill(acc.initialBalance);
    }
    for (const t of allTimeForAccounts) {
      const txDate = new Date(t.date);
      const isInYear = txDate >= start && txDate < end;
      const isBeforeYear = txDate < start;

      if (isBeforeYear) {
        for (const acc of accounts) {
          let delta = 0;
          if (t.accountId === acc.id) {
            if (t.type === "INCOME") delta = t.amount;
            else if (t.type === "EXPENSE") delta = -t.amount;
            else if (t.type === "TRANSFER") delta = -t.amount;
          }
          if (t.toAccountId === acc.id && t.type === "TRANSFER") {
            delta = t.amount;
          }
          for (let m = 0; m < 12; m++) accountEvolution[acc.id][m] += delta;
        }
      } else if (isInYear) {
        const m = txDate.getUTCMonth();
        for (const acc of accounts) {
          let delta = 0;
          if (t.accountId === acc.id) {
            if (t.type === "INCOME") delta = t.amount;
            else if (t.type === "EXPENSE") delta = -t.amount;
            else if (t.type === "TRANSFER") delta = -t.amount;
          }
          if (t.toAccountId === acc.id && t.type === "TRANSFER") {
            delta = t.amount;
          }
          for (let i = m; i < 12; i++) accountEvolution[acc.id][i] += delta;
        }
      }
    }

    const accountSeries = accounts.map((a) => ({
      accountId: a.id,
      name: a.name,
      color: a.color,
      values: accountEvolution[a.id],
    }));

    return NextResponse.json({
      year,
      monthly,
      totals: {
        income: totalIncome,
        expense: totalExpense,
        net: totalIncome - totalExpense,
        avgMonthlyExpense: totalExpense / 12,
        avgMonthlyIncome: totalIncome / 12,
      },
      expensesByCategory,
      accountSeries,
    });
  } catch (e) {
    if (e instanceof HouseholdAuthError) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    throw e;
  }
}
