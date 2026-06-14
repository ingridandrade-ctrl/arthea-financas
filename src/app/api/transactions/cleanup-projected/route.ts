import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";

export async function POST(req: Request) {
  try {
    const household = await requireHousehold();
    const body = await req.json().catch(() => ({}));
    const where: any = {
      householdId: household.id,
      installmentProjected: true,
    };
    if (typeof body?.accountId === "string" && body.accountId) {
      where.accountId = body.accountId;
    }
    const result = await prisma.finTransaction.deleteMany({ where });
    return NextResponse.json({ deleted: result.count });
  } catch (e: any) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    console.error("[financas/transactions/cleanup-projected]", e);
    return NextResponse.json({ error: "Erro ao limpar" }, { status: 500 });
  }
}
