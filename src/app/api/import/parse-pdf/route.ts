import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";
import { parseInvoiceText } from "@/lib/financas/parse-invoice";
import { getMerchantHints } from "@/lib/financas/merchant-hints";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PDF_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const household = await requireHousehold();

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY não configurada no servidor." },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const accountId = form.get("accountId");
    const file = form.get("file");
    const passwordRaw = form.get("password");
    const password = typeof passwordRaw === "string" ? passwordRaw : "";

    if (typeof accountId !== "string" || !accountId) {
      return NextResponse.json({ error: "Cartão é obrigatório" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Envie o PDF" }, { status: 400 });
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "O arquivo precisa ser PDF" }, { status: 400 });
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: `PDF muito grande (máx ${(MAX_PDF_BYTES / 1024 / 1024).toFixed(0)}MB)` },
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

    const arrayBuffer = await file.arrayBuffer();
    const extraction = await extractTextFromPdf(new Uint8Array(arrayBuffer), password);

    if (extraction.needsPassword) {
      return NextResponse.json(
        {
          error: password
            ? "Senha incorreta para este PDF."
            : "Este PDF é protegido por senha. Informe a senha acima e tente de novo.",
          code: "needs_password",
        },
        { status: 422 }
      );
    }

    if (!extraction.text || extraction.text.trim().length < 30) {
      return NextResponse.json(
        {
          error:
            "Não consegui extrair texto do PDF (pode ser uma fatura digitalizada como imagem). Tente o modo 'Colar texto'.",
        },
        { status: 422 }
      );
    }

    const result = await parseInvoiceText(extraction.text, {
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
      stats: {
        pagesExtracted: extraction.pages,
        textChars: extraction.text.length,
        hintsUsed: hints.length,
      },
    });
  } catch (e: any) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    console.error("[financas/import/parse-pdf] error", e);
    return NextResponse.json(
      { error: "Erro ao analisar PDF: " + (e?.message || "desconhecido") },
      { status: 500 }
    );
  }
}

async function extractTextFromPdf(
  data: Uint8Array,
  password: string
): Promise<{ text?: string; pages?: number; needsPassword?: boolean }> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  try {
    const pdf = await getDocumentProxy(data, { password });
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    const combined = (Array.isArray(text) ? text : [text])
      .map((pageText, i) => `\n--- Página ${i + 1} ---\n${pageText}\n`)
      .join("");
    return { text: combined, pages: totalPages };
  } catch (err: any) {
    if (err?.name === "PasswordException") {
      return { needsPassword: true };
    }
    throw err;
  }
}
