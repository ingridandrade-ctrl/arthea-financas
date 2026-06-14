import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";
import { ensureInvoice } from "@/lib/financas/credit-cards";
import { parseLocalDate, parseLocalDateEnd } from "@/lib/financas/dates";

const VALID_TYPES = ["INCOME", "EXPENSE", "TRANSFER"];
const VALID_OWNERS = ["PARTNER_A", "PARTNER_B", "COUPLE"];

export async function GET(req: Request) {
  try {
    const household = await requireHousehold();
    const { searchParams } = new URL(req.url);

    const where: any = { householdId: household.id };
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = parseLocalDate(from);
      if (to) where.date.lte = parseLocalDateEnd(to);
    }
    const accountId = searchParams.get("accountId");
    if (accountId) where.accountId = accountId;
    const invoiceId = searchParams.get("invoiceId");
    if (invoiceId) where.invoiceId = invoiceId;
    const categoryId = searchParams.get("categoryId");
    if (categoryId) where.categoryId = categoryId;
    const owner = searchParams.get("owner");
    if (owner && VALID_OWNERS.includes(owner)) where.owner = owner;
    const type = searchParams.get("type");
    if (type && VALID_TYPES.includes(type)) where.type = type;
    const q = searchParams.get("q");
    if (q && q.trim()) {
      where.description = { contains: q.trim(), mode: "insensitive" };
    }

    const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 500);

    const status = searchParams.get("status");

    const transactions = await prisma.finTransaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: limit,
      include: {
        account: { select: { id: true, name: true, color: true, type: true } },
        toAccount: { select: { id: true, name: true, color: true, type: true } },
        category: { select: { id: true, name: true, color: true, kind: true, icon: true } },
      },
    });

    if (!status) return NextResponse.json(transactions);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const filtered = transactions.filter((t) => {
      if (status === "paid") return t.paid;
      if (status === "pending") return !t.paid && new Date(t.date) >= today;
      if (status === "overdue") return !t.paid && new Date(t.date) < today;
      return true;
    });
    return NextResponse.json(filtered);
  } catch (e) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const household = await requireHousehold();
    const body = await req.json();
    const {
      type,
      amount,
      date,
      description,
      notes,
      owner,
      paidByOwner,
      splitRatio,
      accountId,
      toAccountId,
      categoryId,
    } = body ?? {};

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }
    if (typeof description !== "string" || !description.trim()) {
      return NextResponse.json({ error: "Descrição é obrigatória" }, { status: 400 });
    }
    if (!date) {
      return NextResponse.json({ error: "Data é obrigatória" }, { status: 400 });
    }
    if (typeof accountId !== "string") {
      return NextResponse.json({ error: "Conta é obrigatória" }, { status: 400 });
    }

    const account = await prisma.finAccount.findFirst({
      where: { id: accountId, householdId: household.id },
    });
    if (!account) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 400 });
    }

    if (type === "TRANSFER") {
      if (typeof toAccountId !== "string" || !toAccountId) {
        return NextResponse.json(
          { error: "Conta de destino obrigatória em transferências" },
          { status: 400 }
        );
      }
      if (toAccountId === accountId) {
        return NextResponse.json(
          { error: "Conta de destino deve ser diferente" },
          { status: 400 }
        );
      }
      const dest = await prisma.finAccount.findFirst({
        where: { id: toAccountId, householdId: household.id },
      });
      if (!dest) {
        return NextResponse.json({ error: "Conta de destino inválida" }, { status: 400 });
      }
    }

    if (categoryId && type !== "TRANSFER") {
      const cat = await prisma.finCategory.findFirst({
        where: { id: categoryId, householdId: household.id },
      });
      if (!cat) {
        return NextResponse.json({ error: "Categoria inválida" }, { status: 400 });
      }
    }

    let invoiceId: string | null = null;
    if (type === "EXPENSE" && account.type === "CREDIT_CARD") {
      const inv = await ensureInvoice(household.id, account, parseLocalDate(date));
      invoiceId = inv?.id ?? null;
    }

    let validPaidBy: any =
      paidByOwner === "PARTNER_A" || paidByOwner === "PARTNER_B" ? paidByOwner : null;
    // For a couple expense without an explicit paidByOwner, fall back to the
    // owner of the funding account. Otherwise the couple-balance code silently
    // ignores the row (bug #6 in audit). When the account is COUPLE, keep null
    // (truly joint, no one to credit).
    if (!validPaidBy && type === "EXPENSE" && owner === "COUPLE") {
      if (account.owner === "PARTNER_A" || account.owner === "PARTNER_B") {
        validPaidBy = account.owner;
      }
    }
    const validSplit =
      type === "EXPENSE" && owner === "COUPLE" && typeof splitRatio === "number"
        ? Math.min(Math.max(splitRatio, 0), 1)
        : null;

    const isPaid = typeof body.paid === "boolean" ? body.paid : true;

    const tx = await prisma.finTransaction.create({
      data: {
        householdId: household.id,
        type,
        amount,
        date: parseLocalDate(date),
        description: description.trim(),
        notes: typeof notes === "string" ? notes : null,
        owner: VALID_OWNERS.includes(owner) ? owner : "COUPLE",
        paidByOwner: type === "EXPENSE" ? validPaidBy : null,
        splitRatio: validSplit,
        accountId,
        toAccountId: type === "TRANSFER" ? toAccountId : null,
        categoryId: type === "TRANSFER" ? null : (categoryId || null),
        invoiceId,
        paid: isPaid,
        paidAt: isPaid ? new Date() : null,
      },
      include: {
        account: { select: { id: true, name: true, color: true, type: true } },
        toAccount: { select: { id: true, name: true, color: true, type: true } },
        category: { select: { id: true, name: true, color: true, kind: true, icon: true } },
      },
    });
    return NextResponse.json(tx, { status: 201 });
  } catch (e) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    throw e;
  }
}
