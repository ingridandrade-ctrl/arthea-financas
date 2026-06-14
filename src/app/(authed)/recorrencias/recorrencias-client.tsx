"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Power, Trash2, Repeat, PlayCircle, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/financas/page-header";
import { formatCurrency } from "@/lib/utils";

type Account = { id: string; name: string; color: string; type: string; archived: boolean };
type Category = { id: string; name: string; kind: "INCOME" | "EXPENSE"; color: string; archived: boolean };
type Settings = { partnerAName: string; partnerBName: string };

type Rule = {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  description: string;
  notes: string | null;
  owner: "PARTNER_A" | "PARTNER_B" | "COUPLE";
  account: { id: string; name: string; color: string };
  toAccountId: string | null;
  category: { id: string; name: string; color: string } | null;
  frequency: "WEEKLY" | "MONTHLY" | "YEARLY";
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  monthOfYear: number | null;
  startDate: string;
  endDate: string | null;
  lastGeneratedAt: string | null;
  active: boolean;
};

const DOW = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function RecorrenciasClient() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [running, setRunning] = useState(false);

  async function loadAll() {
    setLoading(true);
    const [r, a, c, s] = await Promise.all([
      fetch("/api/recurring").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]);
    setRules(r);
    setAccounts(a);
    setCategories(c);
    setSettings(s);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function toggleActive(rule: Rule) {
    await fetch(`/api/recurring/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !rule.active }),
    });
    loadAll();
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta recorrência?")) return;
    await fetch(`/api/recurring/${id}`, { method: "DELETE" });
    loadAll();
  }

  async function runNow() {
    setRunning(true);
    const res = await fetch("/api/recurring/run", { method: "POST" });
    const data = await res.json();
    setRunning(false);
    alert(`${data.created || 0} lançamento(s) gerado(s).`);
    loadAll();
  }

  const ownerLabel = (o: string) =>
    !settings ? o : o === "PARTNER_A" ? settings.partnerAName : o === "PARTNER_B" ? settings.partnerBName : "Casal";

  return (
    <div>
      <PageHeader
        title="Recorrências"
        description="Lançamentos que se repetem automaticamente: salário, aluguel, assinaturas..."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={runNow}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted disabled:opacity-50"
              title="Gerar agora os lançamentos pendentes até hoje"
            >
              <PlayCircle className="w-4 h-4" />
              {running ? "Gerando..." : "Gerar agora"}
            </button>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
              Nova recorrência
            </button>
          </div>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : rules.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <Repeat className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma recorrência criada.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Frequência</th>
                <th className="px-4 py-3 font-medium">Conta</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Dono</th>
                <th className="px-4 py-3 font-medium text-right">Valor</th>
                <th className="px-4 py-3 font-medium text-center">Ativa</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.description}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      {r.type === "INCOME" && <ArrowUpCircle className="w-4 h-4 text-success" />}
                      {r.type === "EXPENSE" && <ArrowDownCircle className="w-4 h-4 text-destructive" />}
                      {r.type === "TRANSFER" && <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />}
                      {r.type === "INCOME" ? "Receita" : r.type === "EXPENSE" ? "Despesa" : "Transferência"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{describeFrequency(r)}</td>
                  <td className="px-4 py-3">{r.account.name}</td>
                  <td className="px-4 py-3">
                    {r.category ? (
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: r.category.color }}
                        />
                        {r.category.name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">sem categoria</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{ownerLabel(r.owner)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {formatCurrency(r.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActive(r)} title={r.active ? "Desativar" : "Ativar"}>
                      <Power
                        className={`w-4 h-4 ${r.active ? "text-success" : "text-muted-foreground"}`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditing(r)}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => remove(r.id)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <RuleModal
          rule={editing ?? undefined}
          accounts={accounts}
          categories={categories}
          settings={settings}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            loadAll();
          }}
        />
      )}
    </div>
  );
}

function describeFrequency(r: Rule): string {
  if (r.frequency === "MONTHLY") return `Todo mês, dia ${r.dayOfMonth ?? "—"}`;
  if (r.frequency === "WEEKLY") {
    const d = r.dayOfWeek ?? new Date(r.startDate).getDay();
    return `Toda ${DOW[d]}`;
  }
  return `Anual, mês ${r.monthOfYear ?? "—"} dia ${r.dayOfMonth ?? "—"}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function RuleModal({
  rule,
  accounts,
  categories,
  settings,
  onClose,
  onSaved,
}: {
  rule?: Rule;
  accounts: Account[];
  categories: Category[];
  settings: Settings | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!rule;
  const [name, setName] = useState(rule?.name || "");
  const [type, setType] = useState<"INCOME" | "EXPENSE" | "TRANSFER">(rule?.type || "EXPENSE");
  const [amount, setAmount] = useState(rule?.amount?.toString() || "");
  const [description, setDescription] = useState(rule?.description || "");
  const [owner, setOwner] = useState<"PARTNER_A" | "PARTNER_B" | "COUPLE">(rule?.owner || "COUPLE");
  const [accountId, setAccountId] = useState(rule?.account.id || accounts.find((a) => !a.archived)?.id || "");
  const [toAccountId, setToAccountId] = useState(rule?.toAccountId || "");
  const [categoryId, setCategoryId] = useState(rule?.category?.id || "");
  const [frequency, setFrequency] = useState<"WEEKLY" | "MONTHLY" | "YEARLY">(rule?.frequency || "MONTHLY");
  const [dayOfMonth, setDayOfMonth] = useState(rule?.dayOfMonth?.toString() || "1");
  const [dayOfWeek, setDayOfWeek] = useState(rule?.dayOfWeek?.toString() || "1");
  const [monthOfYear, setMonthOfYear] = useState(rule?.monthOfYear?.toString() || "1");
  const [startDate, setStartDate] = useState(rule ? rule.startDate.slice(0, 10) : todayISO());
  const [endDate, setEndDate] = useState(rule?.endDate ? rule.endDate.slice(0, 10) : "");
  const [notes, setNotes] = useState(rule?.notes || "");
  const [applyToExisting, setApplyToExisting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredCats = categories.filter(
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
    const url = editing ? `/api/recurring/${rule!.id}` : "/api/recurring";
    const payload: any = {
      name,
      amount: numericAmount,
      description: description || name,
      notes: notes.trim() || null,
      owner,
      dayOfMonth: frequency !== "WEEKLY" ? parseInt(dayOfMonth, 10) : null,
      dayOfWeek: frequency === "WEEKLY" ? parseInt(dayOfWeek, 10) : null,
      monthOfYear: frequency === "YEARLY" ? parseInt(monthOfYear, 10) : null,
      endDate: endDate || null,
    };
    if (editing) {
      payload.accountId = accountId;
      payload.categoryId = rule!.type === "TRANSFER" ? null : (categoryId || null);
      payload.applyToExisting = applyToExisting;
    } else {
      payload.type = type;
      payload.accountId = accountId;
      payload.toAccountId = type === "TRANSFER" ? toAccountId : null;
      payload.categoryId = type === "TRANSFER" ? null : categoryId || null;
      payload.frequency = frequency;
      payload.startDate = startDate;
    }
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || "Erro");
      setSaving(false);
      return;
    }
    if (!editing && typeof data.generated === "number" && data.generated > 0) {
      alert(`Recorrência criada. ${data.generated} lançamento(s) já foram gerados em "Lançamentos".`);
    }
    if (editing && typeof data.updatedTransactions === "number" && data.updatedTransactions > 0) {
      alert(`Regra atualizada. ${data.updatedTransactions} lançamento(s) existente(s) também foram corrigidos.`);
    }
    onSaved();
  }

  return (
    <Modal title={editing ? "Editar recorrência" : "Nova recorrência"} onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Aluguel"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background"
          />
        </div>

        {!editing && (
          <div className="grid grid-cols-3 gap-2">
            {(["EXPENSE", "INCOME", "TRANSFER"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-3 py-2 rounded-lg border text-sm ${
                  type === t ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
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
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Frequência</label>
            <select
              disabled={editing}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background disabled:opacity-50"
            >
              <option value="MONTHLY">Mensal</option>
              <option value="WEEKLY">Semanal</option>
              <option value="YEARLY">Anual</option>
            </select>
          </div>
        </div>

        {frequency === "MONTHLY" && (
          <div>
            <label className="block text-sm font-medium mb-1">Dia do mês</label>
            <input
              type="number"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
          </div>
        )}
        {frequency === "WEEKLY" && (
          <div>
            <label className="block text-sm font-medium mb-1">Dia da semana</label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            >
              {DOW.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}
        {frequency === "YEARLY" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Mês</label>
              <input
                type="number"
                min={1}
                max={12}
                value={monthOfYear}
                onChange={(e) => setMonthOfYear(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Dia</label>
              <input
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Conta</label>
          <select
            required
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background"
          >
            {accounts.filter((a) => !a.archived).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {(editing ? rule!.type : type) === "TRANSFER" ? (
          !editing && (
            <div>
              <label className="block text-sm font-medium mb-1">Conta destino</label>
              <select
                required
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background"
              >
                <option value="">Selecione...</option>
                {accounts.filter((a) => !a.archived && a.id !== accountId).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1">Categoria</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            >
              <option value="">Sem categoria</option>
              {filteredCats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
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
                className={`px-3 py-2 rounded-lg border text-sm ${
                  owner === o ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                }`}
              >
                {o === "PARTNER_A"
                  ? settings?.partnerAName ?? "A"
                  : o === "PARTNER_B"
                  ? settings?.partnerBName ?? "B"
                  : "Casal"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {!editing && (
            <div>
              <label className="block text-sm font-medium mb-1">Início</label>
              <input
                required
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background"
              />
            </div>
          )}
          <div className={editing ? "col-span-2" : ""}>
            <label className="block text-sm font-medium mb-1">
              Fim <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Observações <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Detalhes extras, número de contrato, lembretes..."
            className="w-full px-3 py-2 rounded-lg border border-border bg-background resize-y"
          />
        </div>

        {editing && (
          <label className="flex items-start gap-2 p-3 rounded-lg border border-border bg-muted/30 cursor-pointer hover:bg-muted/50">
            <input
              type="checkbox"
              checked={applyToExisting}
              onChange={(e) => setApplyToExisting(e.target.checked)}
              className="mt-0.5"
            />
            <div className="text-sm">
              <strong>Aplicar também aos lançamentos já gerados</strong>
              <p className="text-xs text-muted-foreground mt-0.5">
                Atualiza valor, descrição, categoria, dono e conta de todos os lançamentos que
                já saíram desta regra. Desmarque se quer mudar só daqui pra frente.
              </p>
            </div>
          </label>
        )}

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-lg">{error}</div>
        )}

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
