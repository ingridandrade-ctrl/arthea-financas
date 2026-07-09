"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/financas/toaster";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Pencil, Trash2, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Download, X, CreditCard, Check, Clock, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/financas/page-header";
import {
  FilterBar,
  FilterGroup,
  SegControl,
  DateRange,
  SelectFilter,
  SearchInput,
} from "@/components/financas/filters";
import { formatCurrency } from "@/lib/utils";

type PeriodPreset = "this_month" | "last_month" | "last_3" | "year" | "all" | "custom";

function presetRange(p: PeriodPreset): { from: string; to: string } {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const monthFirst = (yr: number, mo: number) =>
    `${yr}-${String(mo + 1).padStart(2, "0")}-01`;
  const monthLast = (yr: number, mo: number) => {
    const d = new Date(yr, mo + 1, 0);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  if (p === "this_month") {
    // Inclui o mês inteiro (não só até hoje) pra que contas pendentes
    // com vencimento futuro dentro deste mês apareçam no filtro padrão.
    // Antes: to=today deixava a usuária confusa achando que a conta
    // "não subiu" quando na verdade estava filtrada fora da tela.
    return {
      from: monthFirst(now.getFullYear(), now.getMonth()),
      to: monthLast(now.getFullYear(), now.getMonth()),
    };
  }
  if (p === "last_month") {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      from: monthFirst(d.getFullYear(), d.getMonth()),
      to: monthLast(d.getFullYear(), d.getMonth()),
    };
  }
  if (p === "last_3") {
    const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { from: monthFirst(d.getFullYear(), d.getMonth()), to: today };
  }
  if (p === "year") {
    return { from: `${now.getFullYear()}-01-01`, to: today };
  }
  if (p === "all") {
    return { from: "", to: "" };
  }
  return { from: "", to: "" };
}

type Account = { id: string; name: string; color: string; type: string; archived?: boolean; owner?: "PARTNER_A" | "PARTNER_B" | "COUPLE" };
type Category = {
  id: string;
  name: string;
  kind: "INCOME" | "EXPENSE";
  color: string;
  archived: boolean;
};
type Transaction = {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  date: string;
  description: string;
  notes: string | null;
  owner: "PARTNER_A" | "PARTNER_B" | "COUPLE";
  paidByOwner: "PARTNER_A" | "PARTNER_B" | null;
  splitRatio: number | null;
  paid: boolean;
  paidAt: string | null;
  account: { id: string; name: string; color: string };
  toAccount: { id: string; name: string; color: string } | null;
  category: { id: string; name: string; color: string } | null;
};

type Movement = {
  id: string;
  kind: "transaction" | "invoice";
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "INVOICE";
  date: string;
  description: string;
  amount: number;
  account: { id: string; name: string; color: string; type: string };
  toAccount?: { id: string; name: string; color: string; type: string } | null;
  category: { id: string; name: string; color: string; icon: string | null } | null;
  owner: "PARTNER_A" | "PARTNER_B" | "COUPLE";
  paid: boolean;
  paidAt: string | null;
  status: "paid" | "pending" | "overdue";
  invoiceId?: string | null;
  itemCount?: number;
};

