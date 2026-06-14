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
      label: "Visão",
      items: [{ name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true }],
    },
    {
      label: "Dia-a-dia",
      items: [
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
        { name: "Orçamento", href: "/orcamento", icon: BarChart3 },
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

export function FinancasSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [hideBalances, setHideBalances] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "/lancamentos": true,
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (s) setHideBalances(!!s.hideBalances);
      })
      .catch(() => {});
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const groups = buildGroups(hideBalances);
  const currentType = searchParams?.get("type") ?? "";

  return (
    <aside className="w-64 bg-sidebar border-r border-border h-screen flex flex-col fixed left-0 top-0">
      <div className="p-6 pb-4">
        <ArtheaLogo size="base" />
      </div>

      <nav className="flex-1 px-3 space-y-4 overflow-y-auto pb-4">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + "/");
                const hasChildren = !!item.children?.length;
                const isExpanded = expanded[item.href] !== false && (isActive || expanded[item.href]);
                return (
                  <div key={item.href}>
                    <div className="flex items-center gap-0.5">
                      <Link
                        href={item.href}
                        className={cn(
                          "flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                          isActive && (!hasChildren || !currentType)
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <item.icon className="w-4 h-4" />
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
                          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label={isExpanded ? "Recolher" : "Expandir"}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                    {hasChildren && isExpanded && (
                      <div className="ml-6 mt-0.5 space-y-0.5 border-l border-border pl-2">
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
                              className={cn(
                                "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                                isChildActive
                                  ? "bg-primary/15 text-primary"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                            >
                              {ChildIcon && <ChildIcon className="w-3.5 h-3.5" />}
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
      </nav>

      <div className="p-3 border-t border-border space-y-0.5">
        <div className="px-3 pb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
            Tema
          </span>
          <ThemeToggle />
        </div>
        <Link
          href="/configuracoes"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            pathname === "/configuracoes"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Settings className="w-4 h-4" />
          Configurações
        </Link>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
