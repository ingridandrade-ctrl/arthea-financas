"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  LineChart as LineChartIcon,
  PieChart,
  Plus,
  Scale,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { toast } from "@/components/financas/toaster";
import { ArtheaStar } from "@/components/financas/logo";
import { SegControl } from "@/components/financas/filters";
import { cn, formatCurrency } from "@/lib/utils";
import { ACCOUNT_TYPE_LABEL } from "@/lib/financas/defaults";
import {
  CategoryDonut,
  IncomeExpenseLine,
  PercentChange,
} from "@/components/financas/charts";

type Owner = "PARTNER_A" | "PARTNER_B" | "COUPLE";
type OwnerFilter = "all" | Owner;
type InvoiceStatus = "OPEN" | "CLOSED" | "PAID" | "OVERDUE";

type CardInvoice = {
  id: string;
  accountId: string;
  year: number;
  month: number; // 0-11
  dueDate: string;
  status: InvoiceStatus;
  total: number;
};

type Account = {
  id: string;
  name: string;
  type: keyof typeof ACCOUNT_TYPE_LABEL;
  color: string;
  balance: number;
  creditLimit: number | null;
  dueDay: number | null;
};

type DashboardData = {
  household: { partnerAName: string; partnerBName: string; currency: string; hideBalances: boolean };
  period: { year: number; month: number; label: string };
  totals: { balance: number; income: number; expense: number; net: number };
  previous: { income: number; expense: number; net: number };
  dailyExpense: { day: string; amount: number }[];
  accounts: Account[];
  expensesByCategory: {
    categoryId: string | null;
    name: string;
    color: string;
    amount: number;
  }[];
  byOwner: Record<string, { income: number; expense: number } | undefined>;
  monthlySeries: { month: string; income: number; expense: number }[];
  cardInvoices?: CardInvoice[];
};

type Movement = {
  id: string;
  kind: "transaction" | "invoice";
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "INVOICE";
  date: string;
  description: string;
  amount: number;
  account: { id: string; name: string; color: string };
  status: "paid" | "pending" | "overdue";
  invoiceId?: string | null;
};

type Contribution = {
  id: string;
  description: string;
  contributionAmount: number;
};

type CoupleBalance = {
  netBalance: number;
  details: {
    aPaidForCouple: number;
    bPaidForCouple: number;
    aPaidForB: number;
    bPaidForA: number;
    settlementsAtoB: number;
    settlementsBtoA: number;
  };
  contributions: { aOwesB: Contribution[]; bOwesA: Contribution[] };
};

const OWNER_COLOR: Record<Owner, string> = {
  PARTNER_A: "var(--color-partner-a)",
  PARTNER_B: "var(--color-partner-b)",
  COUPLE: "var(--color-couple)",
};

const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_LONG = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const pad2 = (n: number) => String(n).padStart(2, "0");

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

async function getJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