type TxStatus = "paid" | "pending" | "overdue";
type Settings = { partnerAName: string; partnerBName: string; currency: string };

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function firstDayOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function LancamentosClient() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [hideBalances, setHideBalances] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<{ id: string; title: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [period, setPeriod] = useState<PeriodPreset>("this_month");
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(todayISO());
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [owner, setOwner] = useState("");
  const [type, setType] = useState(searchParams?.get("type") ?? "");
  const [status, setStatus] = useState<"" | TxStatus>("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const urlType = searchParams?.get("type") ?? "";
    setType(urlType);
  }, [searchParams]);

  useEffect(() => {
    const current = searchParams?.get("type") ?? "";
    if (current === type) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (type) params.set("type", type);
    else params.delete("type");
    const qs = params.toString();
    // A rota é /lancamentos (o subdomínio financas.arthea.com.br já cobre
    // o "financas"). Prefixar com /financas gera 404.
    router.replace(qs ? `/lancamentos?${qs}` : "/lancamentos");
  }, [type]);

  function applyPreset(p: PeriodPreset) {
    setPeriod(p);
    if (p !== "custom") {
      const r = presetRange(p);
      setFrom(r.from);
      setTo(r.to);
    }
  }

  function clearAll() {
    applyPreset("this_month");
    setAccountId("");
    setCategoryId("");
    setOwner("");
    setType("");
    setStatus("");
    setQ("");
  }

  // Se a movimentação recém salva cair fora do filtro atual de datas,
  // expande o range pra incluí-la — evita o clássico "salvei mas não
  // aparece na lista" quando o vencimento é depois do fim do período.
  function expandFilterIfOutside(createdDate?: string) {
    if (!createdDate || !/^\d{4}-\d{2}-\d{2}$/.test(createdDate)) return;
    let changed = false;
    if (from && createdDate < from) {
      setFrom(createdDate);
      changed = true;
    }
    if (to && createdDate > to) {
      setTo(createdDate);
      changed = true;
    }
    if (changed) setPeriod("custom");
  }

  const activeFilterCount =
    (accountId ? 1 : 0) +
    (categoryId ? 1 : 0) +
    (owner ? 1 : 0) +
    (type ? 1 : 0) +
    (status ? 1 : 0) +
    (q ? 1 : 0);

  async function setPaid(m: Movement, paidValue: boolean) {
    if (paidValue === m.paid) return;
    if (m.kind === "invoice" && m.invoiceId) {
      if (paidValue) {
        router.push("/cartoes");
        return;
      }
      await fetch(`/api/invoices/${m.invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reopen" }),
      });
    } else {
      await fetch(`/api/transactions/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: paidValue }),
      });
    }
    loadTx();
  }

  async function loadStatic() {
    const [accRes, catRes, setRes] = await Promise.all([
      fetch("/api/accounts"),
      fetch("/api/categories"),
      fetch("/api/settings"),
    ]);
    setAccounts(await accRes.json());
    setCategories(await catRes.json());
    const settingsData = await setRes.json();
    setSettings(settingsData);
    setHideBalances(!!settingsData.hideBalances);
  }

  async function loadTx() {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to + "T23:59:59");
    if (accountId) params.set("accountId", accountId);
    if (categoryId) params.set("categoryId", categoryId);
    if (owner) params.set("owner", owner);
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    const res = await fetch(`/api/movements?${params.toString()}`);
    const data = await res.json();
    setMovements(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    loadStatic();
  }, []);

  useEffect(() => {
    loadTx();
  }, [from, to, accountId, categoryId, owner, type, status, q]);

  useEffect(() => {
    function onFocus() {
      loadTx();
      loadStatic();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  async function remove(id: string) {
    const ok1 = await confirmDialog({ title: "Excluir este lançamento?", variant: "destructive", confirmLabel: "Excluir" }); if (!ok1) return;
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    loadTx();
  }

  const visibleMovements = useMemo(() => {
    if (!hideBalances) return movements;
    return movements.filter((m) => m.type !== "INCOME" && m.type !== "TRANSFER");
  }, [movements, hideBalances]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const m of visibleMovements) {
      if (m.type === "INCOME") income += m.amount;
      else if (m.type === "EXPENSE" || m.type === "INVOICE") expense += m.amount;
    }
    return { income, expense, net: income - expense };
  }, [visibleMovements]);

  const ownerLabel = (o: string) => {
    if (!settings) return o;
    if (o === "PARTNER_A") return settings.partnerAName;
    if (o === "PARTNER_B") return settings.partnerBName;
    return "Casal";
  };

  return (
    <div>
      <PageHeader
        title={
          type === "EXPENSE"
            ? "Despesas Gerais"
            : type === "INCOME"
            ? "Receitas"
            : type === "INVOICE"
            ? "Faturas de Cartões"
            : type === "TRANSFER"
            ? "Transferências"
            : "Movimentações"
        }
        description={
          type === "EXPENSE"
            ? "Suas saídas de dinheiro."
            : type === "INCOME"
            ? "Suas entradas de dinheiro."
            : type === "INVOICE"
            ? "Faturas de cartão de crédito."
            : type === "TRANSFER"
            ? "Movimentações entre contas."
            : hideBalances
            ? "Suas despesas e faturas de cartão."
            : "Receitas, despesas, faturas e transferências."
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const params = new URLSearchParams();
                if (from) params.set("from", from);
                if (to) params.set("to", to + "T23:59:59");
                window.location.href = `/api/export?${params.toString()}`;
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
            >
              <Plus className="w-4 h-4" />
              Nova movimentação
            </button>
          </div>
        }
      />

      <FilterBar>
        <FilterGroup label="Período">
          <SegControl
            value={period}
            onChange={(v) => applyPreset(v)}
            options={[
              { value: "this_month", label: "Este mês" },
              { value: "last_month", label: "Mês passado" },
              { value: "last_3", label: "3 meses" },
              { value: "year", label: "Ano" },
              { value: "all", label: "Tudo" },
              { value: "custom", label: "Custom" },
            ]}
          />
        </FilterGroup>

        {period === "custom" && (
          <FilterGroup label="Datas">
            <DateRange
              from={from}
              to={to}
              onChange={(f, t) => {
                setFrom(f);
                setTo(t);
              }}
            />
          </FilterGroup>
        )}

        <FilterGroup label="Tipo">
          <SegControl
            value={type as any}
            onChange={(v) => setType(v)}
            options={
              hideBalances
                ? [
                    { value: "", label: "Tudo" },
                    { value: "EXPENSE", label: "Despesa" },
                    { value: "INVOICE", label: "Fatura" },
                  ]
                : [
                    { value: "", label: "Tudo" },
                    { value: "EXPENSE", label: "Despesa" },
                    { value: "INVOICE", label: "Fatura" },
                    { value: "INCOME", label: "Receita" },
                    { value: "TRANSFER", label: "Transferência" },
                  ]
            }
          />
        </FilterGroup>

        <FilterGroup label="Status">
          <SegControl
            value={status as any}
            onChange={(v) => setStatus(v as "" | TxStatus)}
            options={[
              { value: "", label: "Todos" },
              { value: "paid", label: "Pago" },
              { value: "pending", label: "Pendente" },
              { value: "overdue", label: "Atrasado" },
            ]}
          />
        </FilterGroup>

        <FilterGroup label="Conta">
          <SelectFilter
            value={accountId}
            onChange={(v) => setAccountId(v)}
            placeholder="Todas as contas"
            clearable
            options={accounts.filter((a) => !a.archived).map((a) => ({
              value: a.id,
              label: a.name,
            }))}
          />
        </FilterGroup>

        <FilterGroup label="Categoria">
          <SelectFilter
            value={categoryId}
            onChange={(v) => setCategoryId(v)}
            placeholder="Todas as categorias"
            clearable
            options={categories
              .filter((c) => !c.archived)
              .map((c) => ({ value: c.id, label: c.name }))}
          />
        </FilterGroup>

        <FilterGroup label="Dono">
          <SelectFilter
            value={owner}
            onChange={(v) => setOwner(v)}
            placeholder="Todos"
            clearable
            options={[
              { value: "PARTNER_A", label: settings?.partnerAName ?? "Pessoa A" },
              { value: "PARTNER_B", label: settings?.partnerBName ?? "Pessoa B" },
              { value: "COUPLE", label: "Casal" },
            ]}
          />
        </FilterGroup>

        <FilterGroup label="Buscar" className="min-w-[180px] flex-1">
          <SearchInput
            value={q}
            onChange={(v) => setQ(v)}
            placeholder="Descrição..."
          />
        </FilterGroup>

        {activeFilterCount > 0 && (
          <FilterGroup label=" ">
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted"
            >
              <X className="w-3 h-3" />
              Limpar ({activeFilterCount})
            </button>
          </FilterGroup>
        )}
      </FilterBar>

      <div className={`grid ${hideBalances ? "grid-cols-1" : "grid-cols-3"} gap-3 mb-4`}>
        {!hideBalances && (
          <SummaryCard label="Receitas" value={totals.income} positive />
        )}
        <SummaryCard label="Despesas" value={totals.expense} negative />
        {!hideBalances && (
          <SummaryCard label="Saldo do período" value={totals.net} positive={totals.net >= 0} negative={totals.net < 0} />
        )}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
        ) : visibleMovements.length === 0 ? (
          <p className="p-12 text-sm text-muted-foreground text-center">
            Nenhuma movimentação no período. Clique em "Nova movimentação" para começar.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Conta</th>
                <th className="px-4 py-3 font-medium">Dono</th>
                <th className="px-4 py-3 font-medium text-right">Valor</th>
                <th className="px-4 py-3 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {visibleMovements.map((m) => (
                <tr
                  key={m.id}
                  className={`border-t border-border hover:bg-muted/30 ${
                    m.kind === "invoice" ? "cursor-pointer" : ""
                  }`}
                  onClick={
                    m.kind === "invoice" && m.invoiceId
                      ? () => setViewingInvoice({ id: m.invoiceId!, title: m.description })
                      : undefined
                  }
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(m.date).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MovementTypeIcon type={m.type} />
                      <span className={m.kind === "invoice" ? "font-medium" : ""}>
                        {m.description}
                      </span>
                      {m.kind === "invoice" && m.itemCount != null && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {m.itemCount} ite{m.itemCount === 1 ? "m" : "ns"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <MovementStatusBadge m={m} onSetPaid={(p) => setPaid(m, p)} />
                  </td>
                  <td className="px-4 py-3">
                    {m.kind === "invoice" ? (
                      <span className="text-muted-foreground italic text-xs">ver fatura</span>
                    ) : m.type === "TRANSFER" ? (
                      <span className="text-muted-foreground">Transferência</span>
                    ) : m.category ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: m.category.color }}
                        />
                        {m.category.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {m.type === "TRANSFER" && m.toAccount ? (
                      <span>
                        {m.account.name} → {m.toAccount.name}
                      </span>
                    ) : (
                      m.account.name
                    )}
                  </td>
                  <td className="px-4 py-3">{ownerLabel(m.owner)}</td>
                  <td className={`px-4 py-3 text-right font-medium tabular-nums ${
                    m.type === "INCOME"
                      ? "text-success"
                      : m.type === "EXPENSE" || m.type === "INVOICE"
                      ? "text-destructive"
                      : ""
                  }`}>
                    {m.type === "EXPENSE" || m.type === "INVOICE" ? "−" : m.type === "INCOME" ? "+" : ""}
                    {formatCurrency(m.amount)}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {m.kind === "transaction" ? (
                      <>
                        <button
                          onClick={async () => {
                            const res = await fetch(`/api/transactions/${m.id}`);
                            if (!res.ok) return;
                            const t = await res.json();
                            setEditing(t as Transaction);
                          }}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => remove(m.id)}
                          className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : m.invoiceId ? (
                      <button
                        onClick={() => setViewingInvoice({ id: m.invoiceId!, title: m.description })}
                        title="Ver/editar compras da fatura"
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <TransactionModal
          accounts={accounts}
          categories={categories}
          settings={settings}
          onClose={() => setCreating(false)}
          onSaved={(createdDate) => {
            setCreating(false);
            expandFilterIfOutside(createdDate);
            toast.success("Movimentação salva");
            loadTx();
          }}
        />
      )}
      {editing && (
        <TransactionModal
          transaction={editing}
          accounts={accounts}
          categories={categories}
          settings={settings}
          onClose={() => setEditing(null)}
          onSaved={(createdDate) => {
            setEditing(null);
            expandFilterIfOutside(createdDate);
            toast.success("Movimentação atualizada");
            loadTx();
          }}
        />
      )}
      {viewingInvoice && (
        <InvoiceTxModal
          invoiceId={viewingInvoice.id}
          title={viewingInvoice.title}
          settings={settings}
          onClose={() => setViewingInvoice(null)}
          onEditTx={async (id) => {
            const res = await fetch(`/api/transactions/${id}`);
            if (!res.ok) return;
            const t = await res.json();
            setViewingInvoice(null);
            setEditing(t as Transaction);
          }}
          onChanged={() => loadTx()}
        />
      )}
    </div>
  );
}

function InvoiceTxModal({
  invoiceId,
  title,
  settings,
  onClose,
  onEditTx,
  onChanged,
}: {
  invoiceId: string;
  title: string;
  settings: Settings | null;
  onClose: () => void;
  onEditTx: (id: string) => void;
  onChanged: () => void;
}) {
  const [txs, setTxs] = useState<any[] | null>(null);

  async function load() {
    const res = await fetch(`/api/transactions?invoiceId=${invoiceId}&limit=500`);
    const data = await res.json();
    setTxs(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    load();
  }, [invoiceId]);

  async function remove(id: string) {
    const ok2 = await confirmDialog({ title: "Excluir esta compra da fatura?", variant: "destructive", confirmLabel: "Excluir" }); if (!ok2) return;
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    onChanged();
    load();
  }

  const total = txs ? txs.reduce((s, t) => s + (t.amount || 0), 0) : 0;
  const ownerName = (o: "PARTNER_A" | "PARTNER_B" | "COUPLE") =>
    o === "PARTNER_A"
      ? settings?.partnerAName ?? "Pessoa A"
      : o === "PARTNER_B"
      ? settings?.partnerBName ?? "Pessoa B"
      : "Casal";

  return (
    <Modal title={`Fatura · ${title}`} onClose={onClose} maxWidth="max-w-2xl">
      {!txs ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : txs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma compra nesta fatura.</p>
      ) : (
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-xs text-muted-foreground">{txs.length} compra{txs.length === 1 ? "" : "s"}</p>
            <p className="text-sm font-medium tabular-nums text-destructive">
              Total: −{formatCurrency(total)}
            </p>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Data</th>
                  <th className="px-3 py-2 text-left font-medium">Descrição</th>
                  <th className="px-3 py-2 text-left font-medium">Categoria</th>
                  <th className="px-3 py-2 text-left font-medium">Dono</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                  <th className="px-3 py-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(t.date).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-3 py-2">{t.description}</td>
                    <td className="px-3 py-2">
                      {t.category ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: t.category.color }}
                          />
                          {t.category.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{ownerName(t.owner)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(t.amount)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => onEditTx(t.id)}
                        title="Editar"
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => remove(t.id)}
                        title="Excluir"
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

function MovementTypeIcon({ type }: { type: Movement["type"] }) {
  if (type === "INCOME") return <ArrowUpCircle className="w-4 h-4 text-success" />;
  if (type === "EXPENSE") return <ArrowDownCircle className="w-4 h-4 text-destructive" />;
  if (type === "TRANSFER") return <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />;
  return <CreditCard className="w-4 h-4 text-primary" />;
}

const STATUS_PILL: Record<
  "paid" | "pending" | "overdue",
  { label: string; pill: string; dot: string }
> = {
  paid: {
    label: "Pago",
    pill: "bg-success/15 text-success border border-success/30",
    dot: "bg-success",
  },
  pending: {
    label: "Pendente",
    pill: "bg-warning/15 text-warning border border-warning/30",
    dot: "bg-warning",
  },
  overdue: {
    label: "Atrasado",
    pill: "bg-destructive/15 text-destructive border border-destructive/30",
    dot: "bg-destructive",
  },
};

function MovementStatusBadge({
  m,
  onSetPaid,
}: {
  m: Movement;
  onSetPaid: (paid: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    function onScroll() { setOpen(false); }
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  if (m.type === "INCOME" || m.type === "TRANSFER") return null;

  const cur = STATUS_PILL[m.status];

  function openMenu() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left });
    setOpen(true);
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => {
          e.stopPropagation();
          if (open) setOpen(false);
          else openMenu();
        }}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cur.pill} hover:opacity-90`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${cur.dot}`} />
        {cur.label}
      </button>
      {mounted && open && pos &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[100] w-40 bg-card border border-border rounded-lg shadow-lg py-1"
            style={{ top: pos.top, left: pos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            {(["paid", "pending", "overdue"] as const).map((v) => {
              const o = STATUS_PILL[v];
              const active = v === m.status;
              return (
                <button
                  key={v}
                  onClick={() => {
                    setOpen(false);
                    onSetPaid(v === "paid");
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted text-left"
                >
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${o.pill}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${o.dot}`} />
                    {o.label}
                  </span>
                  {active && <Check className="w-3.5 h-3.5 text-muted-foreground ml-auto" />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function SummaryCard({
  label,
  value,
  positive,
  negative,
}: {
  label: string;
  value: number;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-xl font-bold mt-1 tabular-nums ${
          positive ? "text-success" : negative ? "text-destructive" : ""
        }`}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function TypeIcon({ type }: { type: "INCOME" | "EXPENSE" | "TRANSFER" }) {
  if (type === "INCOME") return <ArrowUpCircle className="w-4 h-4 text-success" />;
  if (type === "EXPENSE") return <ArrowDownCircle className="w-4 h-4 text-destructive" />;
  return <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />;
}

function TransactionModal({
  transaction,
  accounts,
  categories,
  settings,
  onClose,
  onSaved,
}: {
  transaction?: Transaction;
  accounts: Account[];
  categories: Category[];
  settings: Settings | null;
  onClose: () => void;
  onSaved: (createdDate?: string) => void;
}) {
  const [type, setType] = useState<"INCOME" | "EXPENSE" | "TRANSFER">(
    transaction?.type || "EXPENSE"
  );
  const [amount, setAmount] = useState(transaction?.amount?.toString() || "");
  const [date, setDate] = useState(
    transaction
      ? new Date(transaction.date).toISOString().slice(0, 10)
      : todayISO()
  );
  const [description, setDescription] = useState(transaction?.description || "");
  const [notes, setNotes] = useState(transaction?.notes || "");
  const [owner, setOwner] = useState<"PARTNER_A" | "PARTNER_B" | "COUPLE">(
    transaction?.owner || "COUPLE"
  );
  const [paidByOwner, setPaidByOwner] = useState<"PARTNER_A" | "PARTNER_B" | "">(
    transaction?.paidByOwner || ""
  );
  const [splitPercentA, setSplitPercentA] = useState(
    typeof transaction?.splitRatio === "number" ? Math.round(transaction.splitRatio * 100) : 50
  );
  const [accountId, setAccountId] = useState(() => {
    if (transaction?.account.id) return transaction.account.id;
    const preferred = accounts.find(
      (a) =>
        !a.archived &&
        a.type !== "CREDIT_CARD" &&
        a.owner === (transaction?.owner || "COUPLE")
    );
    return preferred?.id || accounts.find((a) => !a.archived)?.id || "";
  });

  useEffect(() => {
    if (transaction) return;
    const current = accounts.find((a) => a.id === accountId);
    if (current && (current.owner === owner || current.owner === "COUPLE")) return;
    const next = accounts.find(
      (a) => !a.archived && a.type !== "CREDIT_CARD" && a.owner === owner
    );
    if (next) setAccountId(next.id);
  }, [owner, accounts, transaction]);
  const [toAccountId, setToAccountId] = useState(
    transaction?.toAccount?.id || ""
  );
  const [categoryId, setCategoryId] = useState(transaction?.category?.id || "");
  const [paid, setPaid] = useState(transaction ? transaction.paid : true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredCategories = categories.filter(
    (c) => !c.archived && c.kind === (type === "INCOME" ? "INCOME" : "EXPENSE")
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const numericAmount = parseFloat(amount.replace(",", "."));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Valor inválido");
      setSaving(false);
      return;
    }
    const url = transaction
      ? `/api/transactions/${transaction.id}`
      : "/api/transactions";
    try {
      const res = await fetch(url, {
        method: transaction ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          amount: numericAmount,
          date,
          description,
          notes: notes || null,
          owner,
          paidByOwner: type === "EXPENSE" ? (paidByOwner || null) : null,
          splitRatio:
            type === "EXPENSE" && owner === "COUPLE"
              ? Math.min(Math.max(splitPercentA, 0), 100) / 100
              : null,
          accountId,
          toAccountId: type === "TRANSFER" ? toAccountId : null,
          categoryId: type === "TRANSFER" ? null : categoryId || null,
          paid: type === "EXPENSE" ? paid : true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Erro ao salvar");
        setSaving(false);
        return;
      }
      // Passa a data pro parent poder expandir o filtro se necessário
      // (ex: conta pendente pra mês que vem cai fora do filtro atual).
      onSaved(date);
    } catch (err: any) {
      // Se cair aqui é falha de rede / DB dormindo / timeout do serverless.
      // Sem esse catch a promise rejeita silenciosa, saving fica travado
      // em true e o usuário vê "nada acontecendo" ao clicar Salvar.
      console.error("[transactions] submit failed", err);
      setError(
        err?.name === "AbortError"
          ? "Servidor demorou pra responder. Tenta de novo."
          : "Falha de conexão. Verifica sua internet e tenta de novo."
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      title={transaction ? "Editar movimentação" : "Nova movimentação"}
      onClose={onClose}
      maxWidth="max-w-lg"
    >
      <form onSubmit={submit} className="space-y-4">
        {!transaction && (
          <div className="grid grid-cols-3 gap-2">
            {(["EXPENSE", "INCOME", "TRANSFER"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-3 py-2 rounded-lg border text-sm font-medium transition ${
                  type === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                {t === "EXPENSE" ? "Despesa" : t === "INCOME" ? "Receita" : "Transferência"}
              </button>
            ))}
          </div>
        )}

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
              placeholder="0,00"
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
          <label className="block text-sm font-medium mb-1">Descrição</label>
          <input
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Mercado da semana"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            {type === "TRANSFER" ? "De (conta de origem)" : "Conta"}
          </label>
          <select
            required
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background"
          >
            {[...accounts.filter((a) => !a.archived)]
              .sort((a, b) => {
                const aMatch = a.owner === owner ? 0 : a.owner === "COUPLE" ? 1 : 2;
                const bMatch = b.owner === owner ? 0 : b.owner === "COUPLE" ? 1 : 2;
                return aMatch - bMatch;
              })
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.owner && a.owner !== owner && a.owner !== "COUPLE"
                    ? ` (de outro)`
                    : ""}
                </option>
              ))}
          </select>
        </div>

        {type === "TRANSFER" ? (
          <div>
            <label className="block text-sm font-medium mb-1">Para (conta de destino)</label>
            <select
              required
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            >
              <option value="">Selecione...</option>
              {accounts
                .filter((a) => !a.archived && a.id !== accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1">Categoria</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            >
              <option value="">Sem categoria</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Quem é</label>
          <div className="grid grid-cols-3 gap-2">
            {(["PARTNER_A", "PARTNER_B", "COUPLE"] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOwner(o)}
                className={`px-3 py-2 rounded-lg border text-sm transition ${
                  owner === o
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                {o === "PARTNER_A"
                  ? settings?.partnerAName ?? "Pessoa A"
                  : o === "PARTNER_B"
                  ? settings?.partnerBName ?? "Pessoa B"
                  : "Casal"}
              </button>
            ))}
          </div>
        </div>

        {type === "EXPENSE" && (
          <div className="bg-muted/30 rounded-lg p-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Acerto do casal (opcional). Se quem pagou for diferente de quem é a despesa, isso entra
              no cálculo de quem deve a quem.
            </p>
            <div>
              <label className="block text-xs font-medium mb-1">Quem pagou</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaidByOwner("")}
                  className={`px-3 py-1.5 rounded-lg border text-xs ${
                    paidByOwner === "" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                  }`}
                >
                  Não acertar
                </button>
                <button
                  type="button"
                  onClick={() => setPaidByOwner("PARTNER_A")}
                  className={`px-3 py-1.5 rounded-lg border text-xs ${
                    paidByOwner === "PARTNER_A" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                  }`}
                >
                  {settings?.partnerAName ?? "Pessoa A"}
                </button>
                <button
                  type="button"
                  onClick={() => setPaidByOwner("PARTNER_B")}
                  className={`px-3 py-1.5 rounded-lg border text-xs ${
                    paidByOwner === "PARTNER_B" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                  }`}
                >
                  {settings?.partnerBName ?? "Pessoa B"}
                </button>
              </div>
            </div>
            {owner === "COUPLE" && paidByOwner && (
              <div>
                <label className="block text-xs font-medium mb-1">
                  Divisão: {settings?.partnerAName ?? "A"} {splitPercentA}% / {settings?.partnerBName ?? "B"} {100 - splitPercentA}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={splitPercentA}
                  onChange={(e) => setSplitPercentA(parseInt(e.target.value, 10))}
                  className="w-full"
                />
              </div>
            )}
          </div>
        )}

        {type === "EXPENSE" && (
          <label className="flex items-start gap-2 p-3 rounded-lg border border-border bg-muted/30 cursor-pointer hover:bg-muted/50">
            <input
              type="checkbox"
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
              className="mt-0.5"
            />
            <div className="text-sm">
              <strong>Já paguei essa despesa</strong>
              <p className="text-xs text-muted-foreground mt-0.5">
                Marcado: já saiu do bolso. Desmarcado: vira "pendente" e o sistema marca como
                "atrasado" automaticamente quando passar da data.
              </p>
            </div>
          </label>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">
            Observações <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background resize-none"
          />
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
