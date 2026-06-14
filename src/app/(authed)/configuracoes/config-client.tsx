"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/financas/page-header";

export function ConfigClient() {
  const [partnerAName, setPartnerAName] = useState("");
  const [partnerBName, setPartnerBName] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [hideBalances, setHideBalances] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setPartnerAName(d.partnerAName || "");
        setPartnerBName(d.partnerBName || "");
        setCurrency(d.currency || "BRL");
        setHideBalances(!!d.hideBalances);
        setLoading(false);
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerAName, partnerBName, currency, hideBalances }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d?.error || "Erro ao salvar");
      setSaving(false);
      return;
    }
    setSaving(false);
    setSavedAt(new Date());
  }

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Ajuste os nomes do casal e a moeda."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <form
          onSubmit={submit}
          className="bg-card border border-border rounded-xl p-6 max-w-xl space-y-5"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Nome (Pessoa A)
              </label>
              <input
                required
                value={partnerAName}
                onChange={(e) => setPartnerAName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Nome (Pessoa B)
              </label>
              <input
                required
                value={partnerBName}
                onChange={(e) => setPartnerBName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Moeda</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            >
              <option value="BRL">Real brasileiro (BRL)</option>
              <option value="USD">Dólar (USD)</option>
              <option value="EUR">Euro (EUR)</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              A formatação atual usa pt-BR / BRL. Outras moedas serão ajustadas em fases futuras.
            </p>
          </div>
          <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30 cursor-pointer hover:bg-muted/50">
            <input
              type="checkbox"
              checked={hideBalances}
              onChange={(e) => setHideBalances(e.target.checked)}
              className="mt-1"
            />
            <div className="text-sm">
              <strong>Modo só despesas</strong>{" "}
              <span className="text-xs text-muted-foreground">(esconde saldos)</span>
              <p className="text-xs text-muted-foreground mt-1">
                Esconde no Dashboard os widgets de <strong>Saldo total</strong>,{" "}
                <strong>Receitas do mês</strong>, <strong>Resultado do mês</strong> e o
                saldo individual de cada conta. Útil enquanto você só rastreia despesas e
                ainda não cadastra receitas. As receitas continuam funcionando se você
                quiser usar no futuro — é só desligar isso aqui.
              </p>
            </div>
          </label>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-lg">
              {error}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
            {savedAt && (
              <span className="text-xs text-muted-foreground">
                Salvo às {savedAt.toLocaleTimeString("pt-BR")}
              </span>
            )}
          </div>
        </form>
      )}

      <MembrosSection />
    </div>
  );
}

function MembrosSection() {
  const [members, setMembers] = useState<any[] | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSlot, setInviteSlot] = useState<"PARTNER_A" | "PARTNER_B">("PARTNER_B");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/auth/membros");
    if (res.ok) setMembers(await res.json());
  }
  useEffect(() => {
    load();
  }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setGeneratedUrl(null);
    const res = await fetch("/api/auth/convidar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, ownerSlot: inviteSlot }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data?.error || "Erro ao criar convite");
      return;
    }
    setGeneratedUrl(data.url);
    setInviteEmail("");
    load();
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-xl space-y-5 mt-6">
      <div>
        <h2 className="text-base font-semibold">Membros da casa</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Quem tem acesso a essas finanças.
        </p>
      </div>

      <div className="space-y-2">
        {members === null ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border"
            >
              <div>
                <p className="text-sm font-medium">{m.user.name || m.user.email}</p>
                <p className="text-xs text-muted-foreground">
                  {m.user.email} · {m.role === "OWNER" ? "Dono(a)" : "Membro"}
                  {m.ownerSlot ? ` · ${m.ownerSlot === "PARTNER_A" ? "Pessoa A" : "Pessoa B"}` : ""}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-sm font-medium mb-2">Convidar parceiro</p>
        <form onSubmit={invite} className="space-y-3">
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@dele.com"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            {(["PARTNER_A", "PARTNER_B"] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setInviteSlot(o)}
                className={`px-3 py-2 rounded-lg border text-sm ${
                  inviteSlot === o
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                {o === "PARTNER_A" ? "Pessoa A" : "Pessoa B"}
              </button>
            ))}
          </div>
          {error && (
            <div className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 text-sm font-medium"
          >
            {busy ? "Gerando..." : "Gerar link de convite"}
          </button>
        </form>

        {generatedUrl && (
          <div className="mt-3 p-3 rounded-lg bg-success/10 border border-success/30 space-y-2">
            <p className="text-xs font-medium text-success">Link de convite criado</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={generatedUrl}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="flex-1 px-2 py-1.5 rounded border border-border bg-background text-xs"
              />
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(generatedUrl)}
                className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs"
              >
                Copiar
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Manda esse link pra pessoa. Vale por 7 dias.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
