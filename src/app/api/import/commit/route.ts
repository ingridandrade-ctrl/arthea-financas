import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";
import { ensureInvoice, ensureInvoiceForMonth } from "@/lib/financas/credit-cards";
import { parseLocalDate } from "@/lib/financas/dates";
import { installmentGroupId, parseInstallment } from "@/lib/financas/installments";

const VALID_OWNERS = ["PARTNER_A", "PARTNER_B", "COUPLE"];

type Row = {
  date: string;
  description: string;
  amount: number;
  categoryId?: string | null;
  owner?: "PARTNER_A" | "PARTNER_B" | "COUPLE";
  paidByOwner?: "PARTNER_A" | "PARTNER_B" | null;
  forceNew?: boolean;
};

export async function POST(req: Request) {
  try {
    const household = await requireHousehold();
    const body = await req.json().catch(() => ({}));
    const { accountId, rows, invoiceYear, invoiceMonth, invoiceDueDate } = body ?? {};

    if (typeof accountId !== "string" || !accountId) {
      return NextResponse.json({ error: "Cartão é obrigatório" }, { status: 400 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Nenhum lançamento para importar" }, { status: 400 });
    }
    if (rows.length > 500) {
      return NextResponse.json({ error: "Máximo 500 linhas por importação" }, { status: 400 });
    }

    const hasFixedInvoice =
      typeof invoiceYear === "number" &&
      typeof invoiceMonth === "number" &&
      invoiceMonth >= 0 &&
      invoiceMonth <= 11;

    const account = await prisma.finAccount.findFirst({
      where: { id: accountId, householdId: household.id, type: "CREDIT_CARD" },
    });
    if (!account) {
      return NextResponse.json({ error: "Cartão não encontrado" }, { status: 404 });
    }

    const validRows: Row[] = [];
    for (const r of rows as Row[]) {
      if (!r || typeof r !== "object") continue;
      if (typeof r.description !== "string" || !r.description.trim()) continue;
      if (typeof r.amount !== "number" || !Number.isFinite(r.amount) || r.amount <= 0) continue;
      if (typeof r.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue;
      validRows.push(r);
    }
    if (validRows.length === 0) {
      return NextResponse.json({ error: "Nenhuma linha válida" }, { status: 400 });
    }

    const categoryIds = Array.from(
      new Set(validRows.map((r) => r.categoryId).filter((x): x is string => !!x))
    );
    const cats =
      categoryIds.length > 0
        ? await prisma.finCategory.findMany({
            where: { id: { in: categoryIds }, householdId: household.id },
            select: { id: true },
          })
        : [];
    const validCatIds = new Set(cats.map((c) => c.id));

    let fixedInvoice = hasFixedInvoice
      ? await ensureInvoiceForMonth(household.id, account, invoiceYear, invoiceMonth)
      : null;

    if (fixedInvoice && typeof invoiceDueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(invoiceDueDate)) {
      const newDue = parseLocalDate(invoiceDueDate);
      if (fixedInvoice.dueDate.getTime() !== newDue.getTime()) {
        fixedInvoice = await prisma.finCreditCardInvoice.update({
          where: { id: fixedInvoice.id },
          data: { dueDate: newDue },
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const createdIds: string[] = [];

      for (const r of validRows) {
        const date = parseLocalDate(r.date);
        const inv = fixedInvoice ?? (await ensureInvoice(household.id, account, date));
        const owner = VALID_OWNERS.includes(r.owner as string)
          ? (r.owner as "PARTNER_A" | "PARTNER_B" | "COUPLE")
          : "COUPLE";
        const paidByOwner =
          r.paidByOwner === "PARTNER_A" || r.paidByOwner === "PARTNER_B"
            ? r.paidByOwner
            : null;
        const categoryId =
          r.categoryId && validCatIds.has(r.categoryId) ? r.categoryId : null;

        const parc = parseInstallment(r.description);
        const trimmedDesc = r.description.trim();

        const baseData = {
          householdId: household.id,
          type: "EXPENSE" as const,
          amount: r.amount,
          date,
          description: trimmedDesc,
          owner,
          paidByOwner,
          accountId: account.id,
          categoryId,
          invoiceId: inv?.id ?? null,
        };

        if (!parc) {
          const created = await tx.finTransaction.create({ data: baseData });
          createdIds.push(created.id);
          continue;
        }

        const groupId = installmentGroupId(
          account.id,
          parc.baseDescription,
          parc.total,
          Math.round(r.amount * 100)
        );

        if (r.forceNew) {
          const created = await tx.finTransaction.create({
            data: {
              ...baseData,
              installmentGroupId: groupId,
              installmentIndex: parc.index,
              installmentTotal: parc.total,
              installmentProjected: false,
            },
          });
          createdIds.push(created.id);
          continue;
        }

        const existing = await tx.finTransaction.findFirst({
          where: {
            householdId: household.id,
            installmentGroupId: groupId,
            installmentIndex: parc.index,
          },
        });

        if (existing) {
          const updated = await tx.finTransaction.update({
            where: { id: existing.id },
            data: { ...baseData, installmentProjected: false },
          });
          createdIds.push(updated.id);
        } else {
          const created = await tx.finTransaction.create({
            data: {
              ...baseData,
              installmentGroupId: groupId,
              installmentIndex: parc.index,
              installmentTotal: parc.total,
              installmentProjected: false,
            },
          });
          createdIds.push(created.id);
        }
      }
      return { createdIds };
    });

    return NextResponse.json({ created: result.createdIds.length });
  } catch (e: any) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    console.error("[financas/import/commit] error", e);
    return NextResponse.json(
      { error: "Erro ao salvar: " + (e?.message || "desconhecido") },
      { status: 500 }
    );
  }
}
