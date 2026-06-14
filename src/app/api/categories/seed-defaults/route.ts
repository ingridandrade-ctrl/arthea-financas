import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";
import { DEFAULT_CATEGORIES } from "@/lib/financas/defaults";

export async function POST() {
  try {
    const household = await requireHousehold();
    const existing = await prisma.finCategory.findMany({
      where: { householdId: household.id },
      select: { name: true, kind: true },
    });
    const existingKeys = new Set(existing.map((c) => `${c.kind}|${c.name.toLowerCase()}`));
    const missing = DEFAULT_CATEGORIES.filter(
      (c) => !existingKeys.has(`${c.kind}|${c.name.toLowerCase()}`)
    );
    if (missing.length === 0) {
      return NextResponse.json({ created: 0 });
    }
    await prisma.finCategory.createMany({
      data: missing.map((c) => ({
        householdId: household.id,
        name: c.name,
        kind: c.kind,
        color: c.color,
        icon: c.icon,
      })),
    });
    return NextResponse.json({ created: missing.length, names: missing.map((m) => m.name) });
  } catch (e: any) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    console.error("[financas/categories/seed-defaults]", e);
    return NextResponse.json({ error: "Erro ao sincronizar" }, { status: 500 });
  }
}
