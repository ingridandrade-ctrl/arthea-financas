import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";

const VALID_TYPES = ["CHECKING", "SAVINGS", "CASH", "CREDIT_CARD", "INVESTMENT", "OTHER"];
const VALID_OWNERS = ["PARTNER_A", "PARTNER_B", "COUPLE"];

async function loadOwned(id: string, householdId: string) {
  return prisma.finAccount.findFirst({ where: { id, householdId } });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const household = await requireHousehold();
    const existing = await loadOwned(params.id, household.id);
    if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const body = await req.json();
    const data: any = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.type === "string" && VALID_TYPES.includes(body.type)) data.type = body.type;
    if (typeof body.initialBalance === "number") data.initialBalance = body.initialBalance;
    if (typeof body.color === "string") data.color = body.color;
    if (typeof body.icon === "string" || body.icon === null) data.icon = body.icon;
    if (typeof body.archived === "boolean") data.archived = body.archived;
    if (typeof body.creditLimit === "number" || body.creditLimit === null) data.creditLimit = body.creditLimit;
    if (typeof body.closingDay === "number" || body.closingDay === null) data.closingDay = body.closingDay;
    if (typeof body.dueDay === "number" || body.dueDay === null) data.dueDay = body.dueDay;
    if (typeof body.owner === "string" && VALID_OWNERS.includes(body.owner)) data.owner = body.owner;

    const updated = await prisma.finAccount.update({ where: { id: params.id }, data });
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

    const txCount = await prisma.finTransaction.count({
      where: {
        householdId: household.id,
        OR: [{ accountId: params.id }, { toAccountId: params.id }],
      },
    });
    if (txCount > 0) {
      await prisma.finAccount.update({
        where: { id: params.id },
        data: { archived: true },
      });
      return NextResponse.json({ ok: true, archived: true });
    }
    await prisma.finAccount.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    throw e;
  }
}
