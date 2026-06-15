"use client";

import { useRouter } from "next/navigation";
import { LogOut, AlertTriangle } from "lucide-react";

export function ImpersonationBanner({ asName, asEmail }: { asName: string | null; asEmail: string }) {
  const router = useRouter();

  async function leave() {
    const res = await fetch("/api/admin/impersonar/sair", { method: "POST" });
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    }
  }

  return (
    <div className="sticky top-0 z-50 bg-warning text-warning-foreground px-4 py-2 flex items-center justify-between text-sm shadow-md">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        <span>
          Você está logada como <strong>{asName || asEmail}</strong> (impersonação admin)
        </span>
      </div>
      <button
        onClick={leave}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-warning-foreground/15 hover:bg-warning-foreground/25 font-medium"
      >
        <LogOut className="w-3.5 h-3.5" />
        Voltar pro admin
      </button>
    </div>
  );
}
