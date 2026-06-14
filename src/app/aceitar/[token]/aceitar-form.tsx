"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArtheaLogo } from "@/components/financas/logo";
import { ThemeToggle } from "@/components/financas/theme-toggle";

type InviteInfo = {
  email: string;
  ownerSlot: "PARTNER_A" | "PARTNER_B" | null;
  household: { partnerAName: string; partnerBName: string };
  invitedBy: { name: string };
  isExistingUser: boolean;
};

export function AceitarForm({ token }: { token: string }) {
  const router = useRouter();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/auth/aceitar/${token}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(data?.error || "Convite inválido");
        return;
      }
      setInfo(data);
    })();
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    const res = await fetch(`/api/auth/aceitar/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSubmitError(data?.error || "Erro ao aceitar");
      setSubmitting(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 relative">
      <div className="absolute top-6 right-6">
        <ThemeToggle variant="icon" />
      </div>
      <div className="w-full max-w-md bg-card rounded-2xl border border-border p-8 shadow-sm">
        <div className="mb-6">
          <ArtheaLogo size="base" href={null} />
        </div>

        {loadError ? (
          <div className="text-center py-6">
            <p className="text-sm text-destructive font-medium">{loadError}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Peça pra quem te convidou gerar um novo link.
            </p>
          </div>
        ) : !info ? (
          <p className="text-sm text-muted-foreground">Carregando convite...</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
              <p>
                <strong>{info.invitedBy.name}</strong> te convidou pra entrar na casa{" "}
                <strong>
                  {info.household.partnerAName} & {info.household.partnerBName}
                </strong>
                .
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Você vai entrar como{" "}
                {info.ownerSlot === "PARTNER_A"
                  ? info.household.partnerAName
                  : info.ownerSlot === "PARTNER_B"
                  ? info.household.partnerBName
                  : "membro"}
                .
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">E-mail</label>
              <input
                type="email"
                value={info.email}
                disabled
                className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-muted-foreground"
              />
            </div>

            {!info.isExistingUser && (
              <div>
                <label className="block text-sm font-medium mb-1">Seu nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como você quer ser chamado"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">
                {info.isExistingUser ? "Sua senha" : "Crie uma senha"}
              </label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={info.isExistingUser ? "current-password" : "new-password"}
                minLength={6}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background"
              />
            </div>

            {submitError && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-lg">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 font-medium"
            >
              {submitting ? "Aceitando..." : "Aceitar e entrar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
