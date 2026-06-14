"use client";

import { useEffect, useState } from "react";
import { User, CreditCard, Tag } from "lucide-react";
import { PageHeader } from "@/components/financas/page-header";
import { FilterBar, FilterGroup, SegControl } from "@/components/financas/filters";
import { formatCurrency } from "@/lib/utils";
import { GroupedBars } from "@/components/financas/charts";

type CategoryAgg = {
  id: string | null;
  name: string;
  color: string;
  amount: number;
};

type AccountAgg = {
  id: string;
  name: string;
  color: string;
  type: string;
  amount: number;
};

type Bucket = {
  total: number;
  byCategory: CategoryAgg[];
  byAccount: AccountAgg[];
};

type Person = { own: Bucket; couple: Bucket; total: number };

type Data = {
  partnerAName: string;
  partnerBName: string;
  partnerA: Person;
  partnerB: Person;
};

type GroupBy = "category" | "account";

type Period = "this_month" | "last_month" | "year" | "all";

function rangeFor(p: Period): { from: string | null; to: string | null } {
  const now = new Date();
  if (p === "this_month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (p === "last_month") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (p === "year") {
    const from = new Date(now.getFullYear(), 0, 1);
    const to = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  return { from: null, to: null };
}

const PERIOD_LABEL: Record<Period, string> = {
  this_month: "Este mês",
  last_month: "Mês passado",
  year: "Este ano",
  all: "Tudo",
};

export function PorPessoaClient() {
  const [period, setPeriod] = useState<Period>("this_month");
  const cardGrouping = "fatura_month" as const;
  const [groupBy, setGroupBy] = useState<GroupBy>("category");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const { from, to } = rangeFor(period);
    const params = new URLSearchParams({ cardGrouping });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/per-person?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [period, cardGrouping]);

  return (
    <div>
      <PageHeader
        title="Por pessoa"
        description="Quanto cada um gastou: próprios + sua parte das despesas do casal."
      />

      {loading || !data ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <PersonCard
              name={data.partnerAName}
              person={data.partnerA}
              groupBy={groupBy}
              accentColor="var(--color-primary)"
            />
            <PersonCard
              name={data.partnerBName}
              person={data.partnerB}
              groupBy={groupBy}
              accentColor="#0ea5e9"
            />
          </div>

          <FilterBar>
            <FilterGroup label="Período">
              <SegControl
                value={period}
                onChange={(v) => setPeriod(v as Period)}
                options={(Object.keys(PERIOD_LABEL) as Period[]).map((p) => ({
                  value: p,
                  label: PERIOD_LABEL[p],
                }))}
              />
            </FilterGroup>

            <FilterGroup label="Agrupar por">
              <SegControl
                value={groupBy}
                onChange={(v) => setGroupBy(v)}
                options={[
                  { value: "category", label: "Categoria", icon: <Tag className="w-3.5 h-3.5" /> },
                  { value: "account", label: "Origem", icon: <CreditCard className="w-3.5 h-3.5" /> },
                ]}
              />
            </FilterGroup>
          </FilterBar>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-sm font-semibold">
                {data.partnerAName} vs {data.partnerBName}
              </h2>
              <p className="text-xs text-muted-foreground">
                Comparativo por {groupBy === "category" ? "categoria" : "origem"}
              </p>
            </div>
            <ComparisonChart data={data} groupBy={groupBy} />
          </div>
        </>
      )}
    </div>
  );
}

function ComparisonChart({
  data,
  groupBy,
}: {
  data: Data;
  groupBy: GroupBy;
}) {
  const aggregate = (bucket: Bucket) =>
    groupBy === "category"
      ? bucket.byCategory.map((c) => ({ key: c.id ?? "__none__", label: c.name, amount: c.amount }))
      : bucket.byAccount.map((a) => ({ key: a.id, label: a.name, amount: a.amount }));

  const aA = new Map<string, { label: string; amount: number }>();
  for (const it of [...aggregate(data.partnerA.own), ...aggregate(data.partnerA.couple)]) {
    const prev = aA.get(it.key);
    aA.set(it.key, { label: it.label, amount: (prev?.amount ?? 0) + it.amount });
  }
  const aB = new Map<string, { label: string; amount: number }>();
  for (const it of [...aggregate(data.partnerB.own), ...aggregate(data.partnerB.couple)]) {
    const prev = aB.get(it.key);
    aB.set(it.key, { label: it.label, amount: (prev?.amount ?? 0) + it.amount });
  }

  const keys = new Set<string>([...aA.keys(), ...aB.keys()]);
  const rows = Array.from(keys).map((k) => ({
    key: k,
    label: aA.get(k)?.label ?? aB.get(k)?.label ?? "—",
    [data.partnerAName]: aA.get(k)?.amount ?? 0,
    [data.partnerBName]: aB.get(k)?.amount ?? 0,
    _total: (aA.get(k)?.amount ?? 0) + (aB.get(k)?.amount ?? 0),
  }));

  rows.sort((x, y) => y._total - x._total);
  const top = rows.slice(0, 8);

  if (top.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Sem dados no período.</p>;
  }

  return (
    <GroupedBars
      data={top}
      series={[
        { key: data.partnerAName, name: data.partnerAName, color: "var(--color-primary)" },
        { key: data.partnerBName, name: data.partnerBName, color: "#94a3b8" },
      ]}
      layout="horizontal"
      height={Math.max(220, top.length * 36 + 60)}
    />
  );
}

