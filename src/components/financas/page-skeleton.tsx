/**
 * Esqueleto de carregamento das telas internas. Substitui o texto solto
 * "Carregando..." por blocos no formato do que vai aparecer, pra tela não
 * "pular" quando os dados chegam.
 *
 * - "list": faixa de resumo + linhas (tabelas, listas)
 * - "cards": grade de cartões (contas, metas, por pessoa)
 * - "rows": só linhas, pra usar dentro de um card que já existe
 */
export function PageSkeleton({
  variant = "list",
  rows = 6,
  className = "",
}: {
  variant?: "list" | "cards" | "rows";
  rows?: number;
  className?: string;
}) {
  if (variant === "rows") {
    return (
      <div className={`space-y-2 ${className}`} role="status" aria-label="Carregando">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton h-10" />
        ))}
      </div>
    );
  }

  if (variant === "cards") {
    return (
      <div
        className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${className}`}
        role="status"
        aria-label="Carregando"
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton h-36 !rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`} role="status" aria-label="Carregando">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="skeleton h-20 !rounded-2xl" />
        <div className="skeleton h-20 !rounded-2xl" />
        <div className="skeleton h-20 !rounded-2xl" />
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="space-y-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="skeleton h-10" />
          ))}
        </div>
      </div>
    </div>
  );
}
