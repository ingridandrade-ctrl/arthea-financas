"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";
import { ArtheaToaster } from "@/components/financas/toaster";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";

export function ArtheaThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="arthea-financas-theme"
    >
      {children}
      <ArtheaToaster />
      <ConfirmDialogProvider />
    </NextThemesProvider>
  );
}
