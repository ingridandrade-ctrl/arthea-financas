import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";
import { computeAccountBalances } from "@/lib/financas/balances";

const VALID_TYPES = ["CHECKING", "SAVINGS", "CASH", "CREDIT_CARD", "INVESTMENT", "OTHER"];
const VALID_OWNERS = ["PARTNER_A", "PARTNER_B", "COUPLE"];

export async function GET() {
  try {
    const household = await requireHousehold();
    const accounts = await prisma.finAccount.findMany({
      where: { householdId: household.id },
      orderBy: [{ archived: "asc" }, { createdAt: "asc" }],
    });
    const balances = await computeAccountBalances(household.id);
    const balanceMap = new Map(balances.map((b) => [b.accountId, b.balance]));
    return NextResponse.json(
      accounts.map((a) => ({ ...a, balance: balanceMap.get(a.id) ?? a.initialBalance }))
    );
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
    const { name, type, initialBalance, color, icon, creditLimit, closingDay, dueDay, owner } = body ?? {};

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }
    if (typeof type !== "string" || !VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    if (
      type === "CREDIT_CARD" &&
      typeof closingDay === "number" &&
      typeof dueDay === "number" &&
      closingDay === dueDay
    ) {
      return NextResponse.json(
        { error: "Dia de fechamento e vencimento não podem ser o mesmo." },
        { status: 400 }
      );
    }

    const account = await prisma.finAccount.create({
      data: {
        householdId: household.id,
        name: name.trim(),
        type: type as any,
        initialBalance: typeof initialBalance === "number" ? initialBalance : 0,
        color: typeof color === "string" ? color : "#6366f1",
        icon: typeof icon === "string" ? icon : null,
        creditLimit: typeof creditLimit === "number" ? creditLimit : null,
        closingDay: typeof closingDay === "number" ? closingDay : null,
        dueDay: typeof dueDay === "number" ? dueDay : null,
        owner: VALID_OWNERS.includes(owner) ? (owner as any) : "COUPLE",
      },
    });
    return NextResponse.json(account, { status: 201 });
  } catch (e) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    throw e;
  }
}
