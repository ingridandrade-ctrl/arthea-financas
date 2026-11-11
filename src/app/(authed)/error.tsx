"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

// Erro inesperado numa tela interna. Fica dentro do layout logado, então o
// menu lateral continua ali e a pessoa não fica presa numa tela em branco.
export default function AuthedError({
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
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-card p-8 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-warning/15 text-warning">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-lg font-semibold">Essa tela não carregou</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Aconteceu um erro inesperado. Nada do que já estava salvo foi perdido. Tente de novo; se
        continuar, volte para a visão geral.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Tentar de novo
        </button>
        <Link
          href="/dashboard"
          className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
        >
          Visão geral
        </Link>
      </div>
    </div>
  );
}
