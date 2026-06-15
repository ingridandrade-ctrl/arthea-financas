"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Home, Receipt, Wallet, CreditCard, Search, ExternalLink, Crown } from "lucide-react";
import { toast } from "@/components/financas/toaster";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/financas/page-header";

type Stats = {
  counts: {
    users: number;
    households: number;
    transactions: number;
    accounts: number;
    invoices: number;
  };
  growth: {
    newUsers7d: number;
    newUsers30d: number;
    activeUsers7d: number;
    activeUsers30d: number;
  };
  dailySignups: { day: string; count: number }[];
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  memberships: {
    role: string;
    ownerSlot: string | null;
    household: {
      id: string;
      partnerAName: string;
      partnerBName: string;
      _count: { transactions: number; accounts: number; invoices: number };
    };
  }[];
};

export function AdminClient() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [q, setQ] = useState("");
  const [impersonating, setImpersonating] = useState<string | null>(null);

  async function loadStats() {
    const res = await fetch("/api/admin/stats");
    if (res.ok) setStats(await res.json());
  }
  async function loadUsers() {
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
    if (res.ok) setUsers(await res.json());
  }
  useEffect(() => {
    loadStats();
    loadUsers();
  }, []);
  useEffect(() => {
    const t = setTimeout(loadUsers, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function impersonate(userId: string) {
    const ok = await confirmDialog({
      title: "Entrar como esse usuário?",
      description: "Pra voltar, clica em 'Voltar pro admin' no banner amarelo do topo.",
      variant: "warning",
      confirmLabel: "Entrar",
    });
    if (!ok) return;
    setImpersonating(userId);
    const res = await fetch(`/api/admin/impersonar/${userId}`, { method: "POST" });
    setImpersonating(null);
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error || "Erro ao impersonar");
    }
  }

  return (
    <div>
      <PageHeader
        title="Admin"
        description="Painel administrativo do Arthea Finanças. Só você vê isso."
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard icon={Users} label="Usuários" value={stats?.counts.users ?? "—"} />
        <StatCard icon={Home} label="Casas" value={stats?.counts.households ?? "—"} />
        <StatCard icon={Receipt} label="Lançamentos" value={stats?.counts.transactions ?? "—"} />
        <StatCard icon={Wallet} label="Contas" value={stats?.counts.accounts ?? "—"} />
        <StatCard icon={CreditCard} label="Faturas" value={stats?.counts.invoices ?? "—"} />
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-3">Crescimento</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Novos usuários (7d)</p>
                <p className="text-xl font-bold">{stats.growth.newUsers7d}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Novos usuários (30d)</p>
                <p className="text-xl font-bold">{stats.growth.newUsers30d}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ativos (7d)</p>
                <p className="text-xl font-bold">{stats.growth.activeUsers7d}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ativos (30d)</p>
                <p className="text-xl font-bold">{stats.growth.activeUsers30d}</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-3">Cadastros nos últimos 30 dias</h3>
            <SignupBars data={stats.dailySignups} />
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Usuários</h2>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="buscar por email ou nome"
              className="pl-7 pr-3 py-1.5 rounded-md border border-border bg-background text-sm"
            />
          </div>
        </div>
        {users === null ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
        ) : users.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">Nenhum usuário encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Usuário</th>
                  <th className="px-4 py-2 font-medium">Casa</th>
                  <th className="px-4 py-2 font-medium text-right">Lançamentos</th>
                  <th className="px-4 py-2 font-medium">Cadastro</th>
                  <th className="px-4 py-2 font-medium">Último login</th>
                  <th className="px-4 py-2 font-medium w-32"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const m = u.memberships[0];
                  return (
                    <tr key={u.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          {u.isAdmin && <Crown className="w-3 h-3 text-warning" aria-label="Admin" />}
                          <span className="font-medium">{u.name || u.email}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {m ? (
                          <>
                            {m.household.partnerAName} & {m.household.partnerBName}
                            <span className="text-muted-foreground"> · {m.role}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground italic">sem casa</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {m?.household._count.transactions ?? 0}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {m && (
                          <button
                            onClick={() => impersonate(u.id)}
                            disabled={impersonating === u.id}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-50"
                            title="Entrar como esse usuário"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Entrar como
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function SignupBars({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex items-end gap-0.5 h-24">
      {data.map((d) => (
        <div
          key={d.day}
          title={`${d.day}: ${d.count}`}
          className="flex-1 bg-primary/30 hover:bg-primary/60 rounded-sm transition-colors"
          style={{ height: `${(d.count / max) * 100}%`, minHeight: 2 }}
        />
      ))}
    </div>
  );
}
