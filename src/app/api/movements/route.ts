import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";
import { parseLocalDate, parseLocalDateEnd, startOfTodayBR } from "@/lib/financas/dates";

type Owner = "PARTNER_A" | "PARTNER_B" | "COUPLE";

const VALID_TYPES = ["INCOME", "EXPENSE", "TRANSFER", "INVOICE"];
const VALID_OWNERS: Owner[] = ["PARTNER_A", "PARTNER_B", "COUPLE"];
const VALID_STATUS = ["paid", "pending", "overdue"];

type MovementRow = {
  id: string;
  kind: "transaction" | "invoice";
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "INVOICE";
  date: string;
  description: string;
  amount: number;
  account: { id: string; name: string; color: string; type: string };
  toAccount?: { id: string; name: string; color: string; type: string } | null;
  category: { id: string; name: string; color: string; icon: string | null } | null;
  owner: Owner;
  paid: boolean;
  paidAt: string | null;
  status: "paid" | "pending" | "overdue" | "scheduled";
  invoiceId?: string | null;
  itemCount?: number;
};

function deriveStatus(paid: boolean, dateStr: string, today: Date): "paid" | "pending" | "overdue" {
  if (paid) return "paid";
  const d = new Date(dateStr);
  d.setUTCHours(0, 0, 0, 0);
  return d < today ? "overdue" : "pending";
}

export async function GET(req: Request) {
  try {
    const household = await requireHousehold();
    const { searchParams } = new URL(req.url);

    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    const accountId = searchParams.get("accountId");
    const categoryId = searchParams.get("categoryId");
    const ownerFilter = searchParams.get("owner");
    const typeFilter = searchParams.get("type");
    const statusFilter = searchParams.get("status");
    const q = searchParams.get("q");
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "200", 10) || 200, 1), 2000);
    // summary=1: devolve também a contagem e os totais do filtro INTEIRO.
    // A lista vem cortada em `limit` linhas; somar só o que veio (como a tela
    // fazia) dava totais errados em qualquer período com mais de 200 itens.
    const withSummary = searchParams.get("summary") === "1";

    const fromDate = fromStr ? parseLocalDate(fromStr) : null;
    const toDate = toStr ? parseLocalDateEnd(toStr) : null;

    const txWhere: any = {
      householdId: household.id,
      invoiceId: null,
      NOT: {
        AND: [
          { type: "TRANSFER" },
          { toAccount: { type: "CREDIT_CARD" } },
        ],
      },
    };
    if (fromDate || toDate) {
      txWhere.date = {};
      if (fromDate) txWhere.date.gte = fromDate;
      if (toDate) txWhere.date.lte = toDate;
    }
    if (accountId) txWhere.accountId = accountId;
    if (categoryId) txWhere.categoryId = categoryId;
    if (ownerFilter && VALID_OWNERS.includes(ownerFilter as Owner)) {
      txWhere.owner = ownerFilter;
    }
    if (typeFilter && ["INCOME", "EXPENSE", "TRANSFER"].includes(typeFilter)) {
      txWhere.type = typeFilter;
    }
    const skipTransactions = typeFilter === "INVOICE";
    if (q && q.trim()) {
      txWhere.description = { contains: q.trim(), mode: "insensitive" };
    }

    const transactions = skipTransactions
      ? []
      : await prisma.finTransaction.findMany({
          where: txWhere,
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          include: {
            account: { select: { id: true, name: true, color: true, type: true } },
            toAccount: { select: { id: true, name: true, color: true, type: true } },
            category: { select: { id: true, name: true, color: true, icon: true } },
          },
        });

    const invWhere: any = { householdId: household.id };
    if (fromDate || toDate) {
      invWhere.dueDate = {};
      if (fromDate) invWhere.dueDate.gte = fromDate;
      if (toDate) invWhere.dueDate.lte = toDate;
    }
    if (accountId) invWhere.accountId = accountId;

    const showInvoices =
      !typeFilter ||
      typeFilter === "" ||
      typeFilter === "INVOICE" ||
      typeFilter === "EXPENSE";

    const invoices = showInvoices
      ? await prisma.finCreditCardInvoice.findMany({
          where: invWhere,
          orderBy: [{ dueDate: "desc" }],
          include: {
            account: { select: { id: true, name: true, color: true, type: true } },
            transactions: { select: { amount: true } },
          },
        })
      : [];

    // "Hoje" de Brasília: o que vence hoje só fica atrasado amanhã.
    const today = startOfTodayBR();

    const rows: MovementRow[] = [];

    for (const t of transactions) {
      const paid = t.paid;
      const status = deriveStatus(paid, t.date.toISOString(), today);
      rows.push({
        id: t.id,
        kind: "transaction",
        type: t.type,
        date: t.date.toISOString(),
        description: t.description,
        amount: t.amount,
        account: t.account,
        toAccount: t.toAccount,
        category: t.category,
        owner: t.owner as Owner,
        paid,
        paidAt: t.paidAt?.toISOString() ?? null,
        status,
        invoiceId: null,
      });
    }

    for (const inv of invoices) {
      const total = inv.transactions.reduce((s, x) => s + x.amount, 0);
      if (total <= 0) continue;
      if (q && q.trim() && !inv.account.name.toLowerCase().includes(q.toLowerCase())) continue;

      const paid = inv.status === "PAID";
      const status = deriveStatus(paid, inv.dueDate.toISOString(), today);
      rows.push({
        id: `invoice-${inv.id}`,
        kind: "invoice",
        type: "INVOICE",
        date: inv.dueDate.toISOString(),
        description: `Fatura cartão ${inv.account.name}`,
        amount: total,
        account: inv.account,
        toAccount: null,
        category: null,
        owner: "COUPLE",
        paid,
        paidAt: inv.paidAt?.toISOString() ?? null,
        status,
        invoiceId: inv.id,
        itemCount: inv.transactions.length,
      });
    }

    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const filtered =
      statusFilter && VALID_STATUS.includes(statusFilter)
        ? rows.filter((r) => r.status === statusFilter)
        : rows;

    if (!withSummary) return NextResponse.json(filtered.slice(0, limit));

    const counts = { INCOME: 0, EXPENSE: 0, TRANSFER: 0, INVOICE: 0 };
    let income = 0;
    let expense = 0;
    for (const r of filtered) {
      counts[r.type] += 1;
      if (r.type === "INCOME") income += r.amount;
      else if (r.type === "EXPENSE" || r.type === "INVOICE") expense += r.amount;
    }
    return NextResponse.json({
      rows: filtered.slice(0, limit),
      totalCount: filtered.length,
      counts,
      totals: { income, expense },
    });
  } catch (e) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    throw e;
  }
}
