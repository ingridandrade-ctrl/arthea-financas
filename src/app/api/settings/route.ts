import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";

export async function GET() {
  try {
    const household = await requireHousehold();
    return NextResponse.json({
      id: household.id,
      partnerAName: household.partnerAName,
      partnerBName: household.partnerBName,
      currency: household.currency,
      hideBalances: household.hideBalances,
    });
  } catch (e) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    throw e;
  }
}

export async function PATCH(req: Request) {
  try {
    const household = await requireHousehold();
    const body = await req.json();
    const data: any = {};
    if (typeof body.partnerAName === "string" && body.partnerAName.trim()) {
      data.partnerAName = body.partnerAName.trim();
    }
    if (typeof body.partnerBName === "string" && body.partnerBName.trim()) {
      data.partnerBName = body.partnerBName.trim();
    }
    if (typeof body.currency === "string" && body.currency.trim()) {
      data.currency = body.currency.trim();
    }
    if (typeof body.hideBalances === "boolean") {
      data.hideBalances = body.hideBalances;
    }
    const updated = await prisma.household.update({
      where: { id: household.id },
      data,
    });
    return NextResponse.json({
      partnerAName: updated.partnerAName,
      partnerBName: updated.partnerBName,
      currency: updated.currency,
      hideBalances: updated.hideBalances,
    });
  } catch (e) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    throw e;
  }
}
