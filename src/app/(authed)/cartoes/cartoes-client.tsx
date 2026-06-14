"use client";

import { useEffect, useState } from "react";
import { CreditCard, CheckCircle2, Clock, AlertTriangle, Lock, Sparkles, Trash2, Pencil, CalendarClock, ArrowRightLeft } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/financas/page-header";
import { formatCurrency } from "@/lib/utils";

type Account = {
  id: string;
  name: string;
  color: string;
  type: string;
  archived: boolean;
  creditLimit?: number | null;
  closingDay?: number | null;
  dueDay?: number | null;
  initialBalance?: number;
  owner?: "PARTNER_A" | "PARTNER_B" | "COUPLE";
};

type Settings = { partnerAName: string; partnerBName: string };

type Category = { id: string; name: string };

type Owner = "PARTNER_A" | "PARTNER_B" | "COUPLE";

type InvoiceTx = {
  id: string;
  amount: number;
  description: string;
  date: string;
  owner: "PARTNER_A" | "PARTNER_B" | "COUPLE";
  installmentGroupId: string | null;
  installmentIndex: number | null;
  installmentTotal: number | null;
  installmentProjected: boolean;
  category: { id: string; name: string; color: string } | null;
};

type Invoice = {
  id: string;
  accountId: string;
  year: number;
  month: number;
  closingDate: string;
  dueDate: string;
  paidAt: string | null;
  status: "OPEN" | "CLOSED" | "PAID" | "OVERDUE";
  total: number;
  account: { id: string; name: string; color: string; closingDay: number | null; dueDay: number | null };
  paymentAccount: { id: string; name: string } | null;
  transactions: InvoiceTx[];
};

const STATUS_LABEL: Record<Invoice["status"], string> = {
  OPEN: "Aberta",
  CLOSED: "Fechada",
  PAID: "Paga",
  OVERDUE: "Atrasada",
};

const STATUS_ICON: Record<Invoice["status"], any> = {
  OPEN: Clock,
  CLOSED: Lock,
  PAID: CheckCircle2,
  OVERDUE: AlertTriangle,
};

const STATUS_COLOR: Record<Invoice["status"], string> = {
  OPEN: "text-foreground",
  CLOSED: "text-warning",
  PAID: "text-success",
  OVERDUE: "text-destructive",
};

