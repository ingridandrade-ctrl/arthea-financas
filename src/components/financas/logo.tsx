import Link from "next/link";

type Props = {
  /** when true, only the star mark (no wordmark) */
  iconOnly?: boolean;
  /** controls overall size */
  size?: "xs" | "sm" | "base" | "lg" | "xl";
  /** if set (default '/financas'), wraps the logo in a link */
  href?: string | null;
  /** show subtle 'Finanças' tag after wordmark */
  subtitle?: boolean;
  /** override the className of the outer element */
  className?: string;
};

const SIZES = {
  xs: { mark: 16, wordmark: "text-base", subtitle: "text-[10px]" },
  sm: { mark: 22, wordmark: "text-lg", subtitle: "text-[11px]" },
  base: { mark: 28, wordmark: "text-2xl", subtitle: "text-xs" },
  lg: { mark: 40, wordmark: "text-3xl", subtitle: "text-sm" },
  xl: { mark: 56, wordmark: "text-5xl", subtitle: "text-base" },
};

/**
 * Arthea 8-point compass star, rendered as an SVG that inherits currentColor
 * so it adapts to dark/light mode automatically.
 */
export function ArtheaStar({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <defs>
        <linearGradient id="arthea-star-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--color-brand-dark)" stopOpacity="1" />
        </linearGradient>
      </defs>
      <g fill="url(#arthea-star-grad)">
        {/* 4 long axes (N, E, S, W) — sharp narrow rhombi */}
        <polygon points="50,2 53,50 50,98 47,50" />
        <polygon points="2,50 50,53 98,50 50,47" />
        {/* 4 short diagonal axes (NE, SE, SW, NW) — shorter rhombi */}
        <polygon points="18,18 50,48 82,82 48,50" />
        <polygon points="82,18 52,48 18,82 48,52" />
      </g>
    </svg>
  );
}

export function ArtheaLogo({
  iconOnly = false,
  size = "base",
  href = "/",
  subtitle = true,
  className = "",
}: Props) {
  const s = SIZES[size];

  const content = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <ArtheaStar size={s.mark} />
      {!iconOnly && (
        <span className="inline-flex flex-col leading-none">
          <span
            className={`font-display tracking-[0.18em] uppercase ${s.wordmark} text-foreground`}
            style={{ fontWeight: 400 }}
          >
            Arthea
          </span>
          {subtitle && (
            <span
              className={`font-sans tracking-[0.2em] uppercase ${s.subtitle} text-muted-foreground mt-0.5`}
            >
              Finanças
            </span>
          )}
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center group">
        {content}
      </Link>
    );
  }
  return content;
}
