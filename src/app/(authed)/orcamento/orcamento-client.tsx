"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/components/financas/toaster";
import { PageHeader } from "@/components/financas/page-header";
import { capFirst, formatCurrency } from "@/lib/utils";
import { PageSkeleton } from "@/components/financas/page-skeleton";

type BudgetItem = {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  planned: number;
  actual: number;
  remaining: number;
  isOverride: boolean;
};

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/** "1.234,56" / "1234.56" / "1234,5" → número. Vazio vira 0 (sem limite). */
function parseAmount(text: string): number | null {
  const t = text.trim();
  if (!t) return 0;
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function amountText(value: number): string {
  return value ? value.toFixed(2).replace(".", ",") : "";
}

export function OrcamentoClient() {
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [month, setMonth] = useState(thisMonth());
  const [defaultMode, setDefaultMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // silent: recarrega os números sem trocar a tela pelo esqueleto (depois de
  // salvar um limite, a lista não pode "piscar").
  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const url = defaultMode ? "/api/budgets" : `/api/budgets?month=${month}`;
      const res = await fetch(url);
      const data = await res.json();
      setItems(data.items || []);
      if (!silent) setDrafts({});
    } catch {
      toast.error("Não deu pra carregar o orçamento. Confira a conexão e tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [month, defaultMode]);

  // O limite salva sozinho ao sair do campo (ou no Enter). Antes cada
  // categoria tinha o seu botão "Salvar" — quinze botões numa tela só.
  async function commit(item: BudgetItem) {
    const draft = drafts[item.categoryId];
    if (draft === undefined) return;
    const value = parseAmount(draft);
    const clearDraft = () =>
      setDrafts((d) => {
        const next = { ...d };
        delete next[item.categoryId];
        return next;
      });
    if (value === null) {
      toast.error("Valor inválido. Use só números, como 1500 ou 1.500,00.");
      clearDraft();
      return;
    }
    if (Math.abs(value - item.planned) < 0.005) {
      clearDraft();
      return;
    }
    setSaving(item.categoryId);
    try {
      const res = await fetch("/api/budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: item.categoryId,
          amount: value,
          month: defaultMode ? null : month,
        }),
      });
      if (!res.ok) throw new Error();
      await load(true);
      toast.success(
        value === 0 ? `Limite de ${item.categoryName} removido` : `Limite de ${item.categoryName} salvo`
      );
    } catch {
      toast.error("Não deu pra salvar o limite. Tente de novo.");
    } finally {
      clearDraft();
      setSaving(null);
    }
  }

  // Só as categorias COM limite entram na conta de "sobra". Gasto em categoria
  // sem limite aparecia como estouro do orçamento inteiro.
  const withLimit = items.filter((i) => i.planned > 0);
  const totalPlanned = withLimit.reduce((s, i) => s + i.planned, 0);
  const totalActual = withLimit.reduce((s, i) => s + i.actual, 0);
  const actualNoLimit = items.filter((i) => i.planned <= 0).reduce((s, i) => s + i.actual, 0);
  const overCount = withLimit.filter((i) => i.actual > i.planned).length;
  const totalPct = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;

  // Quem mais consumiu do limite vem primeiro; depois quem gastou sem limite;
  // por último as categorias paradas.
  const sorted = defaultMode
    ? items
    : [...items].sort((a, b) => {
        const rank = (i: BudgetItem) => (i.planned > 0 ? 0 : i.actual > 0 ? 1 : 2);
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        if (rank(a) === 0) return b.actual / b.planned - a.actual / a.planned;
        if (rank(a) === 1) return b.actual - a.actual;
        return a.categoryName.localeCompare(b.categoryName, "pt-BR");
      });

  return (
    <div>
      <PageHeader
        title="Orçamento mensal"
        description="Defina um limite por categoria e veja quanto já foi."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-1 py-1">
              <button
                onClick={() => setDefaultMode(false)}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  !defaultMode ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                Acompanhar o mês
              </button>
              <button
                onClick={() => setDefaultMode(true)}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  defaultMode ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                Limites padrão
              </button>
            </div>
            {!defaultMode && (
              <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-1 py-1">
                <button
                  onClick={() => setMonth(shiftMonth(month, -1))}
                  aria-label="Mês anterior"
                  className="p-1.5 rounded hover:bg-muted"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium px-2">{capFirst(monthLabel(month))}</span>
                <button
                  onClick={() => setMonth(shiftMonth(month, 1))}
                  aria-label="Próximo mês"
                  className="p-1.5 rounded hover:bg-muted"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        }
      />

      {defaultMode ? (
        <p className="mb-4 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Estes limites valem para todos os meses. Um mês que precisar de um valor diferente pode
          ser ajustado em "Acompanhar o mês", sem mexer no padrão.
        </p>
      ) : (
        !loading &&
        items.length > 0 && (
          <div className="mb-4 rounded-2xl border border-border bg-card p-5">
            {totalPlanned > 0 ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {totalActual > totalPlanned ? "Passou do orçamento em" : "Ainda dá pra gastar"}
                    </p>
                    <p
                      className={`text-3xl font-bold tabular-nums ${
                        totalActual > totalPlanned ? "text-destructive" : "text-success"
                      }`}
                    >
                      {formatCurrency(Math.abs(totalPlanned - totalActual))}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {formatCurrency(totalActual)} de {formatCurrency(totalPlanned)} ·{" "}
                    {Math.round(totalPct)}%
                  </p>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`grow-x h-full rounded-full ${barTone(totalPct)}`}
                    style={{ width: `${Math.min(totalPct, 100)}%` }}
                  />
                </div>
                {(overCount > 0 || actualNoLimit > 0) && (
                  <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {overCount > 0 && (
                      <span className="text-destructive">
                        {overCount === 1
                          ? "1 categoria passou do limite"
                          : `${overCount} categorias passaram do limite`}
                      </span>
                    )}
                    {actualNoLimit > 0 && (
                      <span>
                        Mais {formatCurrency(actualNoLimit)} em categorias sem limite (fora desta conta)
                      </span>
                    )}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum limite definido ainda. Digite um valor em "Limite" nas categorias abaixo: ele
                salva sozinho e a barra de acompanhamento aparece.
              </p>
            )}
          </div>
        )
      )}

      {loading ? (
        <PageSkeleton />
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <p className="text-sm text-muted-foreground">
            Crie categorias de despesa primeiro para definir o orçamento.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {sorted.map((item) => {
            const pct = item.planned > 0 ? (item.actual / item.planned) * 100 : 0;
            const over = item.planned > 0 && item.actual > item.planned;
            return (
              <div key={item.categoryId} className="px-4 py-3.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span
                    className="w-3 h-3 shrink-0 rounded-full"
                    style={{ backgroundColor: item.categoryColor }}
                  />
                  <span className="font-medium">{item.categoryName}</span>
                  {item.isOverride && !defaultMode && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      ajuste do mês
                    </span>
                  )}
                  <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                    Limite
                    <span className="relative">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
                        R$
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="sem limite"
                        aria-label={`Limite de ${item.categoryName}`}
                        disabled={saving === item.categoryId}
                        value={drafts[item.categoryId] ?? amountText(item.planned)}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [item.categoryId]: e.target.value }))
                        }
                        onBlur={() => commit(item)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        className="w-32 rounded-lg border border-border bg-background py-1.5 pl-8 pr-2.5 text-right text-sm tabular-nums text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                      />
                    </span>
                  </label>
                </div>

                {!defaultMode && (item.planned > 0 || item.actual > 0) && (
                  <div className="mt-2.5">
                    {item.planned > 0 && (
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${barTone(pct)}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    )}
                    <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs tabular-nums">
                      <span className="text-muted-foreground">
                        {formatCurrency(item.actual)} gastos
                        {item.planned > 0 && ` · ${Math.round(pct)}%`}
                      </span>
                      {item.planned > 0 ? (
                        <span className={over ? "font-medium text-destructive" : "text-muted-foreground"}>
                          {over
                            ? `Passou ${formatCurrency(item.actual - item.planned)}`
                            : `Sobram ${formatCurrency(item.planned - item.actual)}`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Cor da barra: verde folgado, amarelo perto do limite, vermelho estourado. */
function barTone(pct: number): string {
  if (pct > 100) return "bg-destructive";
  if (pct >= 85) return "bg-warning";
  return "bg-primary";
}
