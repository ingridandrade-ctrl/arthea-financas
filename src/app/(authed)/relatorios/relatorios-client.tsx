"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/financas/page-header";
import { formatCurrency } from "@/lib/utils";
import { IncomeExpenseLine, CategoryDonut } from "@/components/financas/charts";

type Report = {
  year: number;
  monthly: { month: number; income: number; expense: number; net: number }[];
  totals: {
    income: number;
    expense: number;
    net: number;
    avgMonthlyExpense: number;
    avgMonthlyIncome: number;
  };
  expensesByCategory: { categoryId: string | null; name: string; color: string; amount: number }[];
  accountSeries: { accountId: string; name: string; color: string; values: number[] }[];
};

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function RelatoriosClient() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/reports?year=${year}`);
    setData(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [year]);

  function exportCSV() {
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    window.location.href = `/api/export?from=${from}&to=${to}`;
  }

  if (loading || !data) {
    return (
      <div>
        <PageHeader title="Relatórios" description="Carregando..." />
      </div>
    );
  }

  const maxAccount = Math.max(
    ...data.accountSeries.flatMap((s) => s.values),
    1
  );

  const minAccount = Math.min(
    ...data.accountSeries.flatMap((s) => s.values),
    0
  );

  const totalCategoryExpense = data.expensesByCategory.reduce((s, c) => s + c.amount, 0);

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Visão anual: receitas, despesas, evolução das contas e categorias."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
            <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-1 py-1">
              <button onClick={() => setYear((y) => y - 1)} className="p-1.5 rounded hover:bg-muted">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium px-3">{year}</span>
              <button onClick={() => setYear((y) => y + 1)} className="p-1.5 rounded hover:bg-muted">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Kpi
          label="Receitas no ano"
          value={data.totals.income}
          subtext={`Média ${formatCurrency(data.totals.avgMonthlyIncome)}/mês`}
          tone="positive"
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <Kpi
          label="Despesas no ano"
          value={data.totals.expense}
          subtext={`Média ${formatCurrency(data.totals.avgMonthlyExpense)}/mês`}
          tone="negative"
          icon={<TrendingDown className="w-5 h-5" />}
        />
        <Kpi
          label="Resultado anual"
          value={data.totals.net}
          subtext={data.totals.net >= 0 ? "Você guardou" : "Você gastou a mais"}
          tone={data.totals.net >= 0 ? "positive" : "negative"}
          icon={<BarChart3 className="w-5 h-5" />}
        />
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold mb-4">Evolução mensal</h2>
        <IncomeExpenseLine
          data={data.monthly.map((m) => ({
            month: `${year}-${String(m.month).padStart(2, "0")}`,
            label: MONTH_SHORT[m.month - 1],
            income: m.income,
            expense: m.expense,
          }))}
          height={320}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Despesas por categoria (ano)</h2>
          {data.expensesByCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem despesas no período.</p>
          ) : (
            <>
              <CategoryDonut
                data={data.expensesByCategory.map((c) => ({
                  name: c.name,
                  amount: c.amount,
                  color: c.color,
                }))}
                size={220}
              />
              <ul className="mt-4 space-y-1 text-xs max-h-48 overflow-y-auto">
                {data.expensesByCategory.slice(0, 12).map((c) => {
                  const pct = totalCategoryExpense > 0 ? (c.amount / totalCategoryExpense) * 100 : 0;
                  return (
                    <li key={c.categoryId || "none"} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="truncate">{c.name}</span>
                      </span>
                      <span className="tabular-nums shrink-0">
                        {formatCurrency(c.amount)}{" "}
                        <span className="text-muted-foreground">({pct.toFixed(0)}%)</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Evolução de saldo das contas</h2>
          {data.accountSeries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem contas.</p>
          ) : (
            <AccountChart
              series={data.accountSeries}
              max={maxAccount}
              min={minAccount}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  subtext,
  tone,
  icon,
}: {
  label: string;
  value: number;
  subtext: string;
  tone: "positive" | "negative" | "neutral";
  icon: React.ReactNode;
}) {
  const c = tone === "positive" ? "text-success" : tone === "negative" ? "text-destructive" : "";
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${c}`}>{formatCurrency(value)}</p>
      <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
    </div>
  );
}

function AccountChart({
  series,
  max,
  min,
}: {
  series: { accountId: string; name: string; color: string; values: number[] }[];
  max: number;
  min: number;
}) {
  const W = 600;
  const H = 200;
  const padX = 30;
  const padY = 16;
  const range = Math.max(max - min, 1);
  const xStep = (W - padX * 2) / 11;

  function y(v: number) {
    return H - padY - ((v - min) / range) * (H - padY * 2);
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48">
          <line
            x1={padX}
            y1={y(0)}
            x2={W - padX}
            y2={y(0)}
            stroke="currentColor"
            strokeOpacity="0.1"
          />
          {MONTH_SHORT.map((m, i) => (
            <text
              key={m}
              x={padX + i * xStep}
              y={H - 2}
              fontSize="9"
              textAnchor="middle"
              fill="currentColor"
              fillOpacity="0.6"
            >
              {m}
            </text>
          ))}
          {series.map((s) => {
            const points = s.values
              .map((v, i) => `${padX + i * xStep},${y(v)}`)
              .join(" ");
            return (
              <polyline
                key={s.accountId}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                points={points}
              />
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-3 mt-3">
        {series.map((s) => (
          <div key={s.accountId} className="flex items-center gap-1.5 text-xs">
            <span className="w-3 h-0.5" style={{ backgroundColor: s.color }} />
            {s.name}
          </div>
        ))}
      </div>
    </div>
  );
}
