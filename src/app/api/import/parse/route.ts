import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";
import { parseInvoiceText } from "@/lib/financas/parse-invoice";
import { getMerchantHints } from "@/lib/financas/merchant-hints";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TEXT_LENGTH = 80000;

export async function POST(req: Request) {
  try {
    const household = await requireHousehold();

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY não configurada no servidor." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { accountId, text } = body ?? {};

    if (typeof accountId !== "string" || !accountId) {
      return NextResponse.json({ error: "Cartão é obrigatório" }, { status: 400 });
    }
    if (typeof text !== "string" || text.trim().length < 20) {
      return NextResponse.json(
        { error: "Cole o texto da fatura (pelo menos algumas linhas)" },
        { status: 400 }
      );
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Texto muito longo (máx ${MAX_TEXT_LENGTH} caracteres). Cole por partes.` },
        { status: 400 }
      );
    }

    const account = await prisma.finAccount.findFirst({
      where: { id: accountId, householdId: household.id, type: "CREDIT_CARD" },
    });
    if (!account) {
      return NextResponse.json({ error: "Cartão não encontrado" }, { status: 404 });
    }

    const [categories, hints] = await Promise.all([
      prisma.finCategory.findMany({
        where: { householdId: household.id, kind: "EXPENSE", archived: false },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      getMerchantHints(household.id),
    ]);

    const result = await parseInvoiceText(text, {
      cardName: account.name,
      partnerAName: household.partnerAName,
      partnerBName: household.partnerBName,
      categories,
      hints,
    });

    if (!result.parsed) {
      return NextResponse.json(
        { error: "Não consegui interpretar a resposta da IA. Tente novamente." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      transactions: result.parsed,
      categories,
      account: { id: account.id, name: account.name, color: account.color },
      hintsUsed: hints.length,
    });
  } catch (e: any) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    console.error("[financas/import/parse] error", e);
    return NextResponse.json(
      { error: "Erro ao analisar fatura: " + (e?.message || "desconhecido") },
      { status: 500 }
    );
  }
}
