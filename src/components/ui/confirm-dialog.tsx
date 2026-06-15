"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Info, Trash2 } from "lucide-react";

type Variant = "info" | "warning" | "destructive";

type Options = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
};

let resolver: ((value: boolean) => void) | null = null;
let setter: ((opts: Options | null) => void) | null = null;

export function confirmDialog(opts: Options): Promise<boolean> {
  if (!setter) {
    // Fallback caso o provider não esteja montado
    return Promise.resolve(window.confirm(opts.title));
  }
  setter(opts);
  return new Promise<boolean>((res) => {
    resolver = res;
  });
}

const VARIANT_STYLES: Record<Variant, { icon: any; iconClass: string; btnClass: string }> = {
  info: {
    icon: Info,
    iconClass: "text-info",
    btnClass: "bg-primary text-primary-foreground hover:opacity-90",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-warning",
    btnClass: "bg-warning text-warning-foreground hover:opacity-90",
  },
  destructive: {
    icon: Trash2,
    iconClass: "text-destructive",
    btnClass: "bg-destructive text-destructive-foreground hover:opacity-90",
  },
};

export function ConfirmDialogProvider() {
  const [opts, setOpts] = useState<Options | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setter = setOpts;
    return () => {
      setter = null;
    };
  }, []);

  useEffect(() => {
    if (!opts) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") resolve(false);
      if (e.key === "Enter") resolve(true);
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [opts]);

  function resolve(v: boolean) {
    resolver?.(v);
    resolver = null;
    setOpts(null);
  }

  if (!mounted || !opts) return null;

  const variant = opts.variant ?? "info";
  const v = VARIANT_STYLES[variant];
  const Icon = v.icon;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={() => resolve(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="shrink-0 mt-0.5">
            <Icon className={`w-6 h-6 ${v.iconClass}`} />
          </div>
          <div className="flex-1">
            <h3 id="confirm-title" className="text-base font-semibold text-foreground">
              {opts.title}
            </h3>
            {opts.description && (
              <div className="mt-2 text-sm text-muted-foreground">{opts.description}</div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => resolve(false)}
            className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium"
          >
            {opts.cancelLabel ?? "Cancelar"}
          </button>
          <button
            onClick={() => resolve(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${v.btnClass}`}
            autoFocus
          >
            {opts.confirmLabel ?? "Confirmar"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
