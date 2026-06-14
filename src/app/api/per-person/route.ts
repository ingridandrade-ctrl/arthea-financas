import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";
import { parseLocalDate, parseLocalDateEnd } from "@/lib/financas/dates";

type CategoryAgg = {
  id: string | null;
  name: string;
  color: string;
  amount: number;
};

type AccountAgg = {
  id: string;
  name: string;
  color: string;
  type: string;
  amount: number;
};

function emptyBucket() {
  return {
    total: 0,
    byCategory: new Map<string, CategoryAgg>(),
    byAccount: new Map<string, AccountAgg>(),
  };
}

function addToBucket(
  bucket: ReturnType<typeof emptyBucket>,
  amount: number,
  category: { id: string; name: string; color: string } | null,
  account: { id: string; name: string; color: string; type: string }
) {
  bucket.total += amount;
  const catKey = category?.id ?? "__none__";
  const existingCat = bucket.byCategory.get(catKey);
  if (existingCat) {
    existingCat.amount += amount;
  } else {
    bucket.byCategory.set(catKey, {
      id: category?.id ?? null,
      name: category?.name ?? "Sem categoria",
      color: category?.color ?? "#94a3b8",
      amount,
    });
  }
  const existingAcc = bucket.byAccount.get(account.id);
  if (existingAcc) {
    existingAcc.amount += amount;
  } else {
    bucket.byAccount.set(account.id, {
      id: account.id,
      name: account.name,
      color: account.color,
      type: account.type,
      amount,
    });
  }
}

function bucketToJson(bucket: ReturnType<typeof emptyBucket>) {
  return {
    total: bucket.total,
    byCategory: Array.from(bucket.byCategory.values()).sort((a, b) => b.amount - a.amount),
    byAccount: Array.from(bucket.byAccount.values()).sort((a, b) => b.amount - a.amount),
  };
}

export async function GET(req: Request) {
  try {
    const household = await requireHousehold();
    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    const cardGrouping = searchParams.get("cardGrouping") === "purchase_date"
      ? "purchase_date"
      : "fatura_month";

    const from = fromStr ? parseLocalDate(fromStr) : null;
    const to = toStr ? parseLocalDateEnd(toStr) : null;

    const transactions = await prisma.finTransaction.findMany({
      where: { householdId: household.id, type: "EXPENSE" },
      select: {
        amount: true,
        owner: true,
        splitRatio: true,
        date: true,
        category: { select: { id: true, name: true, color: true } },
        account: { select: { id: true, name: true, color: true, type: true } },
        invoice: { select: { dueDate: true } },
      },
    });

    function effectiveDate(tx: typeof transactions[number]): Date {
      if (
        cardGrouping === "fatura_month" &&
        tx.account.type === "CREDIT_CARD" &&
        tx.invoice
      ) {
        return new Date(tx.invoice.dueDate);
      }
      return new Date(tx.date);
    }

    const inRange = transactions.filter((t) => {
      if (!from && !to) return true;
      const d = effectiveDate(t);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });

    const aOwn = emptyBucket();
    const bOwn = emptyBucket();
    const aCouple = emptyBucket();
    const bCouple = emptyBucket();

    for (const tx of inRange) {
      if (tx.owner === "PARTNER_A") {
        addToBucket(aOwn, tx.amount, tx.category, tx.account);
      } else if (tx.owner === "PARTNER_B") {
        addToBucket(bOwn, tx.amount, tx.category, tx.account);
      } else {
        const r = typeof tx.splitRatio === "number" ? tx.splitRatio : 0.5;
        addToBucket(aCouple, r * tx.amount, tx.category, tx.account);
        addToBucket(bCouple, (1 - r) * tx.amount, tx.category, tx.account);
      }
    }

    return NextResponse.json({
      partnerAName: household.partnerAName,
      partnerBName: household.partnerBName,
      partnerA: {
        own: bucketToJson(aOwn),
        couple: bucketToJson(aCouple),
        total: aOwn.total + aCouple.total,
      },
      partnerB: {
        own: bucketToJson(bOwn),
        couple: bucketToJson(bCouple),
        total: bOwn.total + bCouple.total,
      },
      filters: { cardGrouping },
    });
  } catch (e) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    throw e;
  }
}
