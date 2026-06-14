import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";

export async function POST(req: Request) {
  try {
    const household = await requireHousehold();
    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids.filter((x: any) => typeof x === "string") : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "Nenhum lançamento informado" }, { status: 400 });
    }
    const result = await prisma.finTransaction.deleteMany({
      where: { id: { in: ids }, householdId: household.id },
    });
    return NextResponse.json({ deleted: result.count });
  } catch (e: any) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    console.error("[financas/transactions/bulk-delete]", e);
    return NextResponse.json({ error: "Erro ao excluir" }, { status: 500 });
  }
}
