import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";
import { parseLocalDate } from "@/lib/financas/dates";

export async function GET() {
  try {
    const household = await requireHousehold();
    const goals = await prisma.finGoal.findMany({
      where: { householdId: household.id },
      orderBy: [{ archived: "asc" }, { createdAt: "desc" }],
      include: {
        contributions: { orderBy: { date: "desc" }, take: 50 },
      },
    });
    return NextResponse.json(goals);
  } catch (e) {
    if (e instanceof HouseholdAuthError) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const household = await requireHousehold();
    const body = await req.json();
    const { name, targetAmount, currentAmount, targetDate, color, notes } = body ?? {};
    if (typeof name !== "string" || !name.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
    if (typeof targetAmount !== "number" || targetAmount <= 0) {
      return NextResponse.json({ error: "Valor alvo inválido" }, { status: 400 });
    }
    const goal = await prisma.finGoal.create({
      data: {
        householdId: household.id,
        name: name.trim(),
        targetAmount,
        currentAmount: typeof currentAmount === "number" ? currentAmount : 0,
        targetDate: targetDate ? parseLocalDate(targetDate) : null,
        color: typeof color === "string" ? color : "#6366f1",
        notes: typeof notes === "string" ? notes : null,
      },
    });
    return NextResponse.json(goal, { status: 201 });
  } catch (e) {
    if (e instanceof HouseholdAuthError) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    throw e;
  }
}
