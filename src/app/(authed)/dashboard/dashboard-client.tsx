"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { PageHeader } from "@/components/financas/page-header";
import {
  FilterBar,
  FilterGroup,
  SegControl,
  MonthStepper,
} from "@/components/financas/filters";
import { formatCurrency } from "@/lib/utils";
import { ACCOUNT_TYPE_LABEL } from "@/lib/financas/defaults";
import { CategoryDonut, IncomeExpenseLine, Sparkline, PercentChange } from "@/components/financas/charts";

type DashboardData = {
  household: { partnerAName: string; partnerBName: string; currency: string; hideBalances: boolean };
  period: { year: number; month: number; label: string };
  totals: { balance: number; income: number; expense: number; net: number };
  previous: { income: number; expense: number; net: number };
  dailyExpense: { day: string; amount: number }[];
  accounts: {
    id: string;
    name: string;
    type: keyof typeof ACCOUNT_TYPE_LABEL;
    color: string;
    balance: number;
  }[];
  expensesByCategory: {
    categoryId: string | null;
    name: string;
    color: string;
    amount: number;
  }[];
  byOwner: Record<string, { income: number; expense: number }>;
  monthlySeries: { month: string; income: number; expense: number }[];
};

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [month, setMonth] = useState(thisMonth());
  const cardGrouping = "fatura_month" as const;
  const [ownerFilter, setOwnerFilter] = useState<"all" | "PARTNER_A" | "PARTNER_B" | "COUPLE">(
    "all"
  );
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ month, cardGrouping });
    if (ownerFilter !== "all") params.set("owner", ownerFilter);
    const res = await fetch(`/api/dashboard?${params.toString()}`);
    const d = await res.json();
    setData(d);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [month, cardGrouping, ownerFilter]);

  useEffect(() => {
    function onFocus() {
      load();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [month, cardGrouping, ownerFilter]);

  if (loading || !data) {
    return (
      <div>
        <PageHeader title="Visão geral" description="Carregando..." />
      </div>
    );
  }

  const totalExpenseInCategories = data.expensesByCategory.reduce(
    (acc, c) => acc + c.amount,
    0
  );

  return (
    <div>
      <PageHeader
        title={`Olá, ${data.household.partnerAName} & ${data.household.partnerBName}`}
        description="Visão geral das finanças do casal."
      />

      <FilterBar>
        <FilterGroup label="Mês">
          <MonthStepper
            monthLabel={data.period.label}
            onPrev={() => setMonth(shiftMonth(month, -1))}
            onNext={() => setMonth(shiftMonth(month, 1))}
            onToday={() => setMonth(thisMonth())}
          />
        </FilterGroup>

        <FilterGroup label="Pessoa">
          <SegControl
            value={ownerFilter}
            onChange={(v) => setOwnerFilter(v)}
            options={[
              { value: "all", label: "Todos" },
              { value: "COUPLE", label: "Casal" },
              { value: "PARTNER_A", label: data.household.partnerAName },
              { value: "PARTNER_B", label: data.household.partnerBName },
            ]}
          />
        </FilterGroup>

        <FilterGroup label="Modo">
          <button
            onClick={async () => {
              await fetch("/api/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hideBalances: !data.household.hideBalances }),
              });
              load();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border hover:bg-muted text-xs font-medium"
            title={
              data.household.hideBalances
                ? "Mostrar saldos e receitas"
                : "Esconder saldos e receitas (só despesas)"
            }
          >
            {data.household.hideBalances ? (
              <>
                <EyeOff className="w-3.5 h-3.5" /> Só despesas
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" /> Mostrar tudo
              </>
            )}
          </button>
        </FilterGroup>
      </FilterBar>

      <div
        className={`grid grid-cols-1 md:grid-cols-2 ${
          data.household.hideBalances ? "lg:grid-cols-1" : "lg:grid-cols-4"
        } gap-4 mb-6`}
      >
        {!data.household.hideBalances && (
          <KpiCard
            icon={<Wallet className="w-5 h-5" />}
            label="Saldo total"
            value={data.totals.balance}
            tone={data.totals.balance >= 0 ? "neutral" : "negative"}
          />
        )}
        {!data.household.hideBalances && (
          <KpiCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Receitas do mês"
            value={data.totals.income}
            tone="positive"
            previous={data.previous?.income}
          />
        )}
        <KpiCard
          icon={<TrendingDown className="w-5 h-5" />}
          label="Despesas do mês"
          value={data.totals.expense}
          tone="negative"
          previous={data.previous?.expense}
          invertChangeColors
          sparkData={data.dailyExpense}
          sparkColor="var(--color-destructive)"
        />
        {!data.household.hideBalances && (
          <KpiCard
            icon={<ArrowLeftRight className="w-5 h-5" />}
            label="Resultado do mês"
            value={data.totals.net}
            tone={data.totals.net >= 0 ? "positive" : "negative"}
            previous={data.previous?.net}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Últimos 6 meses</h2>
          <IncomeExpenseLine
            data={data.monthlySeries}
            hideIncome={data.household.hideBalances}
          />
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Por dono (mês atual)</h2>
          <OwnerRow
            label={data.household.partnerAName}
            data={data.byOwner.PARTNER_A}
            hideIncome={data.household.hideBalances}
          />
          <OwnerRow
            label={data.household.partnerBName}
            data={data.byOwner.PARTNER_B}
            hideIncome={data.household.hideBalances}
          />
          <OwnerRow
            label="Casal"
            data={data.byOwner.COUPLE}
            last
            hideIncome={data.household.hideBalances}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">
            Despesas por categoria
          </h2>
          {data.expensesByCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma despesa neste mês.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <CategoryDonut
                data={data.expensesByCategory.map((c) => ({
                  name: c.name,
                  amount: c.amount,
                  color: c.color,
                }))}
                size={200}
              />
              <ul className="space-y-1.5 text-xs">
                {data.expensesByCategory.slice(0, 8).map((c) => {
                  const pct =
                    totalExpenseInCategories > 0
                      ? (c.amount / totalExpenseInCategories) * 100
                      : 0;
                  return (
                    <li key={c.categoryId || "none"} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: c.color }}
                        />
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
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Suas contas</h2>
            <Link
              href="/contas"
              className="text-xs text-primary hover:underline"
            >
              Gerenciar
            </Link>
          </div>
          {data.accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta.</p>
          ) : (
            <div className="space-y-3">
              {data.accounts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: a.color }}
                    />
                    <div>
                      <p className="text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ACCOUNT_TYPE_LABEL[a.type]}
                      </p>
                    </div>
                  </div>
                  {!data.household.hideBalances && (
                    <p
                      className={`text-sm font-semibold tabular-nums ${
                        a.balance < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {formatCurrency(a.balance)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
  previous,
  invertChangeColors,
  sparkData,
  sparkColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "positive" | "negative" | "neutral";
  previous?: number;
  invertChangeColors?: boolean;
  sparkData?: { day: string; amount: number }[];
  sparkColor?: string;
}) {
  const color =
    tone === "positive"
      ? "text-success"
      : tone === "negative"
      ? "text-destructive"
      : "";
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <p className={`text-2xl font-bold tabular-nums ${color}`}>
          {formatCurrency(value)}
        </p>
        {previous !== undefined && (
          <PercentChange current={value} previous={previous} invertColors={invertChangeColors} />
        )}
      </div>
      {sparkData && sparkData.length > 0 && (
        <div className="mt-2 -mx-1">
          <Sparkline data={sparkData} color={sparkColor} height={36} />
        </div>
      )}
    </div>
  );
}

function OwnerRow({
  label,
  data,
  last,
  hideIncome,
}: {
  label: string;
  data: { income: number; expense: number };
  last?: boolean;
  hideIncome?: boolean;
}) {
  return (
    <div className={`py-3 ${!last ? "border-b border-border" : ""}`}>
      <p className="text-sm font-medium mb-1">{label}</p>
      <div className="flex justify-between text-xs">
        {!hideIncome && (
          <span className="text-success tabular-nums">
            + {formatCurrency(data.income)}
          </span>
        )}
        <span
          className={`text-destructive tabular-nums ${hideIncome ? "ml-auto" : ""}`}
        >
          − {formatCurrency(data.expense)}
        </span>
      </div>
    </div>
  );
}

