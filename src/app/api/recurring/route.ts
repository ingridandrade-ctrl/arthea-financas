import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";
import { runRecurringForHousehold } from "@/lib/financas/recurring";
import { parseLocalDate } from "@/lib/financas/dates";

const VALID_TYPES = ["INCOME", "EXPENSE", "TRANSFER"];
const VALID_OWNERS = ["PARTNER_A", "PARTNER_B", "COUPLE"];
const VALID_FREQ = ["WEEKLY", "MONTHLY", "YEARLY"];

export async function GET() {
  try {
    const household = await requireHousehold();
    const rules = await prisma.finRecurringRule.findMany({
      where: { householdId: household.id },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        account: { select: { id: true, name: true, color: true, type: true } },
        category: { select: { id: true, name: true, color: true, kind: true } },
      },
    });
    return NextResponse.json(rules);
  } catch (e) {
    if (e instanceof HouseholdAuthError) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const household = await requireHousehold();
    const body = await req.json();
    const {
      name,
      type,
      amount,
      description,
      notes,
      owner,
      accountId,
      toAccountId,
      categoryId,
      frequency,
      dayOfMonth,
      dayOfWeek,
      monthOfYear,
      startDate,
      endDate,
    } = body ?? {};

    if (typeof name !== "string" || !name.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
    if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    if (typeof amount !== "number" || amount <= 0) return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    const finalDescription = typeof description === "string" && description.trim() ? description.trim() : name.trim();
    if (!startDate) return NextResponse.json({ error: "Data inicial obrigatória" }, { status: 400 });
    if (!VALID_FREQ.includes(frequency)) return NextResponse.json({ error: "Frequência inválida" }, { status: 400 });

    const account = await prisma.finAccount.findFirst({ where: { id: accountId, householdId: household.id } });
    if (!account) return NextResponse.json({ error: "Conta inválida" }, { status: 400 });

    if (type === "TRANSFER") {
      if (typeof toAccountId !== "string" || toAccountId === accountId) {
        return NextResponse.json({ error: "Conta de destino inválida" }, { status: 400 });
      }
      const dest = await prisma.finAccount.findFirst({ where: { id: toAccountId, householdId: household.id } });
      if (!dest) return NextResponse.json({ error: "Conta de destino inválida" }, { status: 400 });
    }

    const rule = await prisma.finRecurringRule.create({
      data: {
        householdId: household.id,
        name: name.trim(),
        type,
        amount,
        description: finalDescription,
        notes: typeof notes === "string" ? notes : null,
        owner: VALID_OWNERS.includes(owner) ? owner : "COUPLE",
        accountId,
        toAccountId: type === "TRANSFER" ? toAccountId : null,
        categoryId: type === "TRANSFER" ? null : (categoryId || null),
        frequency,
        dayOfMonth: typeof dayOfMonth === "number" ? dayOfMonth : null,
        dayOfWeek: typeof dayOfWeek === "number" ? dayOfWeek : null,
        monthOfYear: typeof monthOfYear === "number" ? monthOfYear : null,
        startDate: parseLocalDate(startDate),
        endDate: endDate ? parseLocalDate(endDate) : null,
      },
    });

    const generated = await runRecurringForHousehold(household.id);

    return NextResponse.json({ ...rule, generated: generated.created }, { status: 201 });
  } catch (e) {
    if (e instanceof HouseholdAuthError) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    throw e;
  }
}
