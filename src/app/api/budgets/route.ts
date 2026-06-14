import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";

export async function GET(req: Request) {
  try {
    const household = await requireHousehold();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // "YYYY-MM"

    const monthFilter = month && /^\d{4}-\d{2}$/.test(month) ? month : null;
    const [budgets, categories] = await Promise.all([
      prisma.finBudget.findMany({
        where: {
          householdId: household.id,
          month: { in: monthFilter ? ["default", monthFilter] : ["default"] },
        },
      }),
      prisma.finCategory.findMany({
        where: { householdId: household.id, kind: "EXPENSE", archived: false },
        orderBy: { name: "asc" },
      }),
    ]);

    type Actual = { categoryId: string | null; _sum: { amount: number | null } };
    let actuals: Actual[] = [];
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 1);
      actuals = (await prisma.finTransaction.groupBy({
        by: ["categoryId"],
        where: {
          householdId: household.id,
          type: "EXPENSE",
          date: { gte: start, lt: end },
          categoryId: { not: null },
        },
        _sum: { amount: true },
      })) as unknown as Actual[];
    }
    const actualMap = new Map(actuals.map((a) => [a.categoryId, a._sum.amount ?? 0]));

    const byCategoryDefault = new Map<string, number>();
    const byCategoryOverride = new Map<string, number>();
    for (const b of budgets) {
      if (b.month === "default") byCategoryDefault.set(b.categoryId, b.amount);
      else byCategoryOverride.set(b.categoryId, b.amount);
    }

    const items = categories.map((c) => {
      const planned =
        byCategoryOverride.get(c.id) ?? byCategoryDefault.get(c.id) ?? 0;
      const actual = actualMap.get(c.id) ?? 0;
      const isOverride = byCategoryOverride.has(c.id);
      return {
        categoryId: c.id,
        categoryName: c.name,
        categoryColor: c.color,
        planned,
        actual,
        remaining: planned - actual,
        isOverride,
      };
    });

    return NextResponse.json({ month: month || null, items });
  } catch (e) {
    if (e instanceof HouseholdAuthError) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    throw e;
  }
}

export async function PUT(req: Request) {
  try {
    const household = await requireHousehold();
    const body = await req.json();
    const { categoryId, amount, month } = body ?? {};

    if (typeof categoryId !== "string") return NextResponse.json({ error: "Categoria obrigatória" }, { status: 400 });
    if (typeof amount !== "number" || amount < 0) return NextResponse.json({ error: "Valor inválido" }, { status: 400 });

    const cat = await prisma.finCategory.findFirst({
      where: { id: categoryId, householdId: household.id },
    });
    if (!cat) return NextResponse.json({ error: "Categoria não encontrada" }, { status: 404 });

    const monthValue =
      typeof month === "string" && /^\d{4}-\d{2}$/.test(month) ? month : "default";

    if (amount === 0) {
      await prisma.finBudget.deleteMany({
        where: { householdId: household.id, categoryId, month: monthValue },
      });
      return NextResponse.json({ ok: true, deleted: true });
    }

    const upserted = await prisma.finBudget.upsert({
      where: { categoryId_month: { categoryId, month: monthValue } },
      update: { amount },
      create: { householdId: household.id, categoryId, amount, month: monthValue },
    });
    return NextResponse.json(upserted);
  } catch (e) {
    if (e instanceof HouseholdAuthError) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    throw e;
  }
}
