import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";
import { parseLocalDate } from "@/lib/financas/dates";
import { ensureInvoice } from "@/lib/financas/credit-cards";

const VALID_OWNERS = ["PARTNER_A", "PARTNER_B", "COUPLE"];

async function loadOwned(id: string, householdId: string) {
  return prisma.finTransaction.findFirst({ where: { id, householdId } });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const household = await requireHousehold();
    const tx = await prisma.finTransaction.findFirst({
      where: { id: params.id, householdId: household.id },
      include: {
        account: { select: { id: true, name: true, color: true, type: true } },
        toAccount: { select: { id: true, name: true, color: true, type: true } },
        category: { select: { id: true, name: true, color: true, kind: true, icon: true } },
      },
    });
    if (!tx) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json(tx);
  } catch (e) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    throw e;
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const household = await requireHousehold();
    const existing = await loadOwned(params.id, household.id);
    if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const body = await req.json();
    const data: any = {};
    if (typeof body.amount === "number" && body.amount > 0) data.amount = body.amount;
    if (body.date) data.date = parseLocalDate(body.date);
    if (typeof body.description === "string" && body.description.trim()) data.description = body.description.trim();
    if (typeof body.notes === "string" || body.notes === null) data.notes = body.notes;
    if (VALID_OWNERS.includes(body.owner)) data.owner = body.owner;
    if (body.paidByOwner === "PARTNER_A" || body.paidByOwner === "PARTNER_B" || body.paidByOwner === null) {
      data.paidByOwner = body.paidByOwner;
    }
    if (typeof body.splitRatio === "number" || body.splitRatio === null) {
      data.splitRatio = body.splitRatio === null ? null : Math.min(Math.max(body.splitRatio, 0), 1);
    }
    if (typeof body.accountId === "string") {
      const account = await prisma.finAccount.findFirst({
        where: { id: body.accountId, householdId: household.id },
      });
      if (!account) return NextResponse.json({ error: "Conta inválida" }, { status: 400 });
      data.accountId = body.accountId;
    }
    if (existing.type === "TRANSFER" && typeof body.toAccountId === "string") {
      data.toAccountId = body.toAccountId;
    }
    if (existing.type !== "TRANSFER" && (typeof body.categoryId === "string" || body.categoryId === null)) {
      data.categoryId = body.categoryId;
    }
    if (typeof body.paid === "boolean") {
      data.paid = body.paid;
      data.paidAt = body.paid ? (body.paidAt ? parseLocalDate(body.paidAt) : new Date()) : null;
    }

    if (data.date && existing.invoiceId) {
      const accountId = (data.accountId as string | undefined) ?? existing.accountId;
      const account = await prisma.finAccount.findFirst({
        where: { id: accountId, householdId: household.id },
        select: { id: true, type: true, closingDay: true, dueDay: true },
      });
      if (account && account.type === "CREDIT_CARD") {
        const inv = await ensureInvoice(household.id, account, data.date as Date);
        data.invoiceId = inv?.id ?? null;
      }
    }

    const updated = await prisma.finTransaction.update({
      where: { id: params.id },
      data,
      include: {
        account: { select: { id: true, name: true, color: true, type: true } },
        toAccount: { select: { id: true, name: true, color: true, type: true } },
        category: { select: { id: true, name: true, color: true, kind: true, icon: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const household = await requireHousehold();
    const existing = await loadOwned(params.id, household.id);
    if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    await prisma.finTransaction.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    throw e;
  }
}
