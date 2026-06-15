"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/financas/toaster";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { Plus, Pencil, Archive, ArchiveRestore, Trash2, Wallet } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/financas/page-header";
import { formatCurrency } from "@/lib/utils";
import { ACCOUNT_TYPE_LABEL } from "@/lib/financas/defaults";

type Owner = "PARTNER_A" | "PARTNER_B" | "COUPLE";

type Account = {
  id: string;
  name: string;
  type: keyof typeof ACCOUNT_TYPE_LABEL;
  initialBalance: number;
  balance: number;
  color: string;
  archived: boolean;
  creditLimit: number | null;
  closingDay: number | null;
  dueDay: number | null;
  owner: Owner;
};

const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABEL) as (keyof typeof ACCOUNT_TYPE_LABEL)[];

const COLORS = [
  "#6366f1", "#10b981", "#f97316", "#ef4444", "#eab308",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#737373",
];

type SettingsLite = { partnerAName: string; partnerBName: string };

export function ContasClient() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [settings, setSettings] = useState<SettingsLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const [resA, resS] = await Promise.all([
      fetch("/api/accounts"),
      fetch("/api/settings"),
    ]);
    const data = await resA.json();
    setAccounts(Array.isArray(data) ? data : []);
    setSettings(await resS.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(id: string) {
    const ok = await confirmDialog({ title: "Excluir esta conta?", description: "Se houver lançamentos, vai ser arquivada em vez de excluída.", variant: "destructive", confirmLabel: "Excluir" }); if (!ok) return;
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    load();
  }

  async function toggleArchive(a: Account) {
    await fetch(`/api/accounts/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !a.archived }),
    });
    load();
  }

  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);

  return (
    <div>
      <PageHeader
        title="Contas"
        description="Conta corrente, poupança, dinheiro em espécie ou investimentos — onde seu dinheiro fica. Cartões de crédito ficam separados em Cartões de Crédito."
        actions={
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" />
            Nova conta
          </button>
        }
      />

      <div className="bg-muted/30 border border-border rounded-lg p-4 mb-5 text-sm text-muted-foreground">
        <p className="mb-2">
          <strong className="text-foreground">Pra que serve esta tela?</strong> Aqui você
          cadastra cada lugar de onde seu dinheiro entra ou sai:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs">
          <li>
            <strong>Conta corrente / poupança</strong> — pra você dizer "essa despesa saiu do
            meu Nubank corrente"
          </li>
          <li>
            <strong>Cartões de crédito</strong> — ficam em outra aba (Cartões de Crédito), porque
            funcionam diferente (geram faturas)
          </li>
          <li>
            <strong>Dinheiro / vale-alimentação / investimentos</strong> — qualquer carteira
            de onde sai dinheiro vira uma conta
          </li>
        </ul>
        <p className="mt-2 text-xs">
          💡 <strong>Saldo inicial</strong>: coloque quanto havia nessa conta no dia que você
          começou a usar o sistema. Sem isso, o saldo vai ficar negativo porque as despesas
          são contadas mas o dinheiro anterior é zero.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : active.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <Wallet className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma conta ainda.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {(["PARTNER_A", "PARTNER_B", "COUPLE"] as Owner[]).map((o) => {
            const group = active.filter((a) => a.owner === o);
            if (group.length === 0) return null;
            const label =
              o === "PARTNER_A"
                ? settings?.partnerAName ?? "Você"
                : o === "PARTNER_B"
                ? settings?.partnerBName ?? "Parceiro"
                : "Casal (compartilhadas)";
            return (
              <div key={o}>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {label}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.map((a) => (
                    <AccountCard
                      key={a.id}
                      account={a}
                      onEdit={() => setEditing(a)}
                      onArchive={() => toggleArchive(a)}
                      onDelete={() => remove(a.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">
            Arquivadas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {archived.map((a) => (
              <AccountCard
                key={a.id}
                account={a}
                onEdit={() => setEditing(a)}
                onArchive={() => toggleArchive(a)}
                onDelete={() => remove(a.id)}
              />
            ))}
          </div>
        </div>
      )}

      {creating && (
        <AccountModal
          settings={settings}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      )}
      {editing && (
        <AccountModal
          settings={settings}
          account={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function AccountCard({
  account,
  onEdit,
  onArchive,
  onDelete,
}: {
  account: Account;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="bg-card border border-border rounded-xl p-5 relative overflow-hidden"
      style={{
        borderTopColor: account.color,
        borderTopWidth: 3,
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {ACCOUNT_TYPE_LABEL[account.type]}
          </p>
          <h3 className="text-lg font-semibold mt-0.5">{account.name}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Editar"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onArchive}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
            title={account.archived ? "Desarquivar" : "Arquivar"}
          >
            {account.archived ? (
              <ArchiveRestore className="w-4 h-4" />
            ) : (
              <Archive className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Saldo atual</p>
        <p
          className={`text-2xl font-bold ${
            account.balance < 0 ? "text-destructive" : ""
          }`}
        >
          {formatCurrency(account.balance)}
        </p>
      </div>
    </div>
  );
}

function AccountModal({
  account,
  settings,
  onClose,
  onSaved,
}: {
  account?: Account;
  settings: SettingsLite | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ownerLabel = (o: Owner) =>
    o === "PARTNER_A"
      ? settings?.partnerAName ?? "Você"
      : o === "PARTNER_B"
      ? settings?.partnerBName ?? "Parceiro"
      : "Casal";
  const [name, setName] = useState(account?.name || "");
  const [type, setType] = useState<keyof typeof ACCOUNT_TYPE_LABEL>(account?.type || "CHECKING");
  const [initialBalance, setInitialBalance] = useState(
    account?.initialBalance ?? 0
  );
  const [color, setColor] = useState(account?.color || COLORS[0]);
  const [creditLimit, setCreditLimit] = useState(account?.creditLimit?.toString() ?? "");
  const [closingDay, setClosingDay] = useState(account?.closingDay?.toString() ?? "");
  const [dueDay, setDueDay] = useState(account?.dueDay?.toString() ?? "");
  const [owner, setOwner] = useState<Owner>(account?.owner || "COUPLE");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const url = account
      ? `/api/accounts/${account.id}`
      : "/api/accounts";
    const payload: any = { name, type, initialBalance, color, owner };
    if (type === "CREDIT_CARD") {
      payload.creditLimit = creditLimit ? parseFloat(creditLimit) : null;
      payload.closingDay = closingDay ? parseInt(closingDay, 10) : null;
      payload.dueDay = dueDay ? parseInt(dueDay, 10) : null;
    } else if (account) {
      payload.creditLimit = null;
      payload.closingDay = null;
      payload.dueDay = null;
    }
    const res = await fetch(url, {
      method: account ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || "Erro ao salvar");
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <Modal title={account ? "Editar conta" : "Nova conta"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Nubank"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background"
          >
            {ACCOUNT_TYPES.filter((t) => account || t !== "CREDIT_CARD").map((t) => (
              <option key={t} value={t}>
                {ACCOUNT_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Dono</label>
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
                {ownerLabel(o)}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Quem é dono dessa conta. Despesas dessa pessoa vão sugerir essa conta automaticamente.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            {type === "CREDIT_CARD" ? "Saldo da fatura em aberto" : "Saldo inicial"}
          </label>
          <input
            type="number"
            inputMode="decimal"
              step="0.01"
            value={initialBalance}
            onChange={(e) => setInitialBalance(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Quanto havia nesta conta antes de começar a usar o app.
          </p>
        </div>

        {type === "CREDIT_CARD" && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Limite</label>
              <input
                type="number"
                inputMode="decimal"
              step="0.01"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fechamento</label>
              <input
                type="number"
                min={1}
                max={31}
                value={closingDay}
                onChange={(e) => setClosingDay(e.target.value)}
                placeholder="Dia"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vencimento</label>
              <input
                type="number"
                min={1}
                max={31}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                placeholder="Dia"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background"
              />
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Cor</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full border-2 ${
                  color === c ? "border-foreground" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
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
