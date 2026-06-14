import { prisma } from "@/lib/prisma";

export type Contribution = {
  id: string;
  date: Date;
  description: string;
  totalAmount: number;
  contributionAmount: number;
  kind: "couple" | "direct" | "invoice";
  itemCount?: number;
  category: { id: string; name: string; color: string } | null;
};

export type CoupleBalance = {
  netBalance: number;
  whoOwes: "PARTNER_A" | "PARTNER_B" | null;
  amount: number;
  details: {
    aPaidForCouple: number;
    bPaidForCouple: number;
    aPaidForB: number;
    bPaidForA: number;
    settlementsAtoB: number;
    settlementsBtoA: number;
  };
  contributions: {
    aOwesB: Contribution[];
    bOwesA: Contribution[];
  };
};

export async function computeCoupleBalance(
  householdId: string,
  from?: Date,
  to?: Date
): Promise<CoupleBalance> {
  const txWhere: any = { householdId, type: "EXPENSE" };
  if (from || to) {
    txWhere.date = {};
    if (from) txWhere.date.gte = from;
    if (to) txWhere.date.lte = to;
  }

  const transactions = await prisma.finTransaction.findMany({
    where: txWhere,
    select: {
      id: true,
      amount: true,
      owner: true,
      paidByOwner: true,
      splitRatio: true,
      date: true,
      description: true,
      invoiceId: true,
      invoice: {
        select: {
          id: true,
          year: true,
          month: true,
          dueDate: true,
          account: { select: { name: true, color: true } },
        },
      },
      category: { select: { id: true, name: true, color: true } },
    },
    orderBy: { date: "desc" },
  });

  const details = {
    aPaidForCouple: 0,
    bPaidForCouple: 0,
    aPaidForB: 0,
    bPaidForA: 0,
    settlementsAtoB: 0,
    settlementsBtoA: 0,
  };

  // For each tx, push into either a per-invoice aggregate or as an individual
  // contribution. Aggregates are keyed by `${direction}-invoice-${invoiceId}`.
  type AggKey = string;
  type Agg = {
    direction: "aOwesB" | "bOwesA";
    contribution: Contribution;
  };
  const invoiceAggs = new Map<AggKey, Agg>();
  const standaloneAOwesB: Contribution[] = [];
  const standaloneBOwesA: Contribution[] = [];

  function pushContribution(
    direction: "aOwesB" | "bOwesA",
    tx: (typeof transactions)[number],
    contribAmount: number,
    kind: "couple" | "direct"
  ) {
    if (tx.invoiceId && tx.invoice) {
      const key = `${direction}-${tx.invoiceId}`;
      const existing = invoiceAggs.get(key);
      if (existing) {
        existing.contribution.contributionAmount += contribAmount;
        existing.contribution.totalAmount += tx.amount;
        existing.contribution.itemCount = (existing.contribution.itemCount ?? 0) + 1;
        if (tx.date > existing.contribution.date) {
          existing.contribution.date = tx.date;
        }
      } else {
        const monthLabel = new Date(tx.invoice.year, tx.invoice.month).toLocaleDateString(
          "pt-BR",
          { month: "long", year: "numeric" }
        );
        invoiceAggs.set(key, {
          direction,
          contribution: {
            id: `invoice-${tx.invoice.id}`,
            date: tx.invoice.dueDate,
            description: `Fatura ${tx.invoice.account.name} · ${monthLabel}`,
            totalAmount: tx.amount,
            contributionAmount: contribAmount,
            kind: "invoice",
            itemCount: 1,
            category: tx.invoice.account
              ? { id: tx.invoice.id, name: tx.invoice.account.name, color: tx.invoice.account.color }
              : null,
          },
        });
      }
    } else {
      const c: Contribution = {
        id: tx.id,
        date: tx.date,
        description: tx.description,
        totalAmount: tx.amount,
        contributionAmount: contribAmount,
        kind,
        category: tx.category,
      };
      if (direction === "aOwesB") standaloneAOwesB.push(c);
      else standaloneBOwesA.push(c);
    }
  }

  let balance = 0;
  for (const tx of transactions) {
    const paidBy = tx.paidByOwner;
    if (paidBy !== "PARTNER_A" && paidBy !== "PARTNER_B") continue;

    if (tx.owner === "COUPLE") {
      const r = typeof tx.splitRatio === "number" ? tx.splitRatio : 0.5;
      if (paidBy === "PARTNER_A") {
        const credit = (1 - r) * tx.amount;
        balance += credit;
        details.aPaidForCouple += credit;
        pushContribution("bOwesA", tx, credit, "couple");
      } else {
        const credit = r * tx.amount;
        balance -= credit;
        details.bPaidForCouple += credit;
        pushContribution("aOwesB", tx, credit, "couple");
      }
    } else if (tx.owner === "PARTNER_A" && paidBy === "PARTNER_B") {
      balance -= tx.amount;
      details.bPaidForA += tx.amount;
      pushContribution("aOwesB", tx, tx.amount, "direct");
    } else if (tx.owner === "PARTNER_B" && paidBy === "PARTNER_A") {
      balance += tx.amount;
      details.aPaidForB += tx.amount;
      pushContribution("bOwesA", tx, tx.amount, "direct");
    }
  }

  const contribAOwesB: Contribution[] = [...standaloneAOwesB];
  const contribBOwesA: Contribution[] = [...standaloneBOwesA];
  for (const agg of invoiceAggs.values()) {
    if (agg.direction === "aOwesB") contribAOwesB.push(agg.contribution);
    else contribBOwesA.push(agg.contribution);
  }
  // Sort by date desc within each direction
  contribAOwesB.sort((a, b) => b.date.getTime() - a.date.getTime());
  contribBOwesA.sort((a, b) => b.date.getTime() - a.date.getTime());

  const settlementWhere: any = { householdId };
  if (from || to) {
    // A settlement counts in the (from,to) window if it overlaps via EITHER
    // its date OR its periodStart..periodEnd. So an acerto paid in June
    // referring to May still credits the May balance when filtered by May.
    const dateClause: any = {};
    if (from) dateClause.gte = from;
    if (to) dateClause.lte = to;

    const periodOverlap: any = {};
    if (from) periodOverlap.periodEnd = { gte: from };
    if (to) periodOverlap.periodStart = { lte: to };

    settlementWhere.OR = [
      { date: dateClause },
      { AND: [{ periodStart: { not: null } }, { periodEnd: { not: null } }, periodOverlap] },
    ];
  }
  const settlements = await prisma.finSettlement.findMany({
    where: settlementWhere,
    select: { amount: true, fromOwner: true, toOwner: true },
  });
  for (const s of settlements) {
    if (s.fromOwner === "PARTNER_A" && s.toOwner === "PARTNER_B") {
      balance += s.amount;
      details.settlementsAtoB += s.amount;
    } else if (s.fromOwner === "PARTNER_B" && s.toOwner === "PARTNER_A") {
      balance -= s.amount;
      details.settlementsBtoA += s.amount;
    }
  }

  const amount = Math.abs(balance);
  const whoOwes =
    Math.abs(balance) < 0.005 ? null : balance > 0 ? "PARTNER_B" : "PARTNER_A";

  return {
    netBalance: balance,
    whoOwes,
    amount,
    details,
    contributions: { aOwesB: contribAOwesB, bOwesA: contribBOwesA },
  };
}
