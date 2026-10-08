import { prisma } from "@/lib/prisma";
import type { MerchantHint } from "./parse-invoice";
import { normalizeBase } from "./installments";

const STOPWORDS = new Set([
  "de", "da", "do", "e", "ltda", "me", "sa", "s.a", "s/a", "eireli", "comercio",
  "comercial", "servicos", "serviços", "ind", "industria", "indústria", "br", "brasil",
]);

function tokenize(description: string): string[] {
  return description
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s.]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// Chave de "mesmo estabelecimento". Tira o sufixo de parcela ANTES de
// tokenizar — sem isso "LOJA X 04/10" e "LOJA X 05/10" viravam chaves
// diferentes ("loja 04" / "loja 05"), cada uma com 1 ocorrência, e
// parcelamento nunca entrava no histórico.
export function merchantKey(description: string): string | null {
  const ascii = description.normalize("NFD").replace(/\p{M}+/gu, "");
  const tokens = tokenize(normalizeBase(ascii));
  if (tokens.length === 0) return null;
  return tokens.slice(0, 2).join(" ");
}

function modeWithCount<T>(items: T[]): { value: T; count: number } | null {
  if (items.length === 0) return null;
  const counts = new Map<T, number>();
  for (const it of items) {
    counts.set(it, (counts.get(it) ?? 0) + 1);
  }
  let best: { value: T; count: number } | null = null;
  for (const [value, count] of counts.entries()) {
    if (!best || count > best.count) best = { value, count };
  }
  return best;
}

export async function getMerchantHints(householdId: string): Promise<MerchantHint[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - 12);

  // Sem o filtro de categoria: uma compra que a usuária só marcou como
  // "Casal" (sem categoria) também ensina o dono.
  const transactions = await prisma.finTransaction.findMany({
    where: {
      householdId,
      type: "EXPENSE",
      date: { gte: since },
    },
    select: {
      description: true,
      owner: true,
      categoryId: true,
      category: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
    take: 1000,
  });

  const grouped = new Map<
    string,
    { categoryIds: string[]; categoryNames: string[]; owners: string[] }
  >();

  for (const tx of transactions) {
    const p = merchantKey(tx.description);
    if (!p) continue;
    const bucket = grouped.get(p) ?? { categoryIds: [], categoryNames: [], owners: [] };
    if (tx.categoryId) bucket.categoryIds.push(tx.categoryId);
    if (tx.category?.name) bucket.categoryNames.push(tx.category.name);
    bucket.owners.push(tx.owner);
    grouped.set(p, bucket);
  }

  const hints: MerchantHint[] = [];
  for (const [pattern, bucket] of grouped.entries()) {
    if (bucket.owners.length < 2) continue;
    const cat = modeWithCount(bucket.categoryIds);
    const catName = modeWithCount(bucket.categoryNames);
    const own = modeWithCount(bucket.owners);
    if (!own) continue;
    hints.push({
      pattern,
      categoryId: cat?.value ?? null,
      categoryName: catName?.value ?? null,
      owner: own.value as MerchantHint["owner"],
      occurrences: bucket.owners.length,
    });
  }

  hints.sort((a, b) => b.occurrences - a.occurrences);
  // O prompt usa só os 80 primeiros; a aplicação determinística
  // (import-history) usa todos.
  return hints.slice(0, 500);
}
