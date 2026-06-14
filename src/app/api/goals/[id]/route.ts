import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";
import { parseLocalDate } from "@/lib/financas/dates";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const household = await requireHousehold();
    const existing = await prisma.finGoal.findFirst({
      where: { id: params.id, householdId: household.id },
    });
    if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const body = await req.json();
    if (body.action === "contribute") {
      const amount = typeof body.amount === "number" ? body.amount : 0;
      if (amount === 0) return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
      const date = body.date ? parseLocalDate(body.date) : new Date();
      const result = await prisma.$transaction(async (tx) => {
        const contrib = await tx.finGoalContribution.create({
          data: { goalId: existing.id, amount, date, notes: body.notes ?? null },
        });
        const goal = await tx.finGoal.update({
          where: { id: existing.id },
          data: { currentAmount: { increment: amount } },
        });
        return { contrib, goal };
      });
      return NextResponse.json(result);
    }

    const data: any = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.targetAmount === "number" && body.targetAmount > 0) data.targetAmount = body.targetAmount;
    if (typeof body.currentAmount === "number") data.currentAmount = body.currentAmount;
    if (body.targetDate !== undefined) data.targetDate = body.targetDate ? parseLocalDate(body.targetDate) : null;
    if (typeof body.color === "string") data.color = body.color;
    if (typeof body.notes === "string" || body.notes === null) data.notes = body.notes;
    if (typeof body.archived === "boolean") data.archived = body.archived;

    const updated = await prisma.finGoal.update({ where: { id: params.id }, data });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof HouseholdAuthError) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const household = await requireHousehold();
    const existing = await prisma.finGoal.findFirst({
      where: { id: params.id, householdId: household.id },
    });
    if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    await prisma.finGoal.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof HouseholdAuthError) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    throw e;
  }
}