export function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [bills, setBills] = useState<Movement[]>([]);
  // open = saldo acumulado em aberto (histórico inteiro); month = recorte do mês.
  const [couple, setCouple] = useState<{
    open: Pick<CoupleBalance, "netBalance"> | null;
    month: CoupleBalance | null;
  }>({ open: null, month: null });
  const [month, setMonth] = useState(thisMonth());
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [refreshing, setRefreshing] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  // Trocar de mês rápido dispara várias buscas; só a última pode gravar.
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setRefreshing(true);
    setLoadError(false);
    const [y, m] = month.split("-").map(Number);
    const from = `${month}-01`;
    const to = `${month}-${pad2(new Date(y, m, 0).getDate())}`;
    const main = new URLSearchParams({ month, cardGrouping: "fatura_month" });
    const mov = new URLSearchParams({ from, to, limit: "500" });
    if (ownerFilter !== "all") {
      main.set("owner", ownerFilter);
      mov.set("owner", ownerFilter);
    }
    try {
      // Contas a pagar e acerto do casal são complementos: se um deles
      // falhar, o painel principal ainda aparece.
      const [d, b, c] = await Promise.all([
        getJson(`/api/dashboard?${main}`),
        getJson(`/api/movements?${mov}`).catch(() => []),
        getJson(`/api/settlements?from=${from}&to=${to}`).catch(() => null),
      ]);
      if (seq !== requestSeq.current) return;
      setData(d);
      setBills(Array.isArray(b) ? b : []);
      setCouple({ open: c?.openBalance ?? c?.balance ?? null, month: c?.balance ?? null });
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error("[dashboard] load failed", err);
      setLoadError(true);
    } finally {
      if (seq === requestSeq.current) setRefreshing(false);
    }
  }, [month, ownerFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [load]);

  async function toggleHideBalances() {
    if (!data) return;
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hideBalances: !data.household.hideBalances }),
    }).catch(() => null);
    if (!res?.ok) toast.error("Não consegui mudar o modo de exibição");
    load();
  }

  async function payBill(m: Movement) {
    setPayingId(m.id);
    const res = await fetch(`/api/transactions/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid: true }),
    }).catch(() => null);
    setPayingId(null);
    if (res?.ok) {
      toast.success(`${m.description} marcada como paga`);
      setBills((bs) => bs.map((b) => (b.id === m.id ? { ...b, status: "paid" } : b)));
      load();
    } else {
      toast.error("Não consegui marcar como paga. Tenta de novo.");
    }
  }

  const [yearNum, monthNum] = month.split("-").map(Number);
  const monthName = MONTHS_LONG[monthNum - 1];
  const hide = !!data?.household.hideBalances;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label="Mês anterior"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, 1))}
            aria-label="Próximo mês"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h1 className="ml-2 text-2xl font-semibold capitalize tracking-tight">
            {monthName} <span className="font-normal text-muted-foreground">{yearNum}</span>
          </h1>
          {month !== thisMonth() && (
            <button
              type="button"
              onClick={() => setMonth(thisMonth())}
              className="ml-2 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Voltar pra hoje
            </button>
          )}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {data && (
            <SegControl
              value={ownerFilter}
              onChange={(v) => setOwnerFilter(v)}
              options={[
                { value: "all", label: "Todos" },
                { value: "COUPLE", label: "Casal" },
                { value: "PARTNER_A", label: data.household.partnerAName },
                { value: "PARTNER_B", label: data.household.partnerBName },
              ]}
            />
          )}
          {data && (
            <button
              type="button"
              onClick={toggleHideBalances}
              title={hide ? "Mostrar saldos e receitas" : "Esconder saldos e receitas (só despesas)"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {hide ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {hide ? "Só despesas" : "Mostrar tudo"}
            </button>
          )}
          <Link
            href="/lancamentos?novo=1"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </Link>
        </div>
      </div>

      {loadError && !data ? (
        <Card className="py-12 text-center">
          <p className="text-sm font-medium">Não consegui carregar o painel.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pode ser a conexão ou o servidor acordando.
          </p>
          <button
            type="button"
            onClick={load}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Tentar de novo
          </button>
        </Card>
      ) : !data ? (
        <DashboardSkeleton />
      ) : (
        <div
          className={cn(
            "grid grid-cols-1 gap-3 transition-opacity md:grid-cols-2 xl:grid-cols-12",
            refreshing && "opacity-60"
          )}
          aria-busy={refreshing}
        >
          {loadError && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm md:col-span-2 xl:col-span-12">
              Não consegui atualizar agora — mostrando os últimos dados carregados.{" "}
              <button type="button" onClick={load} className="font-medium underline">
                Tentar de novo
              </button>
            </div>
          )}
          <HeroCard
            data={data}
            monthName={monthName}
            index={0}
            className="md:col-span-2 xl:col-span-8"
          />
          <BillsCard
            bills={bills}
            monthName={monthName}
            payingId={payingId}
            onPay={payBill}
            index={1}
            className="md:col-span-2 xl:col-span-4 xl:row-span-2"
          />
          <CoupleCard
            open={couple.open}
            month={couple.month}
            names={data.household}
            monthName={monthName}
            index={2}
            className="xl:col-span-4"
          />
          <CardsCard
            accounts={data.accounts}
            invoices={data.cardInvoices ?? []}
            year={yearNum}
            month0={monthNum - 1}
            index={3}
            className="xl:col-span-4"
          />
          <Card index={4} className="flex flex-col md:col-span-2 xl:col-span-8">
            <CardHeader title="Últimos 6 meses" icon={LineChartIcon} color="var(--color-info)" />
            {/* O gráfico estica até a altura do cartão vizinho na mesma linha. */}
            <div className="relative min-h-72 flex-1">
              <div className="absolute inset-0">
                <IncomeExpenseLine data={data.monthlySeries} hideIncome={hide} height="100%" />
              </div>
            </div>
          </Card>
          <CategoriesCard
            categories={data.expensesByCategory}
            monthName={monthName}
            index={5}
            className="md:col-span-2 xl:col-span-4"
          />
          <AccountsStrip data={data} index={6} className="md:col-span-2 xl:col-span-12" />
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── peças compartilhadas ───────────────────────── */

function Card({
  className,
  children,
  index = 0,
}: {
  className?: string;
  children: React.ReactNode;
  /** posição na grade — atrasa a entrada pra os cartões subirem em sequência */
  index?: number;
}) {
  return (
    <section
      className={cn("rise-in rounded-2xl border border-border bg-card p-5 xl:p-6", className)}
      style={{ "--i": index } as React.CSSProperties}
    >
      {children}
    </section>
  );
}

function CardHeader({
  title,
  icon: Icon,
  color,
  action,
}: {
  title: string;
  icon: LucideIcon;
  color: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-h-10 items-center gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border"
        style={{
          color,
          borderColor: `color-mix(in srgb, ${color} 22%, transparent)`,
          background: `linear-gradient(145deg, color-mix(in srgb, ${color} 20%, var(--color-card)), color-mix(in srgb, ${color} 7%, var(--color-card)))`,
        }}
        aria-hidden
      >
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </span>
    </div>
  );
}

const MONEY_SIZE = {
  xl: "text-[3.25rem] leading-none sm:text-[4rem]",
  lg: "text-[2rem] leading-none",
  md: "text-xl leading-none",
} as const;

/** "R$" apagado, inteiro em destaque, centavos pequenos — como na referência. */
function Money({
  value,
  label,
  size = "lg",
  className,
}: {
  value: number;
  /** valor real pro leitor de tela quando `value` é um quadro da animação */
  label?: number;
  size?: keyof typeof MONEY_SIZE;
  className?: string;
}) {
  const [int, cents] = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(Math.abs(value))
    .split(",");
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-bold tabular-nums tracking-tight",
        MONEY_SIZE[size],
        className
      )}
      aria-label={formatCurrency(label ?? value)}
    >
      {value < 0 && <span className="mr-[0.15em]">−</span>}
      <span className="mr-[0.22em] font-semibold opacity-45">R$</span>
      <span>{int}</span>
      <span className="text-[0.42em] font-semibold opacity-55">,{cents}</span>
    </span>
  );
}

/** Conta do valor anterior até o novo (do zero na primeira vez). */
function useCountUp(target: number, ms = 900): number {
  const [shown, setShown] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    const start = current.current;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still || start === target) {
      current.current = target;
      setShown(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - t0) / ms, 1);
      const value = start + (target - start) * (1 - Math.pow(1 - p, 4));
      current.current = value;
      setShown(value);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return shown;
}

function AnimatedMoney(props: {
  value: number;
  size?: keyof typeof MONEY_SIZE;
  className?: string;
}) {
  const shown = useCountUp(props.value);
  return <Money {...props} value={shown} label={props.value} />;
}

function Avatar({ name, owner, size = 20 }: { name: string; owner: Owner; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.48),
        backgroundColor: OWNER_COLOR[owner],
      }}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

/* ───────────────────────────── resultado ───────────────────────────── */

function HeroCard({
  data,
  monthName,
  index,
  className,
}: {
  data: DashboardData;
  monthName: string;
  index: number;
  className?: string;
}) {
  const hide = data.household.hideBalances;
  const { income, expense, net } = data.totals;
  const spent = (o: Owner) => data.byOwner[o]?.expense ?? 0;
  const owners: { key: Owner; label: string }[] = [
    { key: "COUPLE", label: "Casal" },
    { key: "PARTNER_A", label: data.household.partnerAName },
    { key: "PARTNER_B", label: data.household.partnerBName },
  ];
  // Com receitas à mostra a barra representa a receita do mês (o que sobra
  // fica verde); no modo "só despesas" ela representa o total gasto.
  const base = hide ? expense : Math.max(income, expense);
  const share = (v: number) => (base > 0 ? (v / base) * 100 : 0);
  const pctOf = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  const pctBase = hide ? expense : income;
  const freePct = income > 0 ? Math.round((net / income) * 100) : null;

  return (
    <Card index={index} className={cn("relative overflow-hidden", className)}>
      {/* Enfeite: brilho da cor da marca no canto e a estrela girando devagar. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(85% 130% at 100% 0%, color-mix(in srgb, var(--color-brand) 14%, transparent) 0%, transparent 62%)",
        }}
        aria-hidden
      />
      <ArtheaStar
        size={210}
        className="slow-spin pointer-events-none absolute -right-12 -top-14 opacity-[0.09]"
      />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {hide ? `Despesas de ${monthName}` : `Resultado de ${monthName}`}
          </h2>
          {data.previous.expense > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-2.5 py-1 text-xs text-muted-foreground backdrop-blur">
              Despesas
              <PercentChange current={expense} previous={data.previous.expense} invertColors />
              vs. mês anterior
            </span>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-x-5 gap-y-2">
          <AnimatedMoney
            value={hide ? expense : net}
            size="xl"
            className={!hide && net < 0 ? "text-destructive" : undefined}
          />
          {!hide && freePct !== null && (
            <div className="pb-1.5 text-sm">
              <p
                className={cn(
                  "flex items-center gap-1 font-medium",
                  net >= 0 ? "text-success" : "text-destructive"
                )}
              >
                {net >= 0 ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
                {net >= 0
                  ? `${freePct}% das receitas livres`
                  : `gastos ${Math.abs(freePct)}% acima das receitas`}
              </p>
              <p className="text-muted-foreground">receitas menos despesas do mês</p>
            </div>
          )}
        </div>

        <div
          className="grow-x mt-7 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label="Composição do mês por dono"
        >
          {owners.map((o) =>
            spent(o.key) > 0 ? (
              <span
                key={o.key}
                style={{ width: `${share(spent(o.key))}%`, backgroundColor: OWNER_COLOR[o.key] }}
              />
            ) : null
          )}
          {!hide && net > 0 && <span className="bg-success" style={{ width: `${share(net)}%` }} />}
        </div>

        <dl className="mt-4 flex flex-wrap gap-x-7 gap-y-3 whitespace-nowrap text-[13px]">
          {!hide && (
            <div>
              <dt className="text-xs text-muted-foreground">Receitas</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{formatCurrency(income)}</dd>
            </div>
          )}
          {owners.map((o) => (
            <div key={o.key}>
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: OWNER_COLOR[o.key] }}
                />
                {o.label}
              </dt>
              <dd className="mt-0.5 font-semibold tabular-nums">
                − {formatCurrency(spent(o.key))}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {pctOf(spent(o.key), pctBase)}%
                </span>
              </dd>
            </div>
          ))}
          {!hide && (
            <div>
              <dt
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium",
                  net >= 0 ? "text-success" : "text-destructive"
                )}
              >
                = {net >= 0 ? "Sobra" : "Faltou"}
              </dt>
              <dd
                className={cn(
                  "mt-0.5 font-semibold tabular-nums",
                  net >= 0 ? "text-success" : "text-destructive"
                )}
              >
                {formatCurrency(Math.abs(net))}
                {freePct !== null && (
                  <span className="ml-1.5 text-xs font-normal opacity-80">{Math.abs(freePct)}%</span>
                )}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </Card>
  );
}

/* ─────────────────────────── contas a pagar ─────────────────────────── */

function BillsCard({
  bills,
  monthName,
  payingId,
  onPay,
  index,
  className,
}: {
  bills: Movement[];
  monthName: string;
  payingId: string | null;
  onPay: (m: Movement) => void;
  index: number;
  className?: string;
}) {
  const [day, setDay] = useState<string>("all");
  // Entram as despesas ainda não pagas e todas as faturas de cartão do mês
  // (fatura paga continua na lista, marcada, pra dar noção de progresso).
  const items = bills
    .filter((m) => (m.type === "EXPENSE" && m.status !== "paid") || m.type === "INVOICE")
    .sort((a, b) => {
      const pa = a.status === "paid" ? 1 : 0;
      const pb = b.status === "paid" ? 1 : 0;
      return pa - pb || a.date.localeCompare(b.date);
    });
  const open = items.filter((m) => m.status !== "paid");
  const overdue = open.filter((m) => m.status === "overdue").length;
  const total = open.reduce((s, m) => s + m.amount, 0);
  const dayOf = (m: Movement) => m.date.slice(8, 10);
  const days = Array.from(new Set(open.map(dayOf))).sort();
  const activeDay = day !== "all" && days.includes(day) ? day : "all";
  const visible = activeDay === "all" ? items : items.filter((m) => dayOf(m) === activeDay);

  return (
    <Card index={index} className={cn("flex flex-col", className)}>
      <CardHeader title="Contas a pagar" icon={CalendarClock} color="var(--color-warning)" />
      <AnimatedMoney value={total} />
      <p className="mt-2 text-sm text-muted-foreground">
        {open.length === 0 ? (
          `Nada em aberto em ${monthName}`
        ) : (
          <>
            {open.length} em aberto
            {overdue > 0 && (
              <span className="font-medium text-destructive">
                {" "}
                · {overdue} atrasada{overdue === 1 ? "" : "s"}
              </span>
            )}
          </>
        )}
      </p>

      {days.length > 1 && (
        <div className="no-scrollbar -mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {["all", ...days].map((d) => {
            const count = d === "all" ? open.length : open.filter((m) => dayOf(m) === d).length;
            const active = activeDay === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDay(d)}
                aria-pressed={active}
                className={cn(
                  "flex h-12 min-w-12 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-2.5 text-sm font-semibold tabular-nums transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-foreground hover:bg-muted"
                )}
              >
                {d === "all" ? "Todas" : d}
                <span
                  className="flex gap-0.5"
                  title={`${count} ${count === 1 ? "conta" : "contas"}`}
                >
                  {Array.from({ length: Math.min(count, 5) }, (_, k) => (
                    <span
                      key={k}
                      className={cn(
                        "h-1 w-1 rounded-full",
                        active ? "bg-primary-foreground/80" : "bg-muted-foreground/50"
                      )}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-success/15 text-success">
            <Check className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-medium">Tudo em dia</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Nenhuma conta pendente em {monthName}.
          </p>
        </div>
      ) : (
        <div className="relative mt-3 min-h-0 flex-1 xl:min-h-56">
        <ul className="max-h-80 divide-y divide-border overflow-y-auto xl:absolute xl:inset-0 xl:max-h-none">
          {visible.map((m) => {
            const paid = m.status === "paid";
            return (
              <li key={m.id} className="flex items-center gap-3 py-3">
                {paid ? (
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success text-white"
                    title="Paga"
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                ) : m.kind === "invoice" ? (
                  <Link
                    href="/cartoes"
                    title="Pagar fatura em Cartões"
                    aria-label={`Pagar ${m.description} em Cartões`}
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-muted-foreground/40 text-transparent transition-colors hover:border-primary hover:text-primary"
                  >
                    <ArrowRight className="h-3 w-3" strokeWidth={3} />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => onPay(m)}
                    disabled={payingId === m.id}
                    title="Marcar como paga"
                    aria-label={`Marcar ${m.description} como paga`}
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-muted-foreground/40 text-transparent transition-colors hover:border-success hover:text-success disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </button>
                )}
                <span
                  className={cn(
                    "w-5 shrink-0 text-xs tabular-nums",
                    m.status === "overdue"
                      ? "font-semibold text-destructive"
                      : "text-muted-foreground"
                  )}
                  title={
                    m.status === "overdue"
                      ? `Atrasada — venceu dia ${dayOf(m)}`
                      : `Vence dia ${dayOf(m)}`
                  }
                >
                  {dayOf(m)}
                </span>
                <span
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium",
                    paid && "text-muted-foreground line-through"
                  )}
                  title={m.kind === "invoice" ? m.description : `${m.description} · ${m.account.name}`}
                >
                  {m.kind === "invoice" && (
                    <CreditCard className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  {/* A descrição da fatura é "Fatura cartão <nome>": o ícone já
                      diz que é fatura, então sobra espaço pro nome do cartão. */}
                  <span className="truncate">
                    {m.kind === "invoice" ? m.account.name : m.description}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    paid && "text-muted-foreground"
                  )}
                >
                  {formatCurrency(m.amount)}
                </span>
              </li>
            );
          })}
        </ul>
        </div>
      )}

      <Link
        href="/lancamentos"
        className="mt-3 inline-flex items-center gap-1 self-start text-xs font-medium text-primary hover:underline"
      >
        Ver todas as movimentações <ArrowRight className="h-3 w-3" />
      </Link>
    </Card>
  );
}

/* ─────────────────────────── acerto do casal ─────────────────────────── */

function CoupleCard({
  open,
  month,
  names,
  monthName,
  index,
  className,
}: {
  /** saldo acumulado em aberto — o "quem deve a quem agora" */
  open: Pick<CoupleBalance, "netBalance"> | null;
  /** o que aconteceu no mês selecionado */
  month: CoupleBalance | null;
  names: { partnerAName: string; partnerBName: string };
  monthName: string;
  index: number;
  className?: string;
}) {
  const a = names.partnerAName;
  const b = names.partnerBName;
  const d = month?.details;
  // Quanto cada um pagou da parte do outro no mês (gastos do casal + pessoais).
  const advancedA = d ? d.aPaidForCouple + d.aPaidForB : 0;
  const advancedB = d ? d.bPaidForCouple + d.bPaidForA : 0;
  const settledInMonth = d ? d.settlementsAtoB + d.settlementsBtoA : 0;
  const totalAdvanced = advancedA + advancedB;
  const pctA = totalAdvanced > 0 ? (advancedA / totalAdvanced) * 100 : 50;
  // O número grande é o acumulado: um Pix de dezembro quita novembro.
  const net = open?.netBalance ?? 0;
  const isSettled = Math.abs(net) < 0.01;
  // net > 0: B deve a A.
  const debtor: Owner = net > 0 ? "PARTNER_B" : "PARTNER_A";
  const creditor: Owner = net > 0 ? "PARTNER_A" : "PARTNER_B";
  const nameOf = (o: Owner) => (o === "PARTNER_A" ? a : b);
  const lines = month
    ? [
        ...month.contributions.bOwesA.map((c) => ({ ...c, creditor: "PARTNER_A" as Owner })),
        ...month.contributions.aOwesB.map((c) => ({ ...c, creditor: "PARTNER_B" as Owner })),
      ]
        .sort((x, y) => y.contributionAmount - x.contributionAmount)
        .slice(0, 4)
    : [];
  const nothingAtAll = !open || (isSettled && totalAdvanced === 0 && settledInMonth === 0);

  return (
    <Card index={index} className={cn("flex flex-col", className)}>
      <CardHeader title="Acerto do casal" icon={Scale} color="var(--color-couple)" />
      {nothingAtAll ? (
        <EmptyNote>
          Nada pra acertar. As compras entram aqui quando um paga a parte do outro.
        </EmptyNote>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {isSettled ? "Em aberto hoje" : `${nameOf(debtor)} devolve pra ${nameOf(creditor)}`}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <AnimatedMoney value={Math.abs(net)} />
            {isSettled && (
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                tudo certo
              </span>
            )}
          </div>
          {!isSettled && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              em aberto hoje, somando todos os meses
            </p>
          )}

          <p className="mt-5 text-xs font-semibold">Em {monthName}</p>
          {totalAdvanced === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Ninguém pagou a parte do outro neste mês.
            </p>
          ) : (
            <>
              <div className="mt-2 flex items-end justify-between gap-3 text-xs">
                <div>
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-partner-a" />
                    {a} adiantou
                  </p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">
                    {formatCurrency(advancedA)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="flex items-center justify-end gap-1.5 text-muted-foreground">
                    {b} adiantou
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-partner-b" />
                  </p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">
                    {formatCurrency(advancedB)}
                  </p>
                </div>
              </div>
              <div
                className="grow-x mt-2 flex h-6 w-full gap-0.5 overflow-hidden rounded-lg text-[11px] font-semibold text-white"
                title={`Parte do outro que cada um pagou em ${monthName}`}
              >
                {advancedA > 0 && (
                  <span className="flex items-center bg-partner-a px-2" style={{ width: `${pctA}%` }}>
                    {pctA >= 18 && `${pctA.toFixed(0)}%`}
                  </span>
                )}
                {advancedB > 0 && (
                  <span
                    className="flex items-center justify-end bg-partner-b px-2"
                    style={{ width: `${100 - pctA}%` }}
                  >
                    {100 - pctA >= 18 && `${(100 - pctA).toFixed(0)}%`}
                  </span>
                )}
              </div>
            </>
          )}

          {settledInMonth > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Acertos registrados no mês:{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {formatCurrency(settledInMonth)}
              </span>
            </p>
          )}

          {lines.length > 0 && (
            <ul className="mt-3 divide-y divide-border">
              {lines.map((l) => (
                <li key={`${l.creditor}-${l.id}`} className="flex items-center gap-2.5 py-2 text-sm">
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: OWNER_COLOR[l.creditor] }}
                    title={`${nameOf(l.creditor)} pagou`}
                  />
                  <span className="min-w-0 flex-1 truncate">{l.description}</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatCurrency(l.contributionAmount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {!nothingAtAll && !isSettled && (
            <>
              <Avatar name={nameOf(debtor)} owner={debtor} />
              <ArrowRight className="h-3 w-3 shrink-0" />
              <Avatar name={nameOf(creditor)} owner={creditor} />
            </>
          )}
          <span className="truncate">
            {nothingAtAll ? "Sem nada em aberto" : isSettled ? "Tudo certo entre vocês" : "falta acertar"}
          </span>
        </p>
        <Link
          href="/casal"
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          {!nothingAtAll && !isSettled ? "Registrar acerto" : "Abrir Casal"}
        </Link>
      </div>
    </Card>
  );
}

/* ─────────────────────────────── cartões ─────────────────────────────── */

const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  OPEN: "Aberta",
  CLOSED: "Fechada",
  PAID: "Paga",
  OVERDUE: "Atrasada",
};

function CardsCard({
  accounts,
  invoices,
  year,
  month0,
  index,
  className,
}: {
  accounts: Account[];
  invoices: CardInvoice[];
  year: number;
  month0: number;
  index: number;
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const cards = accounts.filter((acc) => acc.type === "CREDIT_CARD");
  const months = [0, 1, 2].map((i) => {
    const dt = new Date(year, month0 + i, 1);
    const y = dt.getFullYear();
    const m = dt.getMonth();
    const list = invoices.filter((inv) => inv.year === y && inv.month === m);
    return { y, m, list, total: list.reduce((s, inv) => s + inv.total, 0) };
  });
  const current = months[0];
  const currentStatus: InvoiceStatus | null =
    current.list.length === 0
      ? null
      : current.list.some((i) => i.status === "OVERDUE")
      ? "OVERDUE"
      : current.list.every((i) => i.status === "PAID")
      ? "PAID"
      : current.list.some((i) => i.status === "OPEN")
      ? "OPEN"
      : "CLOSED";
  const maxTotal = Math.max(...months.map((mm) => mm.total), 1);
  // Altura (0-1) de cada ponto da linha das próximas faturas.
  const level = (t: number) => 0.15 + 0.7 * (t / maxTotal);

  function scrollCards(dir: 1 | -1) {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <Card index={index} className={cn("flex flex-col", className)}>
      <CardHeader title="Cartões" icon={CreditCard} color="var(--color-primary)" />
      {cards.length === 0 ? (
        <EmptyNote>
          Nenhum cartão cadastrado.{" "}
          <Link href="/cartoes" className="font-medium text-primary hover:underline">
            Cadastrar cartão
          </Link>
        </EmptyNote>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Faturas de {MONTHS_LONG[current.m]}
          </p>
          <AnimatedMoney value={current.total} className="mt-1" />

          <div className="mt-4 flex items-center justify-between">
            <Link
              href="/cartoes"
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Ver faturas
            </Link>
            {cards.length > 1 && (
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => scrollCards(-1)}
                  aria-label="Cartão anterior"
                  className="rounded-full border border-border p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollCards(1)}
                  aria-label="Próximo cartão"
                  className="rounded-full border border-border p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          <div
            ref={scroller}
            className="no-scrollbar -mx-5 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5"
          >
            {cards.map((card) => {
              const inv = current.list.find((i) => i.accountId === card.id);
              const free = card.creditLimit != null ? card.creditLimit + card.balance : null;
              return (
                <div
                  key={card.id}
                  className="relative flex aspect-[1.7/1] w-[84%] max-w-[300px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-2xl p-4 text-white transition-transform duration-300 hover:-translate-y-0.5"
                  style={{
                    background: `linear-gradient(135deg, color-mix(in srgb, ${card.color} 88%, black) 0%, color-mix(in srgb, ${card.color} 48%, black) 100%)`,
                  }}
                >
                  <span
                    className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-white/10"
                    aria-hidden
                  />
                  <div className="relative flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{card.name}</p>
                      <p className="text-[11px] tabular-nums opacity-75">
                        {inv
                          ? `vence ${inv.dueDate.slice(8, 10)}/${inv.dueDate.slice(5, 7)}`
                          : card.dueDay
                          ? `vence dia ${pad2(card.dueDay)}`
                          : "sem vencimento"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium">
                      {inv ? INVOICE_STATUS_LABEL[inv.status] : "Sem fatura"}
                    </span>
                  </div>
                  <div className="relative flex items-center justify-between">
                    <span
                      className="h-6 w-8 rounded-md border border-black/10 bg-gradient-to-br from-amber-100 to-amber-300"
                      aria-hidden
                    />
                    <Wifi className="h-4 w-4 rotate-90 opacity-70" aria-hidden />
                  </div>
                  <div className="relative flex items-end justify-between gap-2">
                    <div>
                      <p className="text-[9px] font-medium uppercase tracking-wider opacity-70">
                        Fatura
                      </p>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCurrency(inv?.total ?? 0)}
                      </p>
                    </div>
                    {free != null && (
                      <div className="text-right">
                        <p className="text-[9px] font-medium uppercase tracking-wider opacity-70">
                          Limite livre
                        </p>
                        <p className="text-sm font-semibold tabular-nums">{formatCurrency(free)}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Próximas faturas
          </p>
          <div className="relative mt-2 grid grid-cols-3 gap-2">
            {months.map((mm, i) => (
              <div
                key={`${mm.y}-${mm.m}`}
                className={cn(
                  "flex h-28 flex-col justify-between rounded-xl border p-2.5 text-center",
                  i === 0 ? "border-primary bg-primary/5" : "border-border bg-muted/40"
                )}
              >
                <div>
                  <p className="text-xs font-semibold capitalize">
                    {MONTHS_SHORT[mm.m]}
                    {mm.y !== year && ` ${String(mm.y).slice(-2)}`}
                  </p>
                  {i === 0 && currentStatus && (
                    <span
                      className={cn(
                        "mt-0.5 inline-block rounded-full px-1.5 text-[10px] font-medium",
                        currentStatus === "OVERDUE"
                          ? "bg-destructive/15 text-destructive"
                          : currentStatus === "PAID"
                          ? "bg-success/15 text-success"
                          : "bg-primary/15 text-primary"
                      )}
                    >
                      {INVOICE_STATUS_LABEL[currentStatus]}
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    "text-xs font-semibold tabular-nums",
                    i === 0 ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {formatCurrency(mm.total)}
                </p>
              </div>
            ))}
            {/* linha pontilhada ligando os 3 meses, por cima dos blocos */}
            <svg
              className="pointer-events-none absolute inset-x-0 top-[3.25rem] h-7 w-full text-muted-foreground/60"
              viewBox="0 0 300 36"
              preserveAspectRatio="none"
              aria-hidden
            >
              <polyline
                points={months.map((mm, i) => `${50 + i * 100},${36 - level(mm.total) * 36}`).join(" ")}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {months.map((mm, i) => (
              <span
                key={`dot-${i}`}
                className={cn(
                  "pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-card",
                  i === 0 ? "border-primary" : "border-muted-foreground/60"
                )}
                style={{
                  left: `${((50 + i * 100) / 300) * 100}%`,
                  top: `calc(3.25rem + ${(1 - level(mm.total)) * 1.75}rem)`,
                }}
                aria-hidden
              />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

/* ───────────────────────────── categorias ───────────────────────────── */

function CategoriesCard({
  categories,
  monthName,
  index,
  className,
}: {
  categories: DashboardData["expensesByCategory"];
  monthName: string;
  index: number;
  className?: string;
}) {
  const total = categories.reduce((s, c) => s + c.amount, 0);
  return (
    <Card index={index} className={className}>
      <CardHeader title="Para onde foi" icon={PieChart} color="var(--color-couple)" />
      {categories.length === 0 ? (
        <EmptyNote>Nenhuma despesa em {monthName}.</EmptyNote>
      ) : (
        <>
          <CategoryDonut
            data={categories.map((c) => ({ name: c.name, amount: c.amount, color: c.color }))}
            size={190}
          />
          <ul className="mt-4 space-y-2 text-xs">
            {categories.slice(0, 5).map((c) => (
              <li key={c.categoryId || "none"} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="truncate">{c.name}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-medium">{formatCurrency(c.amount)}</span>{" "}
                  <span className="text-muted-foreground">
                    {total > 0 ? Math.round((c.amount / total) * 100) : 0}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/* ─────────────────────────────── contas ─────────────────────────────── */

function AccountsStrip({
  data,
  index,
  className,
}: {
  data: DashboardData;
  index: number;
  className?: string;
}) {
  const hide = data.household.hideBalances;
  const bank = data.accounts.filter((acc) => acc.type !== "CREDIT_CARD");
  const cards = data.accounts.filter((acc) => acc.type === "CREDIT_CARD");
  const cardDebt = cards.reduce((s, acc) => s + acc.balance, 0);
  return (
    <Card
      index={index}
      className={cn("flex flex-wrap items-center gap-x-10 gap-y-5", className)}
    >
      <div className="shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Suas contas</h2>
          <Link href="/contas" className="text-xs font-medium text-primary hover:underline">
            Gerenciar
          </Link>
        </div>
        {!hide && (
          <>
            <p className="mt-3 text-xs text-muted-foreground">Saldo total</p>
            <AnimatedMoney
              value={data.totals.balance}
              className={cn("mt-1", data.totals.balance < 0 && "text-destructive")}
            />
          </>
        )}
      </div>
      {data.accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
      ) : (
        <ul className="grid min-w-0 flex-1 basis-80 grid-cols-[repeat(auto-fill,minmax(11.5rem,1fr))] gap-2">
          {bank.map((acc) => (
            <li
              key={acc.id}
              className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/40 px-3.5 py-2.5"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: acc.color }}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{acc.name}</span>
                <span
                  className={cn(
                    "block text-xs tabular-nums text-muted-foreground",
                    !hide && acc.balance < 0 && "text-destructive"
                  )}
                >
                  {hide ? ACCOUNT_TYPE_LABEL[acc.type] : formatCurrency(acc.balance)}
                </span>
              </span>
            </li>
          ))}
          {cards.length > 0 && (
            <li className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/40 px-3.5 py-2.5">
              <CreditCard className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {cards.length} {cards.length === 1 ? "cartão" : "cartões"} · em aberto
                </span>
                <span
                  className={cn(
                    "block text-xs tabular-nums text-muted-foreground",
                    !hide && cardDebt < 0 && "text-destructive"
                  )}
                >
                  {hide ? "faturas não pagas" : formatCurrency(cardDebt)}
                </span>
              </span>
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

/* ─────────────────────────────── esqueleto ─────────────────────────────── */

function DashboardSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12"
      aria-busy
      aria-label="Carregando painel"
    >
      <div className="skeleton h-64 !rounded-2xl md:col-span-2 xl:col-span-8" />
      <div className="skeleton h-64 !rounded-2xl md:col-span-2 xl:col-span-4 xl:row-span-2 xl:h-auto" />
      <div className="skeleton h-96 !rounded-2xl xl:col-span-4" />
      <div className="skeleton h-96 !rounded-2xl xl:col-span-4" />
    </div>
  );
}
