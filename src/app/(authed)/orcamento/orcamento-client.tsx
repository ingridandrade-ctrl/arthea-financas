"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { PageHeader } from "@/components/financas/page-header";
import { formatCurrency } from "@/lib/utils";

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

export function OrcamentoClient() {
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [month, setMonth] = useState(thisMonth());
  const [defaultMode, setDefaultMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const url = defaultMode
      ? "/api/budgets"
      : `/api/budgets?month=${month}`;
    const res = await fetch(url);
    const data = await res.json();
    setItems(data.items || []);
    setDrafts({});
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [month, defaultMode]);

  async function save(item: BudgetItem) {
    const draft = drafts[item.categoryId];
    const value = parseFloat((draft ?? "").replace(",", "."));
    if (!Number.isFinite(value) || value < 0) return;
    setSaving(item.categoryId);
    await fetch("/api/budgets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: item.categoryId,
        amount: value,
        month: defaultMode ? null : month,
      }),
    });
    setSaving(null);
    load();
  }

  const totalPlanned = items.reduce((s, i) => s + i.planned, 0);
  const totalActual = items.reduce((s, i) => s + i.actual, 0);
  const overBudgetItems = items.filter((i) => i.planned > 0 && i.actual > i.planned);

  return (
    <div>
      <PageHeader
        title="Orçamento mensal"
        description="Defina quanto pretende gastar em cada categoria e acompanhe o realizado."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-1 py-1">
              <button
                onClick={() => setDefaultMode(false)}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  !defaultMode ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                Mês específico
              </button>
              <button
                onClick={() => setDefaultMode(true)}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  defaultMode ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                Padrão (todo mês)
              </button>
            </div>
            {!defaultMode && (
              <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-1 py-1">
                <button onClick={() => setMonth(shiftMonth(month, -1))} className="p-1.5 rounded hover:bg-muted">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium px-2 capitalize">{monthLabel(month)}</span>
                <button onClick={() => setMonth(shiftMonth(month, 1))} className="p-1.5 rounded hover:bg-muted">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        }
      />

      {!defaultMode && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <SummaryCard label="Planejado" value={totalPlanned} />
          <SummaryCard label="Realizado" value={totalActual} />
          <SummaryCard
            label="Diferença"
            value={totalPlanned - totalActual}
            tone={totalPlanned - totalActual >= 0 ? "good" : "bad"}
          />
        </div>
      )}

      {!defaultMode && overBudgetItems.length > 0 && (
        <div className="mb-4 bg-destructive/5 border border-destructive/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <span className="text-destructive font-bold">!</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold mb-1">
                {overBudgetItems.length === 1
                  ? "1 categoria estourou o orçamento"
                  : `${overBudgetItems.length} categorias estouraram o orçamento`}
              </p>
              <ul className="flex flex-wrap gap-1.5 text-xs">
                {overBudgetItems.map((b) => {
                  const over = b.actual - b.planned;
                  return (
                    <li
                      key={b.categoryId}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-card border border-destructive/30"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: b.categoryColor }}
                      />
                      <span>{b.categoryName}</span>
                      <span className="text-destructive tabular-nums font-medium">
                        +{formatCurrency(over)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <p className="text-sm text-muted-foreground">
            Crie categorias de despesa primeiro para definir o orçamento.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {items.map((item) => {
            const usagePct = item.planned > 0 ? Math.min((item.actual / item.planned) * 100, 100) : 0;
            const overBudget = item.planned > 0 && item.actual > item.planned;
            return (
              <div key={item.categoryId} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.categoryColor }}
                    />
                    <span className="font-medium">{item.categoryName}</span>
                    {item.isOverride && !defaultMode && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        ajuste do mês
                      </span>
                    )}
                  </div>
                  {!defaultMode && (
                    <span className={`text-sm tabular-nums ${overBudget ? "text-destructive" : "text-muted-foreground"}`}>
                      {formatCurrency(item.actual)} / {formatCurrency(item.planned)}
                    </span>
                  )}
                </div>

                {!defaultMode && item.planned > 0 && (
                  <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full ${overBudget ? "bg-destructive" : ""}`}
                      style={{
                        width: `${usagePct}%`,
                        backgroundColor: overBudget ? undefined : item.categoryColor,
                      }}
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
              step="0.01"
                    min="0"
                    placeholder={item.planned ? item.planned.toString() : "0,00"}
                    value={drafts[item.categoryId] ?? ""}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [item.categoryId]: e.target.value }))
                    }
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                  <button
                    disabled={!drafts[item.categoryId] || saving === item.categoryId}
                    onClick={() => save(item)}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Salvar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good" | "bad";
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-xl font-bold mt-1 tabular-nums ${
          tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : ""
        }`}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}
