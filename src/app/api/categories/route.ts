import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";

export async function GET() {
  try {
    const household = await requireHousehold();
    const categories = await prisma.finCategory.findMany({
      where: { householdId: household.id },
      orderBy: [{ archived: "asc" }, { kind: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(categories);
  } catch (e) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const household = await requireHousehold();
    const body = await req.json();
    const { name, kind, color, icon, parentId } = body ?? {};

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }
    if (kind !== "INCOME" && kind !== "EXPENSE") {
      return NextResponse.json({ error: "Tipo deve ser INCOME ou EXPENSE" }, { status: 400 });
    }

    const category = await prisma.finCategory.create({
      data: {
        householdId: household.id,
        name: name.trim(),
        kind,
        color: typeof color === "string" ? color : "#6366f1",
        icon: typeof icon === "string" ? icon : null,
        parentId: typeof parentId === "string" ? parentId : null,
      },
    });
    return NextResponse.json(category, { status: 201 });
  } catch (e) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    throw e;
  }
}
