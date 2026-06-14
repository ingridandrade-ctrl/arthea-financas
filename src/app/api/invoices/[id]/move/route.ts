import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";
import { ensureInvoiceForMonth } from "@/lib/financas/credit-cards";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const household = await requireHousehold();
    const body = await req.json().catch(() => ({}));
    const targetMonthStr: string | undefined = body?.targetMonth;
    const deleteSource: boolean = body?.deleteSource !== false;

    if (typeof targetMonthStr !== "string" || !/^\d{4}-\d{2}$/.test(targetMonthStr)) {
      return NextResponse.json({ error: "Mês de destino inválido" }, { status: 400 });
    }
    const [yStr, mStr] = targetMonthStr.split("-");
    const targetYear = parseInt(yStr, 10);
    const targetMonth = parseInt(mStr, 10) - 1;

    const source = await prisma.finCreditCardInvoice.findFirst({
      where: { id: params.id, householdId: household.id },
      include: { account: true },
    });
    if (!source) return NextResponse.json({ error: "Fatura origem não encontrada" }, { status: 404 });

    if (source.year === targetYear && source.month === targetMonth) {
      return NextResponse.json({ error: "Origem e destino são a mesma fatura" }, { status: 400 });
    }

    const target = await ensureInvoiceForMonth(
      household.id,
      source.account,
      targetYear,
      targetMonth
    );
    if (!target) {
      return NextResponse.json(
        { error: "Não foi possível criar/encontrar a fatura de destino (cartão sem dia de fechamento ou vencimento)" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const moved = await tx.finTransaction.updateMany({
        where: { householdId: household.id, invoiceId: source.id },
        data: { invoiceId: target.id },
      });
      if (deleteSource) {
        await tx.finCreditCardInvoice.delete({ where: { id: source.id } });
      }
      return { moved: moved.count };
    });

    return NextResponse.json({ moved: result.moved, targetInvoiceId: target.id });
  } catch (e: any) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    console.error("[financas/invoices/move]", e);
    return NextResponse.json({ error: "Erro ao mover compras" }, { status: 500 });
  }
}
