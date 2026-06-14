"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArtheaLogo } from "@/components/financas/logo";
import { ThemeToggle } from "@/components/financas/theme-toggle";

export function CadastroForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [partnerAName, setPartnerAName] = useState("");
  const [partnerBName, setPartnerBName] = useState("");
  const [ownerSlot, setOwnerSlot] = useState<"PARTNER_A" | "PARTNER_B">("PARTNER_A");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/cadastro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, partnerAName, partnerBName, ownerSlot }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || "Erro ao cadastrar");
      setLoading(false);
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
          <p className="mt-3 text-sm text-muted-foreground">
            Crie sua conta. Você pode convidar seu parceiro depois.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Seu nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Como você quer ser chamada"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">E-mail</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Senha</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Mínimo 6 caracteres.</p>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
              Sobre o casal
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nome da pessoa A</label>
                <input
                  type="text"
                  value={partnerAName}
                  onChange={(e) => setPartnerAName(e.target.value)}
                  placeholder="ex: Ingrid"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nome da pessoa B</label>
                <input
                  type="text"
                  value={partnerBName}
                  onChange={(e) => setPartnerBName(e.target.value)}
                  placeholder="ex: Thiago"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium mb-1">Você é qual lado?</label>
              <div className="grid grid-cols-2 gap-2">
                {(["PARTNER_A", "PARTNER_B"] as const).map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setOwnerSlot(o)}
                    className={`px-3 py-2 rounded-lg border text-sm ${
                      ownerSlot === o
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {o === "PARTNER_A"
                      ? partnerAName || "Pessoa A"
                      : partnerBName || "Pessoa B"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 font-medium"
          >
            {loading ? "Criando..." : "Criar conta"}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
