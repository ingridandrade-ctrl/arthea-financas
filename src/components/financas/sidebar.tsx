"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ArtheaLogo } from "@/components/financas/logo";
import { ThemeToggle } from "@/components/financas/theme-toggle";
import {
  LayoutDashboard,
  Wallet,
  Tags,
  ArrowLeftRight,
  Settings,
  LogOut,
  Repeat,
  CreditCard,
  BarChart3,
  Users,
  Target,
  User,
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronDown,
  ChevronRight,
  Receipt,
  Crown,
  Menu,
  X,
  PieChart,
} from "lucide-react";

type SubItem = { name: string; href: string; query?: Record<string, string>; icon?: any };
type NavItem = {
  name: string;
  href: string;
  icon: any;
  exact?: boolean;
  children?: SubItem[];
};

function buildGroups(hideBalances: boolean): { label: string; items: NavItem[] }[] {
  const movChildren: SubItem[] = [
    { name: "Despesas Gerais", href: "/lancamentos", query: { type: "EXPENSE" }, icon: ArrowDownCircle },
    { name: "Faturas de Cartões", href: "/lancamentos", query: { type: "INVOICE" }, icon: CreditCard },
  ];
  if (!hideBalances) {
    movChildren.push({ name: "Receitas", href: "/lancamentos", query: { type: "INCOME" }, icon: ArrowUpCircle });
    movChildren.push({ name: "Transferências", href: "/lancamentos", query: { type: "TRANSFER" }, icon: ArrowLeftRight });
  }
  return [
    {
      label: "Menu",
      items: [
        { name: "Visão geral", href: "/dashboard", icon: LayoutDashboard, exact: true },
        {
          name: "Movimentações",
          href: "/lancamentos",
          icon: Receipt,
          children: movChildren,
        },
        { name: "Cartões de Crédito", href: "/cartoes", icon: CreditCard },
        { name: "Recorrências", href: "/recorrencias", icon: Repeat },
      ],
    },
    {
      label: "Análise",
      items: [
        { name: "Por pessoa", href: "/por-pessoa", icon: User },
        { name: "Casal", href: "/casal", icon: Users },
        { name: "Relatórios", href: "/relatorios", icon: BarChart3 },
        { name: "Orçamento", href: "/orcamento", icon: PieChart },
      ],
    },
    {
      label: "Cadastro",
      items: [
        { name: "Contas", href: "/contas", icon: Wallet },
        { name: "Categorias", href: "/categorias", icon: Tags },
        { name: "Metas", href: "/metas", icon: Target },
      ],
    },
  ];
}

function buildHref(href: string, query?: Record<string, string>) {
  if (!query || Object.keys(query).length === 0) return href;
  const qs = new URLSearchParams(query).toString();
  return `${href}?${qs}`;
}

const ITEM_BASE =
  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors";
const ITEM_IDLE = "text-muted-foreground hover:bg-muted/70 hover:text-foreground";
const ITEM_ACTIVE = "bg-muted text-foreground";

export function FinancasSidebar({
  isAdmin = false,
  userName,
  userEmail,
}: {
  isAdmin?: boolean;
  userName?: string | null;
  userEmail?: string | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [hideBalances, setHideBalances] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "/lancamentos": true,
  });
  // Abaixo de lg o menu vira uma gaveta; acima fica sempre visível.
  const [open, setOpen] = useState(false);
  const currentType = searchParams?.get("type") ?? "";

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (s) setHideBalances(!!s.hideBalances);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname, currentType]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const groups = buildGroups(hideBalances);
  const displayName = userName?.trim() || userEmail?.split("@")[0] || "Minha conta";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border/60 bg-canvas/85 px-4 backdrop-blur lg:hidden">
        <ArtheaLogo size="sm" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={open}
          className="rounded-xl border border-border bg-card p-2 text-muted-foreground hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-3 left-3 z-40 flex w-60 flex-col rounded-2xl border border-border bg-card transition-transform duration-200 lg:z-10 lg:translate-x-0",
          open ? "translate-x-0 shadow-2xl" : "-translate-x-[calc(100%+1rem)]"
        )}
      >
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <ArtheaLogo size="sm" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 pb-3">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-1 px-3 text-[11px] font-medium text-muted-foreground/80">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = item.exact
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(item.href + "/");
                  const hasChildren = !!item.children?.length;
                  const isExpanded = expanded[item.href] !== false && (isActive || expanded[item.href]);
                  const highlight = isActive && (!hasChildren || !currentType);
                  return (
                    <div key={item.href}>
                      <div className="flex items-center gap-0.5">
                        <Link
                          href={item.href}
                          aria-current={highlight ? "page" : undefined}
                          className={cn(ITEM_BASE, "flex-1", highlight ? ITEM_ACTIVE : ITEM_IDLE)}
                        >
                          <item.icon
                            className={cn("h-4 w-4 shrink-0", highlight && "text-primary")}
                          />
                          {item.name}
                        </Link>
                        {hasChildren && (
                          <button
                            onClick={() =>
                              setExpanded((prev) => ({
                                ...prev,
                                [item.href]: !isExpanded,
                              }))
                            }
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label={isExpanded ? "Recolher" : "Expandir"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                      {hasChildren && isExpanded && (
                        <div className="ml-5 mt-0.5 space-y-0.5 border-l border-border pl-2">
                          {item.children!.map((child) => {
                            const childHref = buildHref(child.href, child.query);
                            const isChildActive =
                              pathname === child.href &&
                              currentType === (child.query?.type ?? "");
                            const ChildIcon = child.icon;
                            return (
                              <Link
                                key={childHref}
                                href={childHref}
                                aria-current={isChildActive ? "page" : undefined}
                                className={cn(
                                  "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                                  isChildActive ? ITEM_ACTIVE : ITEM_IDLE
                                )}
                              >
                                {ChildIcon && (
                                  <ChildIcon
                                    className={cn(
                                      "h-3.5 w-3.5 shrink-0",
                                      isChildActive && "text-primary"
                                    )}
                                  />
                                )}
                                {child.name}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <p className="mb-1 px-3 text-[11px] font-medium text-muted-foreground/80">Ajustes</p>
            <div className="space-y-0.5">
              <Link
                href="/configuracoes"
                aria-current={pathname === "/configuracoes" ? "page" : undefined}
                className={cn(ITEM_BASE, pathname === "/configuracoes" ? ITEM_ACTIVE : ITEM_IDLE)}
              >
                <Settings
                  className={cn(
                    "h-4 w-4 shrink-0",
                    pathname === "/configuracoes" && "text-primary"
                  )}
                />
                Configurações
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className={cn(
                    ITEM_BASE,
                    pathname === "/admin" || pathname?.startsWith("/admin/")
                      ? "bg-warning/15 text-warning"
                      : "text-warning hover:bg-warning/10"
                  )}
                >
                  <Crown className="h-4 w-4 shrink-0" />
                  Admin
                </Link>
              )}
            </div>
          </div>
        </nav>

        <div className="space-y-2 border-t border-border/70 p-2.5">
          <div className="flex items-center justify-between px-2">
            <span className="text-[13px] font-medium text-muted-foreground">Tema</span>
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-muted/40 px-2.5 py-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium leading-tight">{displayName}</p>
              {userEmail && (
                <p className="truncate text-[11px] leading-tight text-muted-foreground">
                  {userEmail}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={logout}
              title="Sair"
              aria-label="Sair"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
