"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArtheaLogo } from "@/components/financas/logo";

// Erro inesperado fora da área logada (página inicial, login, cadastro).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col bg-canvas px-6 py-8 text-foreground">
      <ArtheaLogo size="sm" />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <h1 className="font-headline text-5xl leading-none">Algo deu errado.</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Não foi você: a página não conseguiu carregar. Nada do que já estava salvo foi perdido.
          Tente de novo em instantes.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Tentar de novo
          </button>
          <Link
            href="/"
            className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            Página inicial
          </Link>
        </div>
      </main>
    </div>
  );
}
