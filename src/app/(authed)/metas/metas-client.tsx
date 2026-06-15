"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/financas/toaster";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { Plus, Pencil, Trash2, PiggyBank, Target, Archive, ArchiveRestore } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/financas/page-header";
import { formatCurrency } from "@/lib/utils";

type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  color: string;
  notes: string | null;
  archived: boolean;
  contributions: { id: string; amount: number; date: string; notes: string | null }[];
};

const COLORS = ["#6366f1", "#10b981", "#f97316", "#ec4899", "#06b6d4", "#a855f7", "#eab308", "#ef4444"];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function MetasClient() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [contributing, setContributing] = useState<Goal | null>(null);

  async function load() {
    setLoading(true);
    const data = await fetch("/api/goals").then((r) => r.json());
    setGoals(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(id: string) {
    const ok = await confirmDialog({ title: "Excluir esta meta?", description: "Os aportes registrados também serão apagados.", variant: "destructive", confirmLabel: "Excluir" }); if (!ok) return;
    await fetch(`/api/goals/${id}`, { method: "DELETE" });
    load();
  }

  async function toggleArchive(g: Goal) {
    await fetch(`/api/goals/${g.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !g.archived }),
    });
    load();
  }

  const active = goals.filter((g) => !g.archived);
  const archived = goals.filter((g) => g.archived);

  return (
    <div>
      <PageHeader
        title="Metas e poupança"
        description="Defina objetivos (viagem, reserva, casamento...) e acompanhe o progresso."
        actions={
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Nova meta
          </button>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : active.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <Target className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma meta ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {active.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              onContribute={() => setContributing(g)}
              onEdit={() => setEditing(g)}
              onArchive={() => toggleArchive(g)}
              onDelete={() => remove(g.id)}
            />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Arquivadas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {archived.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                onContribute={() => setContributing(g)}
                onEdit={() => setEditing(g)}
                onArchive={() => toggleArchive(g)}
                onDelete={() => remove(g.id)}
              />
            ))}
          </div>
        </div>
      )}

      {(creating || editing) && (
        <GoalModal
          goal={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}

      {contributing && (
        <ContributeModal
          goal={contributing}
          onClose={() => setContributing(null)}
          onSaved={() => {
            setContributing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function GoalCard({
  goal,
  onContribute,
  onEdit,
  onArchive,
  onDelete,
}: {
  goal: Goal;
  onContribute: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const pct =
    goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
  const remaining = goal.targetAmount - goal.currentAmount;

  return (
    <div
      className="bg-card border border-border rounded-xl p-5"
      style={{ borderTopColor: goal.color, borderTopWidth: 3 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <PiggyBank className="w-5 h-5" style={{ color: goal.color }} />
          <h3 className="text-lg font-semibold">{goal.name}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={onArchive} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
            {goal.archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">Progresso</span>
        <span className="tabular-nums font-medium">
          {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
        </span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden mb-2">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: goal.color }} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
        <span>{pct.toFixed(0)}% concluído</span>
        {remaining > 0 && <span>Faltam {formatCurrency(remaining)}</span>}
      </div>

      {goal.targetDate && (
        <p className="text-xs text-muted-foreground mb-3">
          Prazo: {new Date(goal.targetDate).toLocaleDateString("pt-BR")}
        </p>
      )}

      {!goal.archived && (
        <button
          onClick={onContribute}
          className="w-full py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium"
        >
          Aportar
        </button>
      )}
    </div>
  );
}

function GoalModal({
  goal,
  onClose,
  onSaved,
}: {
  goal?: Goal;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(goal?.name || "");
  const [targetAmount, setTargetAmount] = useState(goal?.targetAmount?.toString() || "");
  const [currentAmount, setCurrentAmount] = useState(goal?.currentAmount?.toString() || "0");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ? goal.targetDate.slice(0, 10) : "");
  const [color, setColor] = useState(goal?.color || COLORS[0]);
  const [notes, setNotes] = useState(goal?.notes || "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const url = goal ? `/api/goals/${goal.id}` : "/api/goals";
    const payload: any = {
      name,
      targetAmount: parseFloat(targetAmount),
      color,
      notes: notes || null,
      targetDate: targetDate || null,
    };
    if (!goal) payload.currentAmount = parseFloat(currentAmount) || 0;
    const res = await fetch(url, {
      method: goal ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d?.error || "Erro");
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <Modal title={goal ? "Editar meta" : "Nova meta"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Viagem ao Japão"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Valor alvo</label>
            <input
              required
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
          </div>
          {!goal && (
            <div>
              <label className="block text-sm font-medium mb-1">Valor já guardado</label>
              <input
                type="number"
                inputMode="decimal"
              step="0.01"
                min="0"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background"
              />
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Prazo <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background"
          />
        </div>
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
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ContributeModal({
  goal,
  onClose,
  onSaved,
}: {
  goal: Goal;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const numericAmount = parseFloat(amount.replace(",", "."));
    const res = await fetch(`/api/goals/${goal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "contribute",
        amount: numericAmount,
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

  return (
    <Modal title={`Aportar em "${goal.name}"`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Valor</label>
          <input
            required
            type="number"
            inputMode="decimal"
              step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Use valor negativo para retirar"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Use valor negativo se for um saque/retirada.
          </p>
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
        <div>
          <label className="block text-sm font-medium mb-1">
            Observação <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background"
          />
        </div>
        {goal.contributions.length > 0 && (
          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Últimos aportes</p>
            <ul className="space-y-1 text-sm max-h-32 overflow-y-auto">
              {goal.contributions.slice(0, 5).map((c) => (
                <li key={c.id} className="flex justify-between">
                  <span>{new Date(c.date).toLocaleDateString("pt-BR")}</span>
                  <span className={c.amount >= 0 ? "text-success" : "text-destructive"}>
                    {c.amount >= 0 ? "+" : ""}
                    {formatCurrency(c.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
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
            {saving ? "Salvando..." : "Aportar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
