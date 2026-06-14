import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";
import { parseLocalDate } from "@/lib/financas/dates";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const household = await requireHousehold();
    const inv = await prisma.finCreditCardInvoice.findFirst({
      where: { id: params.id, householdId: household.id },
      include: { transactions: { select: { amount: true } }, account: true },
    });
    if (!inv) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

    const body = await req.json();
    const action = body?.action;

    if (action === "pay") {
      const skipTransfer = body?.skipTransfer === true;
      const paidAt = body?.paidAt ? parseLocalDate(body.paidAt) : new Date();
      const paidBy: "PARTNER_A" | "PARTNER_B" | null =
        body?.paidBy === "PARTNER_A" || body?.paidBy === "PARTNER_B" ? body.paidBy : null;

      if (skipTransfer) {
        const updated = await prisma.$transaction(async (tx) => {
          const inv2 = await tx.finCreditCardInvoice.update({
            where: { id: inv.id },
            data: {
              paidAt,
              paymentAccountId: null,
              status: "PAID",
            },
          });
          const txUpdate: any = { paid: true, paidAt };
          if (paidBy) txUpdate.paidByOwner = paidBy;
          await tx.finTransaction.updateMany({
            where: { householdId: household.id, invoiceId: inv.id },
            data: txUpdate,
          });
          return inv2;
        });
        return NextResponse.json({ invoice: updated });
      }

      const paymentAccountId = body?.paymentAccountId;
      if (typeof paymentAccountId !== "string") {
        return NextResponse.json({ error: "Conta de pagamento obrigatória" }, { status: 400 });
      }
      const paymentAccount = await prisma.finAccount.findFirst({
        where: { id: paymentAccountId, householdId: household.id },
      });
      if (!paymentAccount) {
        return NextResponse.json({ error: "Conta de pagamento inválida" }, { status: 400 });
      }
      const total = inv.transactions.reduce((s, t) => s + t.amount, 0);

      const effectivePaidBy: "PARTNER_A" | "PARTNER_B" | null =
        paidBy ??
        (paymentAccount.owner === "PARTNER_A" || paymentAccount.owner === "PARTNER_B"
          ? paymentAccount.owner
          : null);

      const result = await prisma.$transaction(async (tx) => {
        const transferTx = await tx.finTransaction.create({
          data: {
            householdId: household.id,
            type: "TRANSFER",
            amount: total,
            date: paidAt,
            description: `Pagamento fatura ${inv.account.name} ${String(inv.month).padStart(2, "0")}/${inv.year}`,
            owner: "COUPLE",
            accountId: paymentAccountId,
            toAccountId: inv.accountId,
          },
        });
        const updated = await tx.finCreditCardInvoice.update({
          where: { id: inv.id },
          data: {
            paidAt,
            paymentAccountId,
            status: "PAID",
          },
        });
        const txUpdate: any = { paid: true, paidAt };
        if (effectivePaidBy) txUpdate.paidByOwner = effectivePaidBy;
        await tx.finTransaction.updateMany({
          where: { householdId: household.id, invoiceId: inv.id },
          data: txUpdate,
        });
        return { transferTx, invoice: updated };
      });
      return NextResponse.json(result);
    }

    if (action === "reopen") {
      const result = await prisma.$transaction(async (tx) => {
        // Undo paid state on every tx in this invoice
        await tx.finTransaction.updateMany({
          where: { householdId: household.id, invoiceId: inv.id },
          data: { paid: false, paidAt: null },
        });

        // Delete the auto-generated payment TRANSFER, if any. We match by:
        // type=TRANSFER, toAccountId=this CC account, amount within 0.01,
        // date == paidAt of the invoice. This is the same shape the pay
        // action creates above.
        if (inv.paidAt && inv.paymentAccountId) {
          const total = await tx.finTransaction.aggregate({
            where: { householdId: household.id, invoiceId: inv.id },
            _sum: { amount: true },
          });
          const totalAmount = total._sum.amount ?? 0;
          const transferCandidates = await tx.finTransaction.findMany({
            where: {
              householdId: household.id,
              type: "TRANSFER",
              toAccountId: inv.accountId,
              accountId: inv.paymentAccountId,
              date: inv.paidAt,
            },
            select: { id: true, amount: true },
          });
          // Delete the one whose amount matches the fatura total (within 1 cent)
          const match = transferCandidates.find(
            (t) => Math.abs(t.amount - totalAmount) < 0.01
          );
          if (match) {
            await tx.finTransaction.delete({ where: { id: match.id } });
          }
        }

        const updated = await tx.finCreditCardInvoice.update({
          where: { id: inv.id },
          data: { paidAt: null, paymentAccountId: null, status: "CLOSED" },
        });
        return updated;
      });
      return NextResponse.json(result);
    }

    if (action === "setAllDates") {
      const newDateStr = body?.date;
      if (typeof newDateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(newDateStr)) {
        return NextResponse.json({ error: "Data inválida" }, { status: 400 });
      }
      const newDate = parseLocalDate(newDateStr);
      // overwritePurchaseDates is OPT-IN now (was always-on, destroying real
      // purchase dates unrecoverably). Default: only update the invoice's
      // dueDate.
      const overwritePurchaseDates = body?.overwritePurchaseDates === true;
      const result = await prisma.$transaction(async (tx) => {
        let updatedCount = 0;
        if (overwritePurchaseDates) {
          const txUpdate = await tx.finTransaction.updateMany({
            where: { householdId: household.id, invoiceId: inv.id },
            data: { date: newDate },
          });
          updatedCount = txUpdate.count;
        }
        await tx.finCreditCardInvoice.update({
          where: { id: inv.id },
          data: { dueDate: newDate },
        });
        return { updated: updatedCount };
      });
      return NextResponse.json(result);
    }

    const data: any = {};
    if (typeof body.notes === "string" || body.notes === null) data.notes = body.notes;
    const updated = await prisma.finCreditCardInvoice.update({
      where: { id: inv.id },
      data,
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof HouseholdAuthError) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const household = await requireHousehold();
    const inv = await prisma.finCreditCardInvoice.findFirst({
      where: { id: params.id, householdId: household.id },
    });
    if (!inv) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
    await prisma.$transaction(async (tx) => {
      // If the invoice was paid, also delete the matching payment transfer.
      // Otherwise the conta corrente stays debited but the expense rows are
      // gone — silent money sink (bug #10).
      if (inv.paidAt && inv.paymentAccountId) {
        const total = await tx.finTransaction.aggregate({
          where: { householdId: household.id, invoiceId: inv.id },
          _sum: { amount: true },
        });
        const totalAmount = total._sum.amount ?? 0;
        const transferCandidates = await tx.finTransaction.findMany({
          where: {
            householdId: household.id,
            type: "TRANSFER",
            toAccountId: inv.accountId,
            accountId: inv.paymentAccountId,
            date: inv.paidAt,
          },
          select: { id: true, amount: true },
        });
        const match = transferCandidates.find(
          (t) => Math.abs(t.amount - totalAmount) < 0.01
        );
        if (match) {
          await tx.finTransaction.delete({ where: { id: match.id } });
        }
      }
      await tx.finTransaction.deleteMany({
        where: { householdId: household.id, invoiceId: inv.id },
      });
      await tx.finCreditCardInvoice.delete({ where: { id: inv.id } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof HouseholdAuthError) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    throw e;
  }
}
