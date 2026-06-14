import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";
import { computeCoupleBalance } from "@/lib/financas/couple";
import { parseLocalDate, parseLocalDateEnd } from "@/lib/financas/dates";

export async function GET(req: Request) {
  try {
    const household = await requireHousehold();
    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    const from = fromStr ? parseLocalDate(fromStr) : undefined;
    const to = toStr ? parseLocalDateEnd(toStr) : undefined;

    const [settlements, balance] = await Promise.all([
      prisma.finSettlement.findMany({
        where: { householdId: household.id },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      computeCoupleBalance(household.id, from, to),
    ]);
    return NextResponse.json({ settlements, balance });
  } catch (e) {
    if (e instanceof HouseholdAuthError) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const household = await requireHousehold();
    const body = await req.json();
    const { amount, fromOwner, toOwner, date, notes, periodStart, periodEnd } = body ?? {};

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }
    if (
      (fromOwner !== "PARTNER_A" && fromOwner !== "PARTNER_B") ||
      (toOwner !== "PARTNER_A" && toOwner !== "PARTNER_B") ||
      fromOwner === toOwner
    ) {
      return NextResponse.json({ error: "Direção do acerto inválida" }, { status: 400 });
    }
    if (!date) return NextResponse.json({ error: "Data obrigatória" }, { status: 400 });

    const settlement = await prisma.finSettlement.create({
      data: {
        householdId: household.id,
        amount,
        fromOwner,
        toOwner,
        date: parseLocalDate(date),
        notes: typeof notes === "string" ? notes : null,
        periodStart: periodStart ? new Date(periodStart) : null,
        periodEnd: periodEnd ? new Date(periodEnd) : null,
      },
    });
    return NextResponse.json(settlement, { status: 201 });
  } catch (e) {
    if (e instanceof HouseholdAuthError) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    throw e;
  }
}
