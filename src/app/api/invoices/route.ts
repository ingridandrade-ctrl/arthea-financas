import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";

export async function GET(req: Request) {
  try {
    const household = await requireHousehold();
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");

    const where: any = { householdId: household.id };
    if (accountId) where.accountId = accountId;

    const invoices = await prisma.finCreditCardInvoice.findMany({
      where,
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: {
        account: { select: { id: true, name: true, color: true, closingDay: true, dueDay: true } },
        paymentAccount: { select: { id: true, name: true } },
        transactions: {
          select: {
            id: true,
            amount: true,
            description: true,
            date: true,
            owner: true,
            installmentGroupId: true,
            installmentIndex: true,
            installmentTotal: true,
            installmentProjected: true,
            category: { select: { id: true, name: true, color: true } },
          },
          orderBy: { date: "desc" },
        },
      },
    });

    const today = new Date();
    const enriched = invoices.map((inv) => {
      const total = inv.transactions.reduce((s, t) => s + t.amount, 0);
      let status: "OPEN" | "CLOSED" | "PAID" | "OVERDUE" = inv.status;
      if (status !== "PAID") {
        if (inv.closingDate <= today && status === "OPEN") status = "CLOSED";
        if (inv.dueDate < today) status = "OVERDUE";
      }
      return { ...inv, total, status };
    });
    return NextResponse.json(enriched);
  } catch (e) {
    if (e instanceof HouseholdAuthError) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    throw e;
  }
}
