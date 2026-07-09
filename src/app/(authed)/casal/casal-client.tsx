"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "@/components/financas/toaster";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { Plus, Trash2, ArrowRight, Users, Scale, HandCoins, TrendingDown, BarChart3, Receipt, Copy, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/financas/page-header";
import { formatCurrency } from "@/lib/utils";
import { CategoryDonut, IncomeExpenseLine } from "@/components/financas/charts";

type Settings = { partnerAName: string; partnerBName: string };

type Settlement = {
  id: string;
  amount: number;
  fromOwner: "PARTNER_A" | "PARTNER_B";
  toOwner: "PARTNER_A" | "PARTNER_B";
  date: string;
  notes: string | null;
  periodStart: string | null;
  periodEnd: string | null;
};

type Contribution = {
  id: string;
  date: string;
  description: string;
  totalAmount: number;
  contributionAmount: number;
  kind: "couple" | "direct" | "invoice";
  itemCount?: number;
  category: { id: string; name: string; color: string } | null;
};

type Balance = {
  netBalance: number;
  whoOwes: "PARTNER_A" | "PARTNER_B" | null;
  amount: number;
  details: {
    aPaidForCouple: number;
    bPaidForCouple: number;
    aPaidForB: number;
    bPaidForA: number;
    settlementsAtoB: number;
    settlementsBtoA: number;
  };
  contributions: {
    aOwesB: Contribution[];
    bOwesA: Contribution[];
  };
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type DashboardLite = {
  totals: { income: number; expense: number };
  expensesByCategory: { name: string; color: string; amount: number }[];
  monthlySeries: { month: string; income: number; expense: number }[];
};

export function CasalClient() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [dash, setDash] = useState<DashboardLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  type Preset = "this_month" | "last_month" | "last_3" | "year" | "all" | "custom";
  const [preset, setPreset] = useState<Preset>("this_month");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const pad = (n: number) => String(n).padStart(2, "0");
  const isoDay = (d: Date) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

  function getRange(): { from: string | null; to: string | null } {
    const now = new Date();
    const y = now.getUTCFullYear();
    const mo = now.getUTCMonth();
    if (preset === "all") return { from: null, to: null };
    if (preset === "this_month") {
      return {
        from: isoDay(new Date(Date.UTC(y, mo, 1))),
        to: isoDay(new Date(Date.UTC(y, mo + 1, 0))),
      };
    }
    if (preset === "last_month") {
      return {
        from: isoDay(new Date(Date.UTC(y, mo - 1, 1))),
        to: isoDay(new Date(Date.UTC(y, mo, 0))),
      };
    }
    if (preset === "last_3") {
      return {
        from: isoDay(new Date(Date.UTC(y, mo - 2, 1))),
        to: isoDay(new Date(Date.UTC(y, mo + 1, 0))),
      };
    }
    if (preset === "year") {
      return {
        from: `${y}-01-01`,
        to: isoDay(new Date(Date.UTC(y, mo + 1, 0))),
      };
    }
    // custom — só filtra se ambas as datas válidas; senão trata como "all"
    if (customFrom && customTo && customFrom <= customTo) {
      return { from: customFrom, to: customTo };
    }
    return { from: null, to: null };
  }

  const range = getRange();
  const filtered = range.from !== null && range.to !== null;
  const periodLabel =
    preset === "all"
      ? "no total"
      : preset === "this_month"
      ? "deste mês"
      : preset === "last_month"
      ? "do mês passado"
      : preset === "last_3"
      ? "dos últimos 3 meses"
      : preset === "year"
      ? "deste ano"
      : "do período";

  async function load() {
    setLoading(true);
    const { from, to } = range;
    const qs = filtered ? `?from=${from}&to=${to}` : "";
    const settlementUrl = `/api/settlements${qs}`;
    const dashUrl = `/api/dashboard?owner=COUPLE${qs ? `&from=${from}&to=${to}` : ""}`;
    const [s, d, dashRes] = await Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch(settlementUrl).then((r) => r.json()),
      fetch(dashUrl).then((r) => r.json()),
    ]);
    setSettings(s);
    setSettlements(d.settlements || []);
    setBalance(d.balance);
    setDash({
      totals: dashRes.totals,
      expensesByCategory: dashRes.expensesByCategory || [],
      monthlySeries: dashRes.monthlySeries || [],
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [preset, customFrom, customTo]);

  async function remove(id: string) {
    const ok = await confirmDialog({ title: "Excluir este acerto?", variant: "destructive", confirmLabel: "Excluir" }); if (!ok) return;
    const res = await fetch(`/api/settlements/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Acerto excluído");
    } else {
      toast.error("Erro ao excluir");
    }
    load();
  }

  async function copyAmount(amount: number) {
    try {
      await navigator.clipboard.writeText(amount.toFixed(2).replace(".", ","));
      toast.success(`R$ ${amount.toFixed(2).replace(".", ",")} copiado`);
    } catch {
      toast.error("Não consegui copiar — copia na mão.");
    }
  }

  const ownerName = (o: "PARTNER_A" | "PARTNER_B") =>
    o === "PARTNER_A" ? settings?.partnerAName ?? "A" : settings?.partnerBName ?? "B";

  return (
    <div>
      <PageHeader
        title="Casal"
        description="Análise dos gastos do casal e acertos entre vocês."
        actions={
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Registrar acerto
          </button>
        }
      />

      <div className="mb-4 p-3 bg-muted/30 border border-border rounded-lg space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mr-1">
            Período
          </span>
          {(
            [
              { key: "this_month", label: "Este mês" },
              { key: "last_month", label: "Mês passado" },
              { key: "last_3", label: "Últimos 3 meses" },
              { key: "year", label: "Este ano" },
              { key: "all", label: "Tudo" },
              { key: "custom", label: "Personalizado" },
            ] as { key: Preset; label: string }[]
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPreset(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                preset === opt.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                De
              </label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2 py-1.5 rounded border border-border bg-background text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                Até
              </label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2 py-1.5 rounded border border-border bg-background text-sm"
              />
            </div>
            {customFrom && customTo && customFrom > customTo && (
              <p className="text-xs text-destructive mb-1.5">
                A data inicial precisa ser anterior à final.
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {filtered ? (
            <>
              Mostrando de <strong>{new Date(range.from + "T00:00:00").toLocaleDateString("pt-BR")}</strong>{" "}
              a <strong>{new Date(range.to + "T00:00:00").toLocaleDateString("pt-BR")}</strong>. Filtra Saldo, Origem dos repasses e Histórico.
            </>
          ) : (
            <>Mostrando <strong>todo o histórico</strong>. Filtra Saldo, Origem dos repasses e Histórico.</>
          )}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <>
          {/* === SALDO HERO (no topo, ação primária) === */}
          {balance && (() => {
            const net = balance.netBalance;
            const isSettled = Math.abs(net) < 0.01;
            const debtor = net < 0 ? "PARTNER_A" : "PARTNER_B";
            const creditor = net < 0 ? "PARTNER_B" : "PARTNER_A";
            const owed = Math.abs(net);
            return (
              <div
                className="rounded-2xl border-2 border-primary/20 p-6 mb-6 shadow-sm"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in srgb, var(--color-brand) 10%, var(--color-card)) 0%, var(--color-card) 70%)",
                }}
              >
                {isSettled ? (
                  <div className="text-center py-2">
                    <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-2" />
                    <p className="text-xl font-display tracking-tight">Tudo certo!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Ninguém deve nada{filtered ? ` ${periodLabel}` : ""}.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                      Saldo {filtered ? periodLabel : "total"}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap mb-3">
                      <span className="text-lg font-medium">{ownerName(debtor)}</span>
                      <ArrowRight className="w-5 h-5 text-muted-foreground" />
                      <span className="text-lg font-medium">{ownerName(creditor)}</span>
                    </div>
                    <p className="text-4xl font-bold text-primary tabular-nums mb-4 font-display">
                      {formatCurrency(owed)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setCreating(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 font-medium text-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Já paguei — registrar acerto
                      </button>
                      <button
                        onClick={() => copyAmount(owed)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm"
                      >
                        <Copy className="w-4 h-4" />
                        Copiar valor
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* === Composição compacta — só linhas com valor > 0 === */}
          {balance && (() => {
            const a = ownerName("PARTNER_A");
            const b = ownerName("PARTNER_B");
            const rows = [
              { label: `${a} pagou pelo casal`, value: balance.details.aPaidForCouple },
              { label: `${b} pagou pelo casal`, value: balance.details.bPaidForCouple },
              { label: `${a} pagou por ${b}`, value: balance.details.aPaidForB },
              { label: `${b} pagou por ${a}`, value: balance.details.bPaidForA },
              { label: `Acertos ${a} → ${b}`, value: balance.details.settlementsAtoB, divider: true },
              { label: `Acertos ${b} → ${a}`, value: balance.details.settlementsBtoA },
            ].filter((r) => r.value > 0.005);
            if (rows.length === 0) return null;
            return (
              <details className="bg-card border border-border rounded-xl mb-6 group">
                <summary className="px-5 py-3 cursor-pointer flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground select-none">
                  <HandCoins className="w-4 h-4" />
                  Como chegamos nesse saldo
                  <span className="ml-auto text-xs group-open:hidden">expandir</span>
                  <span className="ml-auto text-xs hidden group-open:inline">recolher</span>
                </summary>
                <ul className="space-y-2 text-sm p-5 pt-0">
                  {rows.map((r, i) => (
                    <li
                      key={i}
                      className={`flex justify-between ${r.divider ? "border-t border-border pt-2 mt-2" : ""}`}
                    >
                      <span className="text-muted-foreground">{r.label}</span>
                      <span className="tabular-nums">{formatCurrency(r.value)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })()}

          {dash && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Visão geral do casal
                </h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                <div className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">
                      Despesas {filtered ? periodLabel : "totais"} (casal)
                    </p>
                    <TrendingDown className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-destructive">
                    {formatCurrency(dash.totals.expense)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Soma de tudo que vocês dois gastaram juntos
                  </p>
                </div>

                <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold mb-3">Últimos 6 meses</h3>
                  <IncomeExpenseLine data={dash.monthlySeries} height={180} />
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-5 mb-6">
                <h3 className="text-sm font-semibold mb-3">
                  Despesas {filtered ? periodLabel : "totais"} por categoria
                </h3>
                {dash.expensesByCategory.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Nenhuma despesa {filtered ? periodLabel : "registrada"}.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <CategoryDonut
                      data={dash.expensesByCategory.map((c) => ({
                        name: c.name,
                        amount: c.amount,
                        color: c.color,
                      }))}
                      size={220}
                    />
                    <ul className="space-y-1 text-xs max-h-56 overflow-y-auto">
                      {dash.expensesByCategory.slice(0, 10).map((c, i) => {
                        const total = dash.expensesByCategory.reduce((s, x) => s + x.amount, 0);
                        const pct = total > 0 ? (c.amount / total) * 100 : 0;
                        return (
                          <li key={i} className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
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

            </>
          )}

          <div className="bg-card border-2 border-primary/20 rounded-xl overflow-hidden mb-4 shadow-sm">
            <div className="p-4 border-b border-border flex items-center gap-2 bg-primary/5">
              <Users className="w-4 h-4 text-primary" />
              <h2 className="text-base font-semibold">Histórico de acertos</h2>
              <span className="text-xs text-muted-foreground ml-auto">
                {settlements.length} acerto{settlements.length === 1 ? "" : "s"}{" "}
                {filtered ? periodLabel : "no total"}
              </span>
            </div>
            {settlements.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">
                Nenhum acerto registrado {filtered ? periodLabel : "ainda"}.
              </p>
            ) : (
              <>
                {/* Desktop: tabela */}
                <table className="w-full text-sm hidden md:table">
                  <thead className="bg-muted/30 text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Data</th>
                      <th className="px-4 py-2 font-medium">De</th>
                      <th className="px-4 py-2 font-medium">Para</th>
                      <th className="px-4 py-2 font-medium text-right">Valor</th>
                      <th className="px-4 py-2 font-medium">Observação</th>
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.map((s) => (
                      <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-4 py-2">{new Date(s.date).toLocaleDateString("pt-BR")}</td>
                        <td className="px-4 py-2">{ownerName(s.fromOwner)}</td>
                        <td className="px-4 py-2">{ownerName(s.toOwner)}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium">
                          {formatCurrency(s.amount)}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{s.notes || "—"}</td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => remove(s.id)}
                            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            aria-label="Excluir acerto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile: cards */}
                <div className="md:hidden divide-y divide-border">
                  {settlements.map((s) => (
                    <div key={s.id} className="p-4">
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-base font-semibold tabular-nums">
                          {formatCurrency(s.amount)}
                        </span>
                        <button
                          onClick={() => remove(s.id)}
                          className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          aria-label="Excluir acerto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <span>{ownerName(s.fromOwner)}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{ownerName(s.toOwner)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(s.date).toLocaleDateString("pt-BR")}
                      </p>
                      {s.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          {s.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {balance && (balance.contributions.aOwesB.length > 0 || balance.contributions.bOwesA.length > 0) && (
            <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <Receipt className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Origem dos repasses</h2>
                <span className="text-xs text-muted-foreground ml-auto">
                  Despesas que cada um pagou e ainda precisa receber de volta
                </span>
              </div>
              <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                <ContributionList
                  title={`${ownerName("PARTNER_A")} → ${ownerName("PARTNER_B")}`}
                  subtitle={`Coisas que ${ownerName("PARTNER_B")} pagou e ${ownerName("PARTNER_A")} deve devolver`}
                  items={balance.contributions.aOwesB}
                />
                <ContributionList
                  title={`${ownerName("PARTNER_B")} → ${ownerName("PARTNER_A")}`}
                  subtitle={`Coisas que ${ownerName("PARTNER_A")} pagou e ${ownerName("PARTNER_B")} deve devolver`}
                  items={balance.contributions.bOwesA}
                />
              </div>
            </div>
          )}
        </>
      )}

      {creating && balance && settings && (
        <SettlementModal
          settings={settings}
          suggested={balance}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            toast.success("Acerto registrado", { description: "O saldo do casal foi atualizado." });
            load();
          }}
        />
      )}
    </div>
  );
}

function ContributionList({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Contribution[];
}) {
  const total = items.reduce((s, i) => s + i.contributionAmount, 0);
  return (
    <div className="p-4">
      <div className="mb-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="text-sm font-semibold tabular-nums">{formatCurrency(total)}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhuma despesa nessa direção.</p>
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {items.map((c) => {
            // Drill-down: faturas agregadas linkam pra Cartões filtrando a fatura
            const isInvoice = c.kind === "invoice";
            const invoiceId = isInvoice ? c.id.replace(/^invoice-/, "") : null;
            const inner = (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium truncate flex items-center gap-1">
                    {c.description}
                    {isInvoice && (
                      <ArrowRight className="w-3 h-3 text-muted-foreground" aria-hidden />
                    )}
                  </span>
                  <span className="tabular-nums whitespace-nowrap">
                    {formatCurrency(c.contributionAmount)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground mt-1">
                  <span>{new Date(c.date).toLocaleDateString("pt-BR")}</span>
                  {c.category && (
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: c.category.color }}
                      />
                      {c.category.name}
                    </span>
                  )}
                  {c.kind === "couple" && c.totalAmount !== c.contributionAmount && (
                    <span className="text-[10px] italic">
                      (parte do casal de {formatCurrency(c.totalAmount)})
                    </span>
                  )}
                  {c.kind === "direct" && (
                    <span className="text-[10px] italic">(pagou pelo outro)</span>
                  )}
                  {c.kind === "invoice" && (
                    <span className="text-[10px] italic">
                      (fatura · {c.itemCount} compra{c.itemCount === 1 ? "" : "s"} · total{" "}
                      {formatCurrency(c.totalAmount)})
                    </span>
                  )}
                </div>
              </>
            );
            return isInvoice && invoiceId ? (
              <li key={c.id}>
                <Link
                  href={`/cartoes?invoice=${invoiceId}`}
                  className="block text-xs border border-border rounded-md p-2 hover:bg-muted/50 hover:border-primary/30 transition-colors"
                  title="Ver compras desta fatura"
                >
                  {inner}
                </Link>
              </li>
            ) : (
              <li key={c.id} className="text-xs border border-border rounded-md p-2">
                {inner}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SettlementModal({
  settings,
  suggested,
  onClose,
  onSaved,
}: {
  settings: Settings;
  suggested: Balance;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fromOwner, setFromOwner] = useState<"PARTNER_A" | "PARTNER_B">(
    suggested.whoOwes ?? "PARTNER_A"
  );
  const [toOwner, setToOwner] = useState<"PARTNER_A" | "PARTNER_B">(
    suggested.whoOwes === "PARTNER_A" ? "PARTNER_B" : "PARTNER_A"
  );
  const [amount, setAmount] = useState(
    suggested.amount > 0 ? suggested.amount.toFixed(2) : ""
  );
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    if (fromOwner === toOwner) {
      setError("Selecione duas pessoas diferentes");
      setSaving(false);
      return;
    }
    const numericAmount = parseFloat(amount.replace(",", "."));
    const res = await fetch("/api/settlements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: numericAmount,
        fromOwner,
        toOwner,
        date,
        notes: notes || null,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d?.error || "Erro");
      setSaving(false);
      return;
    }
    onSaved();
  }

  const ownerName = (o: "PARTNER_A" | "PARTNER_B") =>
    o === "PARTNER_A" ? settings.partnerAName : settings.partnerBName;

  return (
    <Modal title="Registrar acerto" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Quando um pagou ao outro (Pix, dinheiro, etc) para zerar a dívida.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">De (quem pagou)</label>
            <select
              value={fromOwner}
              onChange={(e) => {
                const v = e.target.value as "PARTNER_A" | "PARTNER_B";
                setFromOwner(v);
                if (v === toOwner) setToOwner(v === "PARTNER_A" ? "PARTNER_B" : "PARTNER_A");
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            >
              <option value="PARTNER_A">{ownerName("PARTNER_A")}</option>
              <option value="PARTNER_B">{ownerName("PARTNER_B")}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Para (quem recebeu)</label>
            <select
              value={toOwner}
              onChange={(e) => setToOwner(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            >
              <option value="PARTNER_A">{ownerName("PARTNER_A")}</option>
              <option value="PARTNER_B">{ownerName("PARTNER_B")}</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Valor</label>
            <input
              required
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Data</label>
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Observação <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Pix no dia 10/05"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background"
          />
        </div>
        {error && <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-lg">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border hover:bg-muted">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Registrar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
