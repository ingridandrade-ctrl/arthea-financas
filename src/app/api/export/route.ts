import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";
import { parseLocalDate, parseLocalDateEnd } from "@/lib/financas/dates";

const OWNER_LABEL: Record<string, string> = {
  PARTNER_A: "A",
  PARTNER_B: "B",
  COUPLE: "Casal",
};

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  try {
    const household = await requireHousehold();
    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");

    const where: any = { householdId: household.id };
    if (fromStr || toStr) {
      where.date = {};
      if (fromStr) where.date.gte = parseLocalDate(fromStr);
      if (toStr) where.date.lte = parseLocalDateEnd(toStr);
    }

    const [transactions, partnerNames] = await Promise.all([
      prisma.finTransaction.findMany({
        where,
        orderBy: { date: "asc" },
        include: {
          account: { select: { name: true } },
          toAccount: { select: { name: true } },
          category: { select: { name: true } },
        },
      }),
      prisma.household.findUnique({
        where: { id: household.id },
        select: { partnerAName: true, partnerBName: true },
      }),
    ]);

    const aName = partnerNames?.partnerAName || "A";
    const bName = partnerNames?.partnerBName || "B";
    const ownerName = (o: string | null) =>
      o === "PARTNER_A" ? aName : o === "PARTNER_B" ? bName : o === "COUPLE" ? "Casal" : "";

    const header = [
      "Data",
      "Tipo",
      "Descrição",
      "Categoria",
      "Conta",
      "Conta destino",
      "Dono",
      "Pago por",
      "Divisão A%",
      "Valor",
      "Observações",
    ];

    const rows: string[] = [header.map(csvEscape).join(",")];
    for (const t of transactions) {
      const row = [
        new Date(t.date).toISOString().slice(0, 10),
        t.type === "INCOME" ? "Receita" : t.type === "EXPENSE" ? "Despesa" : "Transferência",
        t.description,
        t.category?.name ?? "",
        t.account.name,
        t.toAccount?.name ?? "",
        ownerName(t.owner),
        t.paidByOwner ? ownerName(t.paidByOwner) : "",
        typeof t.splitRatio === "number" ? Math.round(t.splitRatio * 100) : "",
        t.amount.toFixed(2).replace(".", ","),
        t.notes ?? "",
      ];
      rows.push(row.map(csvEscape).join(","));
    }

    const body = "﻿" + rows.join("\n");
    const filename = `lancamentos${fromStr ? `_${fromStr.slice(0, 10)}` : ""}${toStr ? `_${toStr.slice(0, 10)}` : ""}.csv`;
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    if (e instanceof HouseholdAuthError) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    throw e;
  }
}
