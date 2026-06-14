"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

const OPTIONS: { value: "light" | "dark" | "system"; label: string; Icon: any }[] = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Escuro", Icon: Moon },
  { value: "system", label: "Sistema", Icon: Monitor },
];

export function ThemeToggle({ variant = "full" }: { variant?: "full" | "icon" }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="h-8 w-8 rounded-md bg-muted/40" aria-hidden />
    );
  }

  if (variant === "icon") {
    const isDark = resolvedTheme === "dark";
    const Icon = isDark ? Sun : Moon;
    return (
      <button
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
        aria-label={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
      >
        <Icon className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
      {OPTIONS.map((opt) => {
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            title={opt.label}
            aria-label={`Tema: ${opt.label}`}
            aria-pressed={active}
          >
            <opt.Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </div>
  );
}