function PersonCard({
  name,
  person,
  groupBy,
  accentColor,
}: {
  name: string;
  person: Person;
  groupBy: GroupBy;
  accentColor: string;
}) {
  const grand = person.total;
  const ownPct = grand > 0 ? (person.own.total / grand) * 100 : 0;
  const couplePct = grand > 0 ? (person.couple.total / grand) * 100 : 0;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div
        className="p-6 border-b border-border"
        style={{ background: `linear-gradient(135deg, ${accentColor}15 0%, transparent 60%)` }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}25` }}
          >
            <User className="w-6 h-6" style={{ color: accentColor }} />
          </div>
          <h2 className="text-xl font-bold">{name}</h2>
        </div>
        <p className="text-4xl font-bold tabular-nums mb-1">{formatCurrency(grand)}</p>
        <p className="text-xs text-muted-foreground">Total gasto no período</p>

        {grand > 0 && (
          <div className="mt-5 space-y-2">
            <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
              <div style={{ width: `${ownPct}%`, backgroundColor: accentColor }} />
              <div style={{ width: `${couplePct}%`, backgroundColor: "#cbd5e1" }} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
                <span className="text-muted-foreground">Próprios</span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(person.own.total)}
                </span>
                <span className="text-muted-foreground">({ownPct.toFixed(0)}%)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#cbd5e1" }} />
                <span className="text-muted-foreground">Sua parte do casal</span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(person.couple.total)}
                </span>
                <span className="text-muted-foreground">({couplePct.toFixed(0)}%)</span>
              </span>
            </div>
          </div>
        )}
      </div>

      <CombinedSection person={person} groupBy={groupBy} accentColor={accentColor} />
    </div>
  );
}

function CombinedSection({
  person,
  groupBy,
  accentColor,
}: {
  person: Person;
  groupBy: GroupBy;
  accentColor: string;
}) {
  const aggregate = (bucket: Bucket) =>
    groupBy === "category"
      ? bucket.byCategory.map((c) => ({
          key: c.id ?? "__none__",
          name: c.name,
          color: c.color,
          amount: c.amount,
        }))
      : bucket.byAccount.map((a) => ({
          key: a.id,
          name: a.name,
          color: a.color,
          amount: a.amount,
        }));

  const items = new Map<string, { name: string; color: string; own: number; couple: number }>();
  for (const it of aggregate(person.own)) {
    items.set(it.key, { name: it.name, color: it.color, own: it.amount, couple: 0 });
  }
  for (const it of aggregate(person.couple)) {
    const prev = items.get(it.key);
    if (prev) {
      prev.couple = it.amount;
    } else {
      items.set(it.key, { name: it.name, color: it.color, own: 0, couple: it.amount });
    }
  }

  const rows = Array.from(items.entries())
    .map(([key, v]) => ({ key, ...v, total: v.own + v.couple }))
    .sort((a, b) => b.total - a.total);

  const max = rows.reduce((m, r) => Math.max(m, r.total), 0);

  if (rows.length === 0) {
    return (
      <div className="p-5 text-xs text-muted-foreground italic text-center">
        Sem despesas no período.
      </div>
    );
  }

  return (
    <div className="p-5 space-y-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
        Detalhe por {groupBy === "category" ? "categoria" : "origem"}
      </p>
      {rows.map((r) => {
        const ownPct = max > 0 ? (r.own / max) * 100 : 0;
        const couplePct = max > 0 ? (r.couple / max) * 100 : 0;
        return (
          <div key={r.key}>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: r.color }}
                />
                <span className="truncate">{r.name}</span>
              </span>
              <span className="tabular-nums font-semibold shrink-0">
                {formatCurrency(r.total)}
              </span>
            </div>
            <div className="flex h-1.5 rounded-full bg-muted overflow-hidden">
              <div style={{ width: `${ownPct}%`, backgroundColor: accentColor }} />
              <div style={{ width: `${couplePct}%`, backgroundColor: "#cbd5e1" }} />
            </div>
            {(r.own > 0 || r.couple > 0) && (
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                {r.own > 0 ? (
                  <span>Próprio {formatCurrency(r.own)}</span>
                ) : (
                  <span />
                )}
                {r.couple > 0 && <span>Casal {formatCurrency(r.couple)}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

