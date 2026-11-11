import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";
import { nowPartsBR, startOfTodayBR } from "@/lib/financas/dates";
import { computeAccountBalances } from "@/lib/financas/balances";
import { runRecurringForHousehold } from "@/lib/financas/recurring";

type Owner = "PARTNER_A" | "PARTNER_B" | "COUPLE";

const ALL_OWNERS: Owner[] = ["PARTNER_A", "PARTNER_B", "COUPLE"];

export async function GET(req: Request) {
  try {
    const household = await requireHousehold();
    const { searchParams } = new URL(req.url);

    // Painel aberto há dias (aba esquecida) também vira o mês: gera as
    // recorrências que faltam antes de montar os números. Quando não há nada
    // pra gerar é uma consulta só.
    try {
      await runRecurringForHousehold(household.id);
    } catch (err) {
      console.error("[recorrencias] geração automática falhou", err);
    }

    const monthParam = searchParams.get("month");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const cardGrouping = searchParams.get("cardGrouping") === "purchase_date"
      ? "purchase_date"
      : "fatura_month";
    const ownerFilter = searchParams.get("owner");
    const ownerWhere: Owner[] =
      ownerFilter && ALL_OWNERS.includes(ownerFilter as Owner)
        ? [ownerFilter as Owner]
        : ALL_OWNERS;

    // "Agora" de Brasília, pra virada de mês/dia não acontecer às 21h.
    const todayParts = nowPartsBR();
    const today = startOfTodayBR();
    let year: number;
    let month: number;
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split("-").map(Number);
      year = y;
      month = m - 1;
    } else {
      year = todayParts.year;
      month = todayParts.month;
    }

    // from/to (YYYY-MM-DD) tem precedência sobre month quando presentes.
    // Suporta filtro de período customizado (ex: aba Casal com "Últimos 3
    // meses" ou range personalizado). Quando ausentes, mantém o comportamento
    // mês-a-mês legado (usado por outros consumidores como Dashboard).
    const dateRangeRE = /^\d{4}-\d{2}-\d{2}$/;
    const useCustomRange =
      !!fromParam && !!toParam && dateRangeRE.test(fromParam) && dateRangeRE.test(toParam);
    let start: Date;
    let end: Date;
    if (useCustomRange) {
      const [fy, fm, fd] = fromParam!.split("-").map(Number);
      const [ty, tm, td] = toParam!.split("-").map(Number);
      start = new Date(Date.UTC(fy, fm - 1, fd, 0, 0, 0, 0));
      // end é exclusivo — soma 1 dia pra incluir o dia final inteiro
      end = new Date(Date.UTC(ty, tm - 1, td + 1, 0, 0, 0, 0));
      // Pivot do monthlySeries no fim do range escolhido — senão um range
      // de 2025 mostraria 6 meses de 2026 (zerados) no gráfico de tendência.
      year = ty;
      month = tm - 1;
    } else {
      start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
      end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
    }
    // previous = range de mesmo tamanho imediatamente antes de start
    const rangeMs = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - rangeMs);
    const sixMonthsAgo = new Date(Date.UTC(year, month - 5, 1, 0, 0, 0, 0));
    const sevenDaysAgo = new Date(
      Date.UTC(todayParts.year, todayParts.month, todayParts.day - 6, 0, 0, 0, 0)
    );

    // Faturas dos cartões no mês selecionado e nos 2 seguintes (cartão
    // "Cartões" do painel). Não passa pelo filtro de dono: a fatura é do
    // cartão inteiro, não de quem fez cada compra.
    const invoiceWindow = [0, 1, 2].map((i) => {
      const d = new Date(Date.UTC(year, month + i, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });

    const [accounts, balances, allTx, last6Tx, windowInvoices] = await Promise.all([
      prisma.finAccount.findMany({
        where: { householdId: household.id, archived: false },
        orderBy: { createdAt: "asc" },
      }),
      computeAccountBalances(household.id),
      prisma.finTransaction.findMany({
        where: { householdId: household.id, owner: { in: ownerWhere } },
        include: {
          account: { select: { type: true } },
          category: { select: { id: true, name: true, color: true, icon: true } },
          invoice: { select: { dueDate: true } },
        },
      }),
      prisma.finTransaction.findMany({
        where: {
          householdId: household.id,
          owner: { in: ownerWhere },
          type: { in: ["INCOME", "EXPENSE"] },
        },
        include: {
          account: { select: { type: true } },
          invoice: { select: { dueDate: true } },
        },
      }),
      prisma.finCreditCardInvoice.findMany({
        where: { householdId: household.id, OR: invoiceWindow },
        select: {
          id: true,
          accountId: true,
          year: true,
          month: true,
          dueDate: true,
          closingDate: true,
          status: true,
        },
      }),
    ]);

    const invoiceSums = windowInvoices.length
      ? await prisma.finTransaction.groupBy({
          by: ["invoiceId"],
          where: {
            householdId: household.id,
            invoiceId: { in: windowInvoices.map((i) => i.id) },
          },
          _sum: { amount: true },
        })
      : [];
    const invoiceTotalById = new Map(invoiceSums.map((s) => [s.invoiceId, s._sum.amount ?? 0]));
    const cardInvoices = windowInvoices.map((inv) => {
      // Mesma regra de /api/invoices: o status gravado só distingue paga de
      // não paga; fechada/atrasada saem das datas.
      let status: "OPEN" | "CLOSED" | "PAID" | "OVERDUE" = inv.status;
      if (status !== "PAID") {
        if (inv.closingDate < today && status === "OPEN") status = "CLOSED";
        if (inv.dueDate < today) status = "OVERDUE";
      }
      return {
        id: inv.id,
        accountId: inv.accountId,
        year: inv.year,
        month: inv.month,
        dueDate: inv.dueDate,
        status,
        total: invoiceTotalById.get(inv.id) ?? 0,
      };
    });

    function effectiveDate(tx: {
      date: Date;
      account: { type: string };
      invoice: { dueDate: Date } | null;
    }): Date {
      if (
        cardGrouping === "fatura_month" &&
        tx.account.type === "CREDIT_CARD" &&
        tx.invoice
      ) {
        return new Date(tx.invoice.dueDate);
      }
      return new Date(tx.date);
    }

    const inPeriod = allTx.filter((t) => {
      const d = effectiveDate(t);
      return d >= start && d < end;
    });

    let prevIncome = 0;
    let prevExpense = 0;
    for (const t of allTx) {
      const d = effectiveDate(t);
      if (d >= prevStart && d < start) {
        if (t.type === "INCOME") prevIncome += t.amount;
        else if (t.type === "EXPENSE") prevExpense += t.amount;
      }
    }

    const dailyMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(sevenDaysAgo);
      d.setUTCDate(d.getUTCDate() + (6 - i));
      const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      dailyMap[k] = 0;
    }
    for (const t of allTx) {
      if (t.type !== "EXPENSE") continue;
      const d = effectiveDate(t);
      if (d < sevenDaysAgo) continue;
      const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      if (k in dailyMap) dailyMap[k] += t.amount;
    }
    const dailyExpense = Object.entries(dailyMap).map(([day, amount]) => ({ day, amount }));

    const balanceMap = new Map(balances.map((b) => [b.accountId, b.balance]));
    const totalBalance = accounts.reduce(
      (acc, a) => acc + (balanceMap.get(a.id) ?? a.initialBalance),
      0
    );

    let totalIncome = 0;
    let totalExpense = 0;
    const ownerSummary: Record<string, { income: number; expense: number }> = {
      PARTNER_A: { income: 0, expense: 0 },
      PARTNER_B: { income: 0, expense: 0 },
      COUPLE: { income: 0, expense: 0 },
    };
    const catBuckets = new Map<
      string,
      { id: string | null; name: string; color: string; icon: string | null; amount: number }
    >();

    for (const t of inPeriod) {
      if (t.type === "INCOME") {
        totalIncome += t.amount;
        ownerSummary[t.owner].income += t.amount;
      } else if (t.type === "EXPENSE") {
        totalExpense += t.amount;
        ownerSummary[t.owner].expense += t.amount;

        const catId = t.categoryId ?? "__none__";
        const existing = catBuckets.get(catId);
        if (existing) {
          existing.amount += t.amount;
        } else {
          catBuckets.set(catId, {
            id: t.categoryId,
            name: t.category?.name ?? "Sem categoria",
            color: t.category?.color ?? "#a3a3a3",
            icon: t.category?.icon ?? null,
            amount: t.amount,
          });
        }
      }
    }

    const expensesByCategory = Array.from(catBuckets.values())
      .map((b) => ({
        categoryId: b.id,
        name: b.name,
        color: b.color,
        icon: b.icon,
        amount: b.amount,
      }))
      .sort((a, b) => b.amount - a.amount);

    const monthly: Record<string, { income: number; expense: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(year, month - i, 1));
      const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      monthly[k] = { income: 0, expense: 0 };
    }
    for (const t of last6Tx) {
      const d = effectiveDate(t);
      if (d < sixMonthsAgo || d >= end) continue;
      const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      if (!monthly[k]) continue;
      if (t.type === "INCOME") monthly[k].income += t.amount;
      else if (t.type === "EXPENSE") monthly[k].expense += t.amount;
    }
    const monthlySeries = Object.entries(monthly).map(([k, v]) => ({ month: k, ...v }));

    return NextResponse.json({
      household: {
        id: household.id,
        partnerAName: household.partnerAName,
        partnerBName: household.partnerBName,
        currency: household.currency,
        hideBalances: household.hideBalances,
      },
      period: {
        year,
        month: month + 1,
        label: start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      },
      totals: {
        balance: totalBalance,
        income: totalIncome,
        expense: totalExpense,
        net: totalIncome - totalExpense,
      },
      previous: {
        income: prevIncome,
        expense: prevExpense,
        net: prevIncome - prevExpense,
      },
      dailyExpense,
      accounts: accounts.map((a) => ({
        ...a,
        balance: balanceMap.get(a.id) ?? a.initialBalance,
      })),
      expensesByCategory,
      byOwner: ownerSummary,
      monthlySeries,
      cardInvoices,
      filters: { cardGrouping, owner: ownerFilter || "all" },
    });
  } catch (e) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    throw e;
  }
}
