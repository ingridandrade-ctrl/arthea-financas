"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArtheaLogo } from "@/components/financas/logo";
import { ThemeToggle } from "@/components/financas/theme-toggle";

export function SetupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [partnerAName, setPartnerAName] = useState("");
  const [partnerBName, setPartnerBName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        partnerAName,
        partnerBName,
        currency: "BRL",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || "Erro ao configurar");
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
            Bem-vindos! Vamos configurar suas finanças.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Nome (Pessoa A)</label>
              <input
                required
                value={partnerAName}
                onChange={(e) => setPartnerAName(e.target.value)}
                placeholder="Ex: Ingrid"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nome (Pessoa B)</label>
              <input
                required
                value={partnerBName}
                onChange={(e) => setPartnerBName(e.target.value)}
                placeholder="Ex: André"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">E-mail compartilhado</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="casal@exemplo.com"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Senha (mínimo 6 caracteres)</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Vamos criar contas iniciais (corrente, poupança, dinheiro) e categorias
            comuns para você começar rápido. Tudo é editável depois.
          </p>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-lg">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 transition"
          >
            {loading ? "Configurando..." : "Criar e entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