function monthName(month: number) {
  return new Date(2000, month - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
}

function ownerLabel(owner: "PARTNER_A" | "PARTNER_B" | "COUPLE", settings: Settings | null) {
  if (owner === "PARTNER_A") return settings?.partnerAName ?? "Pessoa A";
  if (owner === "PARTNER_B") return settings?.partnerBName ?? "Pessoa B";
  return "Casal";
}

export function CartoesClient() {
  const [cards, setCards] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingCard, setEditingCard] = useState<Account | null>(null);
  const [editingTx, setEditingTx] = useState<InvoiceTx | null>(null);
  const [bulkDateInvoice, setBulkDateInvoice] = useState<Invoice | null>(null);
  const [movingInvoice, setMovingInvoice] = useState<Invoice | null>(null);
  const [reviewingInvoice, setReviewingInvoice] = useState<Invoice | null>(null);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  function toggleSelect(id: string) {
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAll(ids: string[]) {
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }
  async function bulkDeleteSelected() {
    const ids = Array.from(selectedTxIds);
    if (ids.length === 0) return;
    if (!confirm(`Excluir ${ids.length} compra${ids.length === 1 ? "" : "s"} selecionada${ids.length === 1 ? "" : "s"}?`)) return;
    const res = await fetch("/api/transactions/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (res.ok) {
      setSelectedTxIds(new Set());
      load();
    }
  }

  async function deleteInvoice(inv: Invoice) {
    const msg =
      inv.transactions.length > 0
        ? `Excluir a fatura de ${monthName(inv.month)}/${inv.year}?\n\nIsso vai apagar também as ${inv.transactions.length} compra${inv.transactions.length === 1 ? "" : "s"} dela.`
        : `Excluir a fatura vazia de ${monthName(inv.month)}/${inv.year}?`;
    if (!confirm(msg)) return;
    const res = await fetch(`/api/invoices/${inv.id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  async function load() {
    setLoading(true);
    const [accs, invs, st, cats] = await Promise.all([
      fetch("/api/accounts").then((r) => r.json()),
      fetch("/api/invoices").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]);
    const ccs = accs.filter((a: Account) => a.type === "CREDIT_CARD" && !a.archived);
    setCards(ccs);
    setAllAccounts(accs);
    setInvoices(invs);
    setSettings(st);
    setAllCategories(cats.filter((c: any) => !c.archived && c.kind === "EXPENSE"));
    setSelected((s) => s || ccs[0]?.id || "");
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function onFocus() {
      load();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const visible = selected
    ? invoices
        .filter((i) => i.accountId === selected)
        .filter((i) => {
          const key = `${i.year}-${String(i.month).padStart(2, "0")}`;
          if (filterFrom && key < filterFrom) return false;
          if (filterTo && key > filterTo) return false;
          return true;
        })
    : [];
  const projectedCount = invoices.reduce(
    (s, inv) => s + inv.transactions.filter((t) => t.installmentProjected).length,
    0
  );
  const emptyCount = invoices.filter(
    (inv) => inv.transactions.length === 0 && inv.status !== "PAID"
  ).length;

  async function cleanupProjected() {
    if (
      !confirm(
        `Excluir todas as ${projectedCount} parcelas projetadas?\n\nElas voltam a existir só quando você importar a fatura do mês delas.`
      )
    )
      return;
    const res = await fetch("/api/transactions/cleanup-projected", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) load();
  }

  async function cleanupEmpty() {
    if (
      !confirm(
        `Excluir todas as ${emptyCount} faturas vazias?\n\nSão faturas sem nenhuma compra. Você pode importá-las de novo quando quiser.`
      )
    )
      return;
    const res = await fetch("/api/invoices/cleanup-empty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) load();
  }

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <PageHeader
          title="Cartões de Crédito"
          description="Acompanhe faturas, marque como paga e veja as compras de cada mês."
        />
        <div className="flex items-center gap-2 flex-wrap">
          {projectedCount > 0 && (
            <button
              onClick={cleanupProjected}
              title="Apaga todas as parcelas projetadas que ainda não chegaram"
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-warning/40 text-warning hover:bg-warning/10 text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Limpar {projectedCount} parcela{projectedCount === 1 ? "" : "s"} projetada{projectedCount === 1 ? "" : "s"}
            </button>
          )}
          {emptyCount > 0 && (
            <button
              onClick={cleanupEmpty}
              title="Apaga todas as faturas sem compras"
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Limpar {emptyCount} fatura{emptyCount === 1 ? "" : "s"} vazia{emptyCount === 1 ? "" : "s"}
            </button>
          )}
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium"
          >
            <CreditCard className="w-4 h-4" />
            Novo cartão
          </button>
          {cards.length > 0 && (
            <button
              onClick={() => setImporting(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-sm font-medium"
            >
              <Sparkles className="w-4 h-4" />
              Importar fatura com IA
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : cards.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <CreditCard className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-3">Nenhum cartão cadastrado.</p>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-sm font-medium"
          >
            <CreditCard className="w-4 h-4" />
            Cadastrar primeiro cartão
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-5">
            {cards.map((c) => (
              <div key={c.id} className="flex items-stretch">
                <button
                  onClick={() => setSelected(c.id)}
                  className={`px-3 py-2 rounded-l-lg border text-sm font-medium ${
                    selected === c.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </span>
                </button>
                <button
                  onClick={() => setEditingCard(c)}
                  title="Editar cartão"
                  className={`px-2 rounded-r-lg border-y border-r ${
                    selected === c.id
                      ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-muted/30 border border-border rounded-lg">
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                Mês de
              </label>
              <input
                type="month"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="px-2 py-1.5 rounded border border-border bg-background text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                Mês até
              </label>
              <input
                type="month"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="px-2 py-1.5 rounded border border-border bg-background text-sm"
              />
            </div>
            {(filterFrom || filterTo) && (
              <button
                onClick={() => {
                  setFilterFrom("");
                  setFilterTo("");
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                limpar filtro
              </button>
            )}
            <div className="text-xs text-muted-foreground ml-auto">
              {visible.length} fatura{visible.length === 1 ? "" : "s"} {filterFrom || filterTo ? "no filtro" : "no total"}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <p className="text-sm text-muted-foreground">
                {filterFrom || filterTo
                  ? "Nenhuma fatura nesse período."
                  : "Nenhuma fatura ainda. Lance uma despesa neste cartão para gerar a primeira."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map((inv) => {
                const Icon = STATUS_ICON[inv.status];
                return (
                  <div key={inv.id} className="bg-card border border-border rounded-xl">
                    <div className="p-5 flex items-start justify-between flex-wrap gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold capitalize">
                            {new Date(inv.dueDate).toLocaleDateString("pt-BR", {
                              month: "long",
                              year: "numeric",
                            })}
                          </h3>
                          <span
                            className={`inline-flex items-center ${STATUS_COLOR[inv.status]}`}
                            title={STATUS_LABEL[inv.status]}
                            aria-label={STATUS_LABEL[inv.status]}
                          >
                            <Icon className="w-4 h-4" />
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground space-x-3">
                          <span>Fechamento: {new Date(inv.closingDate).toLocaleDateString("pt-BR")}</span>
                          <span>Vencimento: {new Date(inv.dueDate).toLocaleDateString("pt-BR")}</span>
                          {inv.paidAt && (
                            <span>
                              Paga em {new Date(inv.paidAt).toLocaleDateString("pt-BR")}
                              {inv.paymentAccount && ` via ${inv.paymentAccount.name}`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-2xl font-bold tabular-nums">{formatCurrency(inv.total)}</p>
                        <div className="flex flex-col items-end gap-1 mt-2">
                          {inv.status !== "PAID" && inv.total > 0 && (
                            <button
                              onClick={() => setPaying(inv)}
                              className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
                            >
                              Marcar como paga
                            </button>
                          )}
                          {inv.transactions.length > 0 && (
                            <button
                              onClick={() => setBulkDateInvoice(inv)}
                              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground"
                              title="Aplicar uma única data a todos os lançamentos desta fatura"
                            >
                              <CalendarClock className="w-3.5 h-3.5" />
                              Definir data única
                            </button>
                          )}
                          {inv.transactions.length > 0 && (
                            <button
                              onClick={() => setMovingInvoice(inv)}
                              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground"
                              title="Mover todas as compras desta fatura para outro mês"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              Mover pra outro mês
                            </button>
                          )}
                          {inv.transactions.length > 0 && (
                            <button
                              onClick={() => setReviewingInvoice(inv)}
                              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/10"
                              title="Re-analisar o PDF e ver o que falta ou sobra"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              Revisar com IA
                            </button>
                          )}
                          <button
                            onClick={() => deleteInvoice(inv)}
                            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-destructive/30 hover:bg-destructive/10 text-destructive"
                            title="Excluir esta fatura e todos os lançamentos dela"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Excluir fatura
                          </button>
                        </div>
                      </div>
                    </div>
                    {inv.transactions.length > 0 && (() => {
                      const invTxIds = inv.transactions.map((t) => t.id);
                      const selectedHere = invTxIds.filter((id) => selectedTxIds.has(id));
                      const allSelected = invTxIds.length > 0 && selectedHere.length === invTxIds.length;
                      return (
                      <div className="border-t border-border">
                        {selectedHere.length > 0 && (
                          <div className="bg-destructive/5 border-b border-border px-4 py-2 flex items-center justify-between text-xs">
                            <span>
                              <strong>{selectedHere.length}</strong> de {invTxIds.length} selecionada{selectedHere.length === 1 ? "" : "s"}
                            </span>
                            <button
                              onClick={bulkDeleteSelected}
                              className="flex items-center gap-1 px-3 py-1 rounded text-destructive hover:bg-destructive/10 font-medium"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Excluir selecionadas
                            </button>
                          </div>
                        )}
                        <table className="w-full text-sm">
                          <thead className="bg-muted/30 text-muted-foreground text-left">
                            <tr>
                              <th className="px-2 py-2 font-medium w-8">
                                <input
                                  type="checkbox"
                                  checked={allSelected}
                                  onChange={() => selectAll(invTxIds)}
                                  className="cursor-pointer"
                                />
                              </th>
                              <th className="px-4 py-2 font-medium">Data</th>
                              <th className="px-4 py-2 font-medium">Descrição</th>
                              <th className="px-4 py-2 font-medium">Categoria</th>
                              <th className="px-4 py-2 font-medium">Dono</th>
                              <th className="px-4 py-2 font-medium text-right">Valor</th>
                              <th className="px-4 py-2 font-medium w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {inv.transactions.map((t) => (
                              <tr
                                key={t.id}
                                className={`border-t border-border hover:bg-muted/30 cursor-pointer ${
                                  t.installmentProjected ? "text-muted-foreground italic" : ""
                                } ${selectedTxIds.has(t.id) ? "bg-primary/5" : ""}`}
                                onClick={() => setEditingTx(t)}
                                title={t.installmentProjected ? "Parcela projetada — vai ser confirmada quando você importar a fatura desse mês" : undefined}
                              >
                                <td className="px-2 py-2 w-8" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={selectedTxIds.has(t.id)}
                                    onChange={() => toggleSelect(t.id)}
                                    className="cursor-pointer"
                                  />
                                </td>
                                <td className="px-4 py-2 text-muted-foreground">
                                  {new Date(t.date).toLocaleDateString("pt-BR")}
                                </td>
                                <td className="px-4 py-2">
                                  <span className="flex items-center gap-2">
                                    <span>{t.description}</span>
                                    {t.installmentIndex && t.installmentTotal && (
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                        t.installmentProjected
                                          ? "bg-muted text-muted-foreground border border-dashed border-border"
                                          : "bg-primary/10 text-primary"
                                      }`}>
                                        {t.installmentIndex}/{t.installmentTotal}
                                        {t.installmentProjected ? " · projetada" : ""}
                                      </span>
                                    )}
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                                  {t.category ? (
                                    <span className="inline-flex items-center gap-1.5">
                                      <span
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: t.category.color }}
                                      />
                                      {t.category.name}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground italic">sem categoria</span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-muted-foreground">
                                  {ownerLabel(t.owner, settings)}
                                </td>
                                <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(t.amount)}</td>
                                <td className="px-4 py-2 text-muted-foreground">
                                  <Pencil className="w-3.5 h-3.5" />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {creating && (
        <NewCardModal
          settings={settings}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
      )}

      {editingCard && (
        <NewCardModal
          settings={settings}
          card={editingCard}
          onClose={() => setEditingCard(null)}
          onCreated={() => {
            setEditingCard(null);
            load();
          }}
        />
      )}

      {paying && (
        <PayInvoiceModal
          invoice={paying}
          accounts={allAccounts.filter((a) => a.type !== "CREDIT_CARD" && !a.archived)}
          settings={settings}
          onClose={() => setPaying(null)}
          onPaid={() => {
            setPaying(null);
            load();
          }}
        />
      )}

      {importing && cards.length > 0 && (
        <ImportInvoiceModal
          cards={cards}
          defaultCardId={selected || cards[0].id}
          settings={settings}
          onClose={() => setImporting(false)}
          onImported={() => {
            setImporting(false);
            load();
          }}
        />
      )}

      {editingTx && (
        <EditTransactionModal
          tx={editingTx}
          categories={allCategories}
          settings={settings}
          onClose={() => setEditingTx(null)}
          onSaved={() => {
            setEditingTx(null);
            load();
          }}
        />
      )}

      {movingInvoice && (
        <MoveInvoiceModal
          invoice={movingInvoice}
          onClose={() => setMovingInvoice(null)}
          onSaved={() => {
            setMovingInvoice(null);
            load();
          }}
        />
      )}

      {reviewingInvoice && (
        <ImportInvoiceModal
          cards={cards}
          defaultCardId={reviewingInvoice.accountId}
          settings={settings}
          existingInvoice={reviewingInvoice}
          onClose={() => setReviewingInvoice(null)}
          onImported={() => {
            setReviewingInvoice(null);
            load();
          }}
        />
      )}

      {bulkDateInvoice && (
        <BulkDateModal
          invoice={bulkDateInvoice}
          onClose={() => setBulkDateInvoice(null)}
          onSaved={() => {
            setBulkDateInvoice(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function MoveInvoiceModal({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSaved: () => void;
}) {
  const sourceMonth = `${invoice.year}-${String(invoice.month).padStart(2, "0")}`;
  const [target, setTarget] = useState(sourceMonth);
  const [deleteSource, setDeleteSource] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (target === sourceMonth) {
      setError("Escolha um mês diferente do atual.");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/invoices/${invoice.id}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetMonth: target, deleteSource }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data?.error || "Erro ao mover");
      return;
    }
    onSaved();
  }

  return (
    <Modal title="Mover compras pra outro mês" onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Vai mover todas as <strong>{invoice.transactions.length}</strong> compra
          {invoice.transactions.length === 1 ? "" : "s"} da fatura de{" "}
          <strong>
            {new Date(invoice.year, invoice.month).toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
            })}
          </strong>{" "}
          para o mês que você escolher abaixo.
        </p>
        <div>
          <label className="block text-sm font-medium mb-1">Mês de destino</label>
          <input
            type="month"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Se a fatura desse mês ainda não existe, eu crio.
          </p>
        </div>
        <label className="flex items-start gap-2 text-sm p-3 rounded-lg border border-border bg-muted/30 cursor-pointer hover:bg-muted/50">
          <input
            type="checkbox"
            checked={deleteSource}
            onChange={(e) => setDeleteSource(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <strong>Apagar a fatura atual</strong> depois de mover as compras (recomendado — fica
            vazia se você não fizer isso)
          </span>
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 text-sm font-medium"
          >
            {saving ? "Movendo..." : "Mover"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BulkDateModal({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSaved: () => void;
}) {
  const defaultDate = invoice.dueDate
    ? new Date(invoice.dueDate).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(defaultDate);
  const [overwritePurchaseDates, setOverwritePurchaseDates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setAllDates", date, overwritePurchaseDates }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d?.error || "Erro");
      setSaving(false);
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (overwritePurchaseDates) {
      alert(`Vencimento ajustado e ${data.updated || 0} lançamento(s) reescrito(s) para ${new Date(date).toLocaleDateString("pt-BR")}.`);
    } else {
      alert(`Vencimento da fatura ajustado para ${new Date(date).toLocaleDateString("pt-BR")}. As datas de compra foram preservadas.`);
    }
    onSaved();
  }

  return (
    <Modal title="Ajustar vencimento da fatura" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Por padrão, só ajusta o <strong>vencimento</strong> da fatura. As datas reais das
          compras são preservadas (você precisa delas pro extrato bater).
        </p>
        <div>
          <label className="block text-sm font-medium mb-1">Nova data de vencimento</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background"
          />
        </div>
        <label className="flex items-start gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5 cursor-pointer hover:bg-destructive/10">
          <input
            type="checkbox"
            checked={overwritePurchaseDates}
            onChange={(e) => setOverwritePurchaseDates(e.target.checked)}
            className="mt-0.5"
          />
          <div className="text-sm">
            <strong className="text-destructive">
              Também sobrescrever a data das {invoice.transactions.length} compras
            </strong>
            <p className="text-xs text-muted-foreground mt-0.5">
              ⚠️ Destrutivo. As datas reais de compra serão perdidas pra sempre. Use só se
              tem certeza que a fatura inteira deve aparecer numa data única.
            </p>
          </div>
        </label>
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-lg">{error}</div>
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
            {saving ? "Aplicando..." : "Aplicar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditTransactionModal({
  tx,
  categories,
  settings,
  onClose,
  onSaved,
}: {
  tx: InvoiceTx;
  categories: Category[];
  settings: Settings | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(tx.date.slice(0, 10));
  const [description, setDescription] = useState(tx.description);
  const [amount, setAmount] = useState(String(tx.amount));
  const [categoryId, setCategoryId] = useState(tx.category?.id ?? "");
  const [owner, setOwner] = useState<"PARTNER_A" | "PARTNER_B" | "COUPLE">(tx.owner);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const partnerA = settings?.partnerAName || "Pessoa A";
  const partnerB = settings?.partnerBName || "Pessoa B";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const numericAmount = parseFloat(amount.replace(",", "."));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Valor inválido");
      setSaving(false);
      return;
    }
    const res = await fetch(`/api/transactions/${tx.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        description,
        amount: numericAmount,
        categoryId: categoryId || null,
        owner,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d?.error || "Erro ao salvar");
      setSaving(false);
      return;
    }
    onSaved();
  }

  async function remove() {
    if (!confirm("Excluir este lançamento?")) return;
    setDeleting(true);
    const res = await fetch(`/api/transactions/${tx.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d?.error || "Erro ao excluir");
      setDeleting(false);
      return;
    }
    onSaved();
  }

  return (
    <Modal title="Editar lançamento" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Data</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Valor</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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
            className="w-full px-3 py-2 rounded-lg border border-border bg-background"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Categoria</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background"
          >
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Quem usou</label>
          <div className="grid grid-cols-3 gap-2">
            {(["PARTNER_A", "PARTNER_B", "COUPLE"] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOwner(o)}
                className={`px-3 py-2 rounded-lg border text-sm ${
                  owner === o
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                {o === "PARTNER_A" ? partnerA : o === "PARTNER_B" ? partnerB : "Casal"}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-lg">{error}</div>
        )}

        <div className="flex justify-between items-center pt-2">
          <button
            type="button"
            onClick={remove}
            disabled={deleting || saving}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-50 text-sm"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? "Excluindo..." : "Excluir"}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || deleting}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function PayInvoiceModal({
  invoice,
  accounts,
  settings,
  onClose,
  onPaid,
}: {
  invoice: Invoice;
  accounts: Account[];
  settings: Settings | null;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [paymentAccountId, setPaymentAccountId] = useState(accounts[0]?.id || "");
  const inferOwner = (accId: string): "PARTNER_A" | "PARTNER_B" | "COUPLE" => {
    const a = accounts.find((x) => x.id === accId);
    return (a?.owner as any) || "COUPLE";
  };
  const [paidBy, setPaidBy] = useState<"PARTNER_A" | "PARTNER_B" | "COUPLE">(
    inferOwner(accounts[0]?.id || "")
  );
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [skipTransfer, setSkipTransfer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPaidBy(inferOwner(paymentAccountId));
  }, [paymentAccountId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: any = {
      action: "pay",
      paidAt,
      paidBy: paidBy === "COUPLE" ? null : paidBy,
    };
    if (skipTransfer) {
      payload.skipTransfer = true;
    } else {
      payload.paymentAccountId = paymentAccountId;
    }
    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d?.error || "Erro");
      setSaving(false);
      return;
    }
    onPaid();
  }

  return (
    <Modal title="Pagar fatura" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {skipTransfer ? (
            <>
              A fatura será marcada como paga, <strong>sem</strong> registrar a saída do
              dinheiro. Use isso para faturas antigas que você já pagou na vida real.
            </>
          ) : (
            <>
              Será criada uma transferência de {formatCurrency(invoice.total)} da conta
              escolhida para o cartão, e a fatura será marcada como paga.
            </>
          )}
        </p>

        <label className="flex items-start gap-2 p-3 rounded-lg border border-border bg-muted/30 cursor-pointer hover:bg-muted/50">
          <input
            type="checkbox"
            checked={skipTransfer}
            onChange={(e) => setSkipTransfer(e.target.checked)}
            className="mt-0.5"
          />
          <div className="text-sm">
            <strong>Só marcar como paga, sem registrar saída</strong>
            <p className="text-xs text-muted-foreground mt-0.5">
              Útil pra faturas passadas (importadas com a IA, por exemplo) que você já pagou
              no mundo real e não quer criar uma transferência fake agora.
            </p>
          </div>
        </label>

        {!skipTransfer && (
          <div>
            <label className="block text-sm font-medium mb-1">Pagar com</label>
            <select
              required
              value={paymentAccountId}
              onChange={(e) => setPaymentAccountId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Quem pagou</label>
          <div className="grid grid-cols-3 gap-2">
            {(["PARTNER_A", "PARTNER_B", "COUPLE"] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setPaidBy(o)}
                className={`px-3 py-2 rounded-lg border text-sm ${
                  paidBy === o
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
          <p className="text-[11px] text-muted-foreground mt-1">
            Se uma pessoa só pagou, as compras dessa fatura entram como "paguei pelo casal"
            no Acerto.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Data do pagamento</label>
          <input
            type="date"
            required
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
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
            {saving ? "Salvando..." : skipTransfer ? "Marcar como paga" : "Confirmar pagamento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

type ParsedRow = {
  date: string;
  description: string;
  amount: number;
  categoryId: string | null;
  owner: Owner;
  paidByOwner?: "PARTNER_A" | "PARTNER_B" | null;
  excluded?: boolean;
  matchStatus?: "new" | "matched";
  matchedTxId?: string | null;
};

function normalizeDesc(s: string): string {
  // Match by value+name, ignoring case, accents, digits (parcela markers),
  // punctuation and length variations from the IA. Keep only the first 8
  // letters — collisions get filtered by amount tolerance anyway.
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^a-z]/g, "")
    .slice(0, 8);
}

function ImportInvoiceModal({
  cards,
  defaultCardId,
  settings,
  existingInvoice,
  onClose,
  onImported,
}: {
  cards: Account[];
  defaultCardId: string;
  settings: Settings | null;
  existingInvoice?: Invoice | null;
  onClose: () => void;
  onImported: () => void;
}) {
  const reviewMode = !!existingInvoice;
  const [step, setStep] = useState<"paste" | "review">("paste");
  const [mode, setMode] = useState<"pdf" | "text">("pdf");
  const [accountId, setAccountId] = useState(existingInvoice?.accountId || defaultCardId);
  const [text, setText] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPassword, setPdfPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date();
  const [invoiceMonth, setInvoiceMonth] = useState<string>(
    existingInvoice
      ? `${existingInvoice.year}-${String(existingInvoice.month).padStart(2, "0")}`
      : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  );
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [bulkDate, setBulkDate] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");

  const partnerA = settings?.partnerAName || "Pessoa A";
  const partnerB = settings?.partnerBName || "Pessoa B";

  async function analyze() {
    setBusy(true);
    setError(null);
    let res: Response;
    if (mode === "pdf") {
      if (!pdfFile) {
        setBusy(false);
        setError("Selecione um arquivo PDF");
        return;
      }
      const fd = new FormData();
      fd.append("accountId", accountId);
      fd.append("file", pdfFile);
      if (pdfPassword) fd.append("password", pdfPassword);
      res = await fetch("/api/import/parse-pdf", { method: "POST", body: fd });
    } else {
      res = await fetch("/api/import/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, text }),
      });
    }
    const rawText = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      // resposta não-JSON (timeout, HTML de erro do Vercel, etc.)
    }
    setBusy(false);
    if (!res.ok) {
      if (data?.code === "needs_password") {
        setNeedsPassword(true);
      }
      const fallback =
        res.status === 504 || res.status === 408
          ? "A análise demorou demais e foi interrompida. Tente um PDF menor ou o modo 'Colar texto'."
          : `Erro ao analisar (HTTP ${res.status}). ${rawText.slice(0, 200)}`;
      setError(data?.error || fallback);
      return;
    }
    if (!data.transactions || data.transactions.length === 0) {
      setError("Nenhuma compra identificada. Verifique se o PDF é a fatura completa.");
      return;
    }
    setCategories(data.categories || []);
    const isProjectionCategory = (name: string | null | undefined) =>
      typeof name === "string" && name.toLowerCase().includes("parcelad");
    const existingPool = existingInvoice
      ? existingInvoice.transactions
          .filter((t) => !isProjectionCategory(t.category?.name))
          .map((t) => ({
            id: t.id,
            amount: t.amount,
            normDesc: normalizeDesc(t.description),
            used: false,
          }))
      : [];
    const parsed: ParsedRow[] = data.transactions.map((t: any) => {
      const row: ParsedRow = {
        date: t.date,
        description: t.description,
        amount: t.amount,
        categoryId: t.categoryId ?? null,
        owner: (t.owner as Owner) || "COUPLE",
        paidByOwner: null,
        excluded: false,
      };
      if (existingInvoice) {
        const nd = normalizeDesc(t.description);
        const matchIdx = existingPool.findIndex(
          (e) => !e.used && Math.abs(e.amount - t.amount) < 0.01 && e.normDesc === nd
        );
        if (matchIdx >= 0) {
          existingPool[matchIdx].used = true;
          row.matchStatus = "matched";
          row.matchedTxId = existingPool[matchIdx].id;
          row.excluded = true;
        } else {
          row.matchStatus = "new";
          row.excluded = false;
        }
      }
      return row;
    });
    setRows(parsed);
    setStep("review");
  }

  async function commit() {
    setBusy(true);
    setError(null);
    const toSend = rows
      .filter((r) => !r.excluded)
      .map((r) => ({
        date: r.date,
        description: r.description,
        amount: r.amount,
        categoryId: r.categoryId,
        owner: r.owner,
        paidByOwner: r.paidByOwner ?? null,
        forceNew: reviewMode && r.matchStatus === "new",
      }));
    if (toSend.length === 0) {
      setError("Nenhuma linha selecionada para importar");
      setBusy(false);
      return;
    }
    let invoiceYear: number | undefined;
    let invoiceMonthNum: number | undefined;
    const m = invoiceMonth.match(/^(\d{4})-(\d{2})$/);
    if (m) {
      invoiceYear = parseInt(m[1], 10);
      invoiceMonthNum = parseInt(m[2], 10) - 1;
    }
    const res = await fetch("/api/import/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        rows: toSend,
        invoiceYear,
        invoiceMonth: invoiceMonthNum,
        invoiceDueDate: invoiceDueDate || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data?.error || "Erro ao salvar");
      return;
    }
    onImported();
  }

  function updateRow(i: number, patch: Partial<ParsedRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  const visibleRowsWithIdx = rows
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => {
      if (filterFrom && row.date < filterFrom) return false;
      if (filterTo && row.date > filterTo) return false;
      return true;
    });
  const visibleRows = visibleRowsWithIdx.map((x) => x.row);

  function bulkSetExcluded(excluded: boolean) {
    const visibleIdx = new Set(visibleRowsWithIdx.map((x) => x.i));
    setRows((rs) => rs.map((r, i) => (visibleIdx.has(i) ? { ...r, excluded } : r)));
  }

  function addManualRow() {
    // Default date to the chosen invoice month's first day, fallback to today
    const m = invoiceMonth.match(/^(\d{4})-(\d{2})$/);
    const defaultDate = m
      ? `${m[1]}-${m[2]}-01`
      : new Date().toISOString().slice(0, 10);
    setRows((rs) => [
      ...rs,
      {
        date: defaultDate,
        description: "",
        amount: 0,
        categoryId: null,
        owner: "COUPLE",
        paidByOwner: null,
        excluded: false,
        matchStatus: "new",
      },
    ]);
  }

  function applyBulkDate() {
    if (!bulkDate || !/^\d{4}-\d{2}-\d{2}$/.test(bulkDate)) return;
    const visibleIdx = new Set(visibleRowsWithIdx.map((x) => x.i));
    setRows((rs) => rs.map((r, i) => (visibleIdx.has(i) ? { ...r, date: bulkDate } : r)));
  }

  const total = rows.filter((r) => !r.excluded).reduce((s, r) => s + r.amount, 0);
  const includedCount = rows.filter((r) => !r.excluded).length;

  return (
    <Modal title="Importar fatura com IA" onClose={onClose} maxWidth="max-w-5xl">
      {step === "paste" ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Cartão</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            >
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("pdf")}
              className={`px-3 py-2 rounded-lg border text-sm font-medium ${
                mode === "pdf"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              📄 Enviar PDF
            </button>
            <button
              type="button"
              onClick={() => setMode("text")}
              className={`px-3 py-2 rounded-lg border text-sm font-medium ${
                mode === "text"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              ✍️ Colar texto
            </button>
          </div>

          {mode === "pdf" ? (
            <div>
              <label className="block text-sm font-medium mb-1">PDF da fatura</label>
              <p className="text-xs text-muted-foreground mb-2">
                Baixe a fatura em PDF pelo app/internet banking e envie aqui. A IA vai ler
                o documento e identificar cada compra. Limite: 4MB.
              </p>
              <label
                className={`flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                  pdfFile ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                }`}
              >
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                />
                {pdfFile ? (
                  <>
                    <span className="text-2xl">📄</span>
                    <span className="text-sm font-medium">{pdfFile.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(pdfFile.size / 1024 / 1024).toFixed(2)} MB · clique para trocar
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">📄</span>
                    <span className="text-sm font-medium">Clique para escolher o PDF</span>
                    <span className="text-xs text-muted-foreground">
                      ou arraste o arquivo aqui
                    </span>
                  </>
                )}
              </label>

              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">
                  Senha do PDF{" "}
                  <span className="text-muted-foreground font-normal">
                    (deixe em branco se não tiver)
                  </span>
                </label>
                <input
                  type="password"
                  value={pdfPassword}
                  onChange={(e) => {
                    setPdfPassword(e.target.value);
                    setNeedsPassword(false);
                  }}
                  placeholder="Senha do arquivo"
                  autoComplete="off"
                  className={`w-full px-3 py-2 rounded-lg border bg-background ${
                    needsPassword ? "border-destructive" : "border-border"
                  }`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Geralmente é seu CPF (sem pontos) ou os 4 últimos dígitos do cartão.
                  Confira no e-mail/app do banco.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">
                Cole aqui o texto da fatura
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Abra o app do banco, copie a lista de compras (Ctrl+A, Ctrl+C dentro do
                PDF/extrato funciona) e cole abaixo.
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ex:&#10;15/04  CARREFOUR        152,30&#10;16/04  IFOOD            48,90&#10;..."
                rows={12}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">{text.length} caracteres</p>
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-lg">{error}</div>
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
              type="button"
              onClick={analyze}
              disabled={
                busy ||
                (mode === "pdf" ? !pdfFile : text.trim().length < 20)
              }
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {busy ? "Analisando..." : "Analisar com IA"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {reviewMode && existingInvoice ? (() => {
            const isProjectionCategory = (name: string | null | undefined) =>
              typeof name === "string" && name.toLowerCase().includes("parcelad");
            const considerable = existingInvoice.transactions.filter(
              (t) => !isProjectionCategory(t.category?.name)
            );
            const ignored = existingInvoice.transactions.length - considerable.length;
            const matched = rows.filter((r) => r.matchStatus === "matched").length;
            const newRows = rows.filter((r) => r.matchStatus === "new").length;
            const matchedIds = new Set(
              rows.filter((r) => r.matchedTxId).map((r) => r.matchedTxId)
            );
            const missing = considerable.filter((t) => !matchedIds.has(t.id));
            const parsedTotal = rows.reduce((s, r) => s + r.amount, 0);
            const systemTotal = considerable.reduce((s, t) => s + t.amount, 0);
            const diff = parsedTotal - systemTotal;
            return (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-3">
                <p className="text-sm font-semibold">
                  Comparação com a fatura no sistema
                </p>
                {ignored > 0 && (
                  <p className="text-[11px] text-muted-foreground italic">
                    Ignorando {ignored} compra{ignored === 1 ? "" : "s"} da categoria de parcelas
                    futuras (não fazem parte desta fatura ainda).
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-card border border-border rounded p-2">
                    <p className="text-muted-foreground">Total no PDF</p>
                    <p className="font-semibold tabular-nums">{formatCurrency(parsedTotal)}</p>
                  </div>
                  <div className="bg-card border border-border rounded p-2">
                    <p className="text-muted-foreground">Total no sistema</p>
                    <p className="font-semibold tabular-nums">{formatCurrency(systemTotal)}</p>
                  </div>
                  <div className={`border rounded p-2 ${Math.abs(diff) < 0.01 ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30"}`}>
                    <p className="text-muted-foreground">Diferença</p>
                    <p className={`font-semibold tabular-nums ${Math.abs(diff) < 0.01 ? "text-success" : "text-destructive"}`}>
                      {formatCurrency(diff)}
                    </p>
                  </div>
                </div>
                <div className="text-xs">
                  <p>
                    <span className="text-success">●</span> <strong>{matched}</strong> compra
                    {matched === 1 ? "" : "s"} já está{matched === 1 ? "" : "ão"} no sistema
                    (não vou criar de novo)
                  </p>
                  <p>
                    <span className="text-primary">●</span> <strong>{newRows}</strong> compra
                    {newRows === 1 ? "" : "s"} no PDF não está{newRows === 1 ? "" : "ão"} no
                    sistema — marcadas pra adicionar
                  </p>
                  {missing.length > 0 && (
                    <div className="mt-2 p-2 bg-warning/10 border border-warning/30 rounded">
                      <p className="font-medium text-warning mb-1">
                        ⚠️ {missing.length} compra{missing.length === 1 ? " está" : "s estão"} no
                        sistema mas NÃO apareceu{missing.length === 1 ? "" : "ram"} no PDF:
                      </p>
                      <ul className="ml-4 list-disc">
                        {missing.slice(0, 10).map((t) => (
                          <li key={t.id}>
                            {new Date(t.date).toLocaleDateString("pt-BR")} — {t.description} —{" "}
                            {formatCurrency(t.amount)}
                          </li>
                        ))}
                        {missing.length > 10 && (
                          <li>…e mais {missing.length - 10}</li>
                        )}
                      </ul>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Talvez você queira excluir essas linhas direto na fatura (no botão Excluir
                        de cada uma).
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })() : (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm">
              <strong>⚠️ Quase lá!</strong> A IA já analisou — agora <strong>revise as linhas
              abaixo</strong> (mude categorias, marque quem usou, exclua linhas erradas) e clique
              em <strong>"Confirmar e criar X lançamentos"</strong> no fim da página para
              <strong> salvar</strong>. Se fechar agora, nada é salvo.
            </div>
          )}

          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Mês desta fatura</label>
              <input
                type="month"
                value={invoiceMonth}
                onChange={(e) => setInvoiceMonth(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Tudo cai no vencimento desse mês, independente da data da compra.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Data de vencimento da fatura <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <input
                type="date"
                value={invoiceDueDate}
                onChange={(e) => setInvoiceDueDate(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Vazio = usa o vencimento padrão do cartão.
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-3">
              <label className="block text-xs font-medium mb-1">
                Data da compra — aplicar em todas {(filterFrom || filterTo) ? "(visíveis no filtro)" : ""}
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-border bg-background text-sm"
                />
                <button
                  type="button"
                  onClick={applyBulkDate}
                  disabled={!bulkDate}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 text-xs font-medium"
                >
                  Aplicar em todas
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Sobrescreve a data da compra de cada linha. Útil pra alinhar tudo com o
                vencimento.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Filtro: data de</label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Filtro: data até</label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm">
              <strong>{includedCount}</strong> de <strong>{rows.length}</strong> compras
              selecionadas — total{" "}
              <strong className="tabular-nums">{formatCurrency(total)}</strong>
              {(filterFrom || filterTo) && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({visibleRows.length} visíveis com o filtro)
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              {(filterFrom || filterTo) && (
                <>
                  <button
                    type="button"
                    onClick={() => bulkSetExcluded(true)}
                    className="text-xs px-2 py-1 rounded border border-border hover:bg-destructive/10 hover:text-destructive"
                  >
                    Excluir todas visíveis
                  </button>
                  <button
                    type="button"
                    onClick={() => bulkSetExcluded(false)}
                    className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
                  >
                    Incluir todas visíveis
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={addManualRow}
                className="text-xs px-2 py-1 rounded border border-primary text-primary hover:bg-primary/10 font-medium"
                title="Adicionar uma compra que a IA não detectou"
              >
                + Adicionar linha
              </button>
              <button
                type="button"
                onClick={() => setStep("paste")}
                className="text-xs text-muted-foreground hover:underline"
              >
                ← Voltar e colar de novo
              </button>
            </div>
          </div>
          <div className="border border-border rounded-lg overflow-x-auto max-h-[55vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground text-left sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-2 font-medium w-10"></th>
                  <th className="px-2 py-2 font-medium">Data</th>
                  <th className="px-2 py-2 font-medium">Descrição</th>
                  <th className="px-2 py-2 font-medium text-right">Valor</th>
                  <th className="px-2 py-2 font-medium">Categoria</th>
                  <th className="px-2 py-2 font-medium">Quem usou</th>
                </tr>
              </thead>
              <tbody>
                {visibleRowsWithIdx.map(({ row: r, i }) => (
                  <tr
                    key={i}
                    className={`border-t border-border ${
                      r.excluded ? "opacity-40 line-through" : ""
                    }`}
                  >
                    <td className="px-2 py-1.5">
                      <button
                        onClick={() => updateRow(i, { excluded: !r.excluded })}
                        className="text-muted-foreground hover:text-destructive"
                        title={r.excluded ? "Restaurar" : "Excluir esta linha"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="date"
                        value={r.date}
                        onChange={(e) => updateRow(i, { date: e.target.value })}
                        className="px-1 py-0.5 rounded border border-border bg-background text-xs"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={r.description}
                          onChange={(e) => updateRow(i, { description: e.target.value })}
                          className="flex-1 px-1 py-0.5 rounded border border-border bg-background"
                        />
                        {reviewMode && (
                          <select
                            value={r.matchStatus ?? "new"}
                            onChange={(e) => {
                              const v = e.target.value as "new" | "matched";
                              updateRow(i, {
                                matchStatus: v,
                                excluded: v === "matched",
                              });
                            }}
                            title="Forçar status: nova adiciona ao sistema, já no sistema é pulada"
                            className={`text-[10px] px-1 py-0.5 rounded font-medium whitespace-nowrap border ${
                              r.matchStatus === "matched"
                                ? "bg-success/15 text-success border-success/30"
                                : "bg-primary/15 text-primary border-primary/30"
                            }`}
                          >
                            <option value="new">nova</option>
                            <option value="matched">já no sistema</option>
                          </select>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={r.amount}
                        onChange={(e) =>
                          updateRow(i, { amount: parseFloat(e.target.value) || 0 })
                        }
                        className="w-24 px-1 py-0.5 rounded border border-border bg-background text-right tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={r.categoryId ?? ""}
                        onChange={(e) =>
                          updateRow(i, { categoryId: e.target.value || null })
                        }
                        className="w-full px-1 py-0.5 rounded border border-border bg-background"
                      >
                        <option value="">— sem categoria —</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={r.owner}
                        onChange={(e) => updateRow(i, { owner: e.target.value as Owner })}
                        className="px-1 py-0.5 rounded border border-border bg-background"
                      >
                        <option value="COUPLE">Casal</option>
                        <option value="PARTNER_A">{partnerA}</option>
                        <option value="PARTNER_B">{partnerB}</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {reviewMode && existingInvoice && existingInvoice.transactions.length > 0 && (
            <details className="border border-border rounded-lg" open>
              <summary className="px-3 py-2 cursor-pointer bg-muted/30 text-sm font-medium flex items-center justify-between">
                <span>
                  Lançamentos já no sistema desta fatura ({existingInvoice.transactions.length})
                </span>
                <span className="text-xs text-muted-foreground font-normal">
                  Use o pincel pra editar a data, ou a lixeira pra excluir compras erradas — sem
                  fechar essa revisão.
                </span>
              </summary>
              <div className="max-h-[35vh] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/20 text-muted-foreground text-left sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">Data</th>
                      <th className="px-2 py-1.5 font-medium">Descrição</th>
                      <th className="px-2 py-1.5 font-medium text-right">Valor</th>
                      <th className="px-2 py-1.5 font-medium">Categoria</th>
                      <th className="px-2 py-1.5 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {existingInvoice.transactions.map((t) => (
                      <tr key={t.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-2 py-1">
                          {new Date(t.date).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-2 py-1">{t.description}</td>
                        <td className="px-2 py-1 text-right tabular-nums">
                          {formatCurrency(t.amount)}
                        </td>
                        <td className="px-2 py-1">
                          {t.category ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: t.category.color }}
                              />
                              {t.category.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">sem cat.</span>
                          )}
                        </td>
                        <td className="px-2 py-1 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm(`Excluir "${t.description}" do sistema?`)) return;
                              await fetch(`/api/transactions/${t.id}`, { method: "DELETE" });
                              onImported();
                            }}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            title="Excluir do sistema"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-lg">{error}</div>
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
              type="button"
              onClick={commit}
              disabled={busy || includedCount === 0}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Salvando..." : `Confirmar e criar ${includedCount} lançamentos`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}


function NewCardModal({
  settings,
  card,
  onClose,
  onCreated,
}: {
  settings: Settings | null;
  card?: Account | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState(card?.name ?? "");
  const [color, setColor] = useState(card?.color ?? "#6366f1");
  const [creditLimit, setCreditLimit] = useState(card?.creditLimit?.toString() ?? "");
  const [closingDay, setClosingDay] = useState(card?.closingDay?.toString() ?? "");
  const [dueDay, setDueDay] = useState(card?.dueDay?.toString() ?? "");
  const [initialBalance, setInitialBalance] = useState(card?.initialBalance?.toString() ?? "0");
  const [owner, setOwner] = useState<"PARTNER_A" | "PARTNER_B" | "COUPLE">(card?.owner ?? "COUPLE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    if (!name.trim()) {
      setError("Nome obrigatório");
      setSaving(false);
      return;
    }
    if (!closingDay || !dueDay) {
      setError("Dia de fechamento e vencimento são obrigatórios");
      setSaving(false);
      return;
    }
    const url = card ? `/api/accounts/${card.id}` : "/api/accounts";
    const res = await fetch(url, {
      method: card ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        type: "CREDIT_CARD",
        color,
        initialBalance: parseFloat(initialBalance.replace(",", ".")) || 0,
        creditLimit: creditLimit ? parseFloat(creditLimit.replace(",", ".")) : null,
        closingDay: parseInt(closingDay, 10),
        dueDay: parseInt(dueDay, 10),
        owner,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Erro ao salvar");
      return;
    }
    onCreated();
  }

  async function archiveCard() {
    if (!card) return;
    if (!confirm("Arquivar este cartão? Ele some das listas mas os lançamentos antigos continuam.")) return;
    const res = await fetch(`/api/accounts/${card.id}`, { method: "DELETE" });
    if (res.ok) onCreated();
  }

  return (
    <Modal title={card ? "Editar cartão" : "Novo cartão de crédito"} onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome do cartão</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Itaú Platinum"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Dono do cartão</label>
          <div className="grid grid-cols-3 gap-2">
            {(["PARTNER_A", "PARTNER_B", "COUPLE"] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOwner(o)}
                className={`px-3 py-2 rounded-lg border text-sm ${
                  owner === o
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                {o === "PARTNER_A"
                  ? settings?.partnerAName ?? "Você"
                  : o === "PARTNER_B"
                  ? settings?.partnerBName ?? "Parceiro"
                  : "Casal"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Cor</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 rounded border border-border cursor-pointer"
            />
            <span className="text-xs text-muted-foreground">{color}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Dia de fechamento</label>
            <input
              required
              type="number"
              min={1}
              max={31}
              value={closingDay}
              onChange={(e) => setClosingDay(e.target.value)}
              placeholder="Ex: 20"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Quando a fatura fecha</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Dia de vencimento</label>
            <input
              required
              type="number"
              min={1}
              max={31}
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              placeholder="Ex: 9"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Quando você paga</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Limite do cartão <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <input
            inputMode="decimal"
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
            placeholder="Ex: 5000"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Saldo da fatura em aberto <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <input
            inputMode="decimal"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            placeholder="0,00"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Se o cartão já tem gasto antes de você cadastrar
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-between items-center gap-2 pt-2">
          <div>
            {card && (
              <button
                type="button"
                onClick={archiveCard}
                className="px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10"
              >
                Arquivar
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 text-sm font-medium"
            >
              {saving ? "Salvando..." : card ? "Salvar" : "Cadastrar"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

