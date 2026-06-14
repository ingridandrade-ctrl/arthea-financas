import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";

async function loadOwned(id: string, householdId: string) {
  return prisma.finCategory.findFirst({ where: { id, householdId } });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const household = await requireHousehold();
    const existing = await loadOwned(params.id, household.id);
    if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const body = await req.json();
    const data: any = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (body.kind === "INCOME" || body.kind === "EXPENSE") data.kind = body.kind;
    if (typeof body.color === "string") data.color = body.color;
    if (typeof body.icon === "string" || body.icon === null) data.icon = body.icon;
    if (typeof body.archived === "boolean") data.archived = body.archived;
    if (typeof body.parentId === "string" || body.parentId === null) data.parentId = body.parentId;

    const updated = await prisma.finCategory.update({ where: { id: params.id }, data });
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

    const inUse = await prisma.finTransaction.count({
      where: { householdId: household.id, categoryId: params.id },
    });
    if (inUse > 0) {
      await prisma.finCategory.update({
        where: { id: params.id },
        data: { archived: true },
      });
      return NextResponse.json({ ok: true, archived: true });
    }
    await prisma.finCategory.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    throw e;
  }
}
