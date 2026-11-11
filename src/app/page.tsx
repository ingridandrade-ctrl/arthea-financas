import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  EyeOff,
  History,
  Repeat,
  Target,
  UserPlus,
  PieChart,
} from "lucide-react";
import { getSessionFromCookies } from "@/lib/financas/session";
import { ArtheaLogo, ArtheaStar } from "@/components/financas/logo";
import { Reveal } from "@/components/financas/reveal";

// Cores fixas dos exemplos ilustrativos (não dependem do tema: os cartões de
// exemplo são sempre claros, como um print do produto).
const TEAL = "#1D7070";
const ORANGE = "#C2410C";
const INDIGO = "#6366F1";
const GREEN = "#16A34A";

const DARK_BG =
  "radial-gradient(60% 55% at 88% 12%, rgba(43,160,160,0.38) 0%, transparent 70%), radial-gradient(55% 60% at 0% 100%, rgba(29,112,112,0.5) 0%, transparent 70%), #061A1A";

export default async function FinancasLandingPage() {
  const session = getSessionFromCookies();
  if (session) redirect("/dashboard");

  return (
    <div className="bg-background text-foreground">
      {/* Sem JavaScript o conteúdo que "revela ao rolar" precisa estar visível. */}
      <noscript>
        <style>{`.reveal{opacity:1!important;transform:none!important}`}</style>
      </noscript>

      {/* ───────────── abertura ───────────── */}
      <section className="relative isolate overflow-hidden text-white" style={{ background: DARK_BG }}>
        <ArtheaStar
          size={760}
          inverted
          className="slow-spin pointer-events-none absolute -right-56 -top-40 -z-10 opacity-[0.12]"
        />

        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <ArtheaLogo size="sm" inverted href={null} />
          <nav className="flex items-center gap-1.5 text-sm font-medium">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-white/80 transition-colors hover:text-white"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="rounded-full bg-white px-4 py-2 text-[#061A1A] transition-opacity hover:opacity-90"
            >
              Criar conta
            </Link>
          </nav>
        </header>

        <div className="mx-auto max-w-6xl px-6 pt-14 sm:pt-20 lg:pt-24">
          <p
            className="rise-in text-[11px] font-medium uppercase tracking-[0.24em] text-white/55"
            style={{ "--i": 0 } as React.CSSProperties}
          >
            Finanças a dois, sem planilha
          </p>
          <h1
            className="rise-in mt-5 font-headline text-[clamp(3.5rem,10vw,9rem)] leading-[0.9] tracking-[-0.02em]"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            Pra você e
            <br />
            quem você <span className="text-[#8EE3D8]">ama.</span>
          </h1>
          <p
            className="rise-in mt-7 max-w-xl text-lg leading-relaxed text-white/70"
            style={{ "--i": 3 } as React.CSSProperties}
          >
            Cada gasto é meu, seu ou nosso. A fatura do cartão se lê sozinha. No fim do mês, um
            número só: quem acerta com quem.
          </p>
          <div
            className="rise-in mt-9 flex flex-wrap items-center gap-3"
            style={{ "--i": 4 } as React.CSSProperties}
          >
            <Link
              href="/cadastro"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-base font-medium text-[#061A1A] transition-transform hover:-translate-y-0.5"
            >
              Criar conta
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3.5 text-base font-medium text-white/90 transition-colors hover:bg-white/10"
            >
              Ver como funciona
            </a>
          </div>
        </div>

        {/* O produto "subindo" da dobra: um recorte do painel, cortado embaixo. */}
        <div
          className="rise-in mx-auto mt-16 max-w-5xl px-4 sm:px-6 lg:mt-20"
          style={{ "--i": 6 } as React.CSSProperties}
        >
          <div
            className="rounded-t-[28px] border border-b-0 border-white/15 bg-[#F1F4F4] p-3 pb-0 text-[#0a0a0a] shadow-[0_-30px_80px_-20px_rgba(43,160,160,0.45)]"
            aria-hidden
          >
            <div className="grid gap-3 md:grid-cols-[1.9fr_1fr]">
              <div className="rounded-t-2xl bg-white p-6 md:rounded-b-none">
                <p className="text-sm font-semibold">Resultado de novembro</p>
                <div className="mt-5 flex flex-wrap items-end gap-x-5 gap-y-1">
                  <p className="text-[2.75rem] font-bold leading-none tracking-tight tabular-nums sm:text-[3.5rem]">
                    <span className="mr-2 font-semibold opacity-40">R$</span>
                    12.882<span className="text-[0.42em] font-semibold opacity-55">,95</span>
                  </p>
                  <p className="pb-1.5 text-sm font-medium" style={{ color: GREEN }}>
                    ↗ 49% das receitas livres
                  </p>
                </div>
                <div className="mt-6 flex h-3 gap-0.5 overflow-hidden rounded-full bg-neutral-100">
                  <span style={{ width: "44%", background: INDIGO }} />
                  <span style={{ width: "5%", background: TEAL }} />
                  <span style={{ width: "3%", background: ORANGE }} />
                  <span style={{ width: "48%", background: "#22C55E" }} />
                </div>
                <div className="mt-4 flex flex-wrap gap-x-7 gap-y-2 pb-6 text-[13px]">
                  {[
                    ["Receitas", "R$ 26.500,00", ""],
                    ["Casal", "− R$ 11.581,20", INDIGO],
                    ["Ana", "− R$ 1.251,95", TEAL],
                    ["Léo", "− R$ 783,90", ORANGE],
                  ].map(([label, value, color]) => (
                    <div key={label}>
                      <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                        {color && (
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                        )}
                        {label}
                      </p>
                      <p className="mt-0.5 font-semibold tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="hidden rounded-t-2xl bg-white p-6 md:block">
                <p className="text-sm font-semibold">Contas a pagar</p>
                <p className="mt-4 text-[2rem] font-bold leading-none tracking-tight tabular-nums">
                  <span className="mr-1.5 font-semibold opacity-40">R$</span>
                  4.927<span className="text-[0.42em] font-semibold opacity-55">,90</span>
                </p>
                <ul className="mt-5 divide-y divide-neutral-200 text-sm">
                  {[
                    ["10", "Aluguel", "R$ 2.400,00"],
                    ["15", "Luz", "R$ 300,00"],
                    ["20", "Internet", "R$ 129,90"],
                  ].map(([day, name, value]) => (
                    <li key={name} className="flex items-center gap-3 py-2.5">
                      <span className="h-4 w-4 rounded-full border-2 border-neutral-300" />
                      <span className="w-5 text-xs text-neutral-400 tabular-nums">{day}</span>
                      <span className="flex-1 font-medium">{name}</span>
                      <span className="font-semibold tabular-nums">{value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── três ideias ───────────── */}
      <div id="como-funciona" className="scroll-mt-6">
        <Statement
          number="01"
          kicker="Divisão"
          title={
            <>
              Meu, seu,
              <br />
              nosso.
            </>
          }
          text="Cada gasto tem dono: de um, do outro ou do casal. O que é do casal pode ser meio a meio ou na proporção que vocês combinarem."
        >
          <ExampleCard>
            <ul className="divide-y divide-neutral-200 text-sm">
              {[
                ["Mercado", "Casal", INDIGO, "R$ 612,40"],
                ["Academia", "Ana", TEAL, "R$ 189,00"],
                ["Barbearia", "Léo", ORANGE, "R$ 90,00"],
                ["Viagem", "Casal · 60/40", INDIGO, "R$ 2.400,00"],
              ].map(([name, owner, color, value]) => (
                <li key={name} className="flex items-center gap-3 py-3">
                  <span className="h-8 w-1 rounded-full" style={{ background: color }} />
                  <span className="flex-1 font-medium">{name}</span>
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium text-white"
                    style={{ background: color }}
                  >
                    {owner}
                  </span>
                  <span className="w-24 text-right font-semibold tabular-nums">{value}</span>
                </li>
              ))}
            </ul>
          </ExampleCard>
        </Statement>

        <Statement
          number="02"
          kicker="Cartão"
          flip
          title={
            <>
              A fatura se
              <br />
              lê sozinha.
            </>
          }
          text="Suba o PDF da fatura. A IA lança as compras e o sistema já separa de quem é cada uma, lembrando do que vocês marcaram nos meses anteriores — inclusive as parcelas."
        >
          <ExampleCard>
            <p className="mb-3 flex items-center justify-between text-xs text-neutral-500">
              <span className="font-medium text-neutral-900">fatura-novembro.pdf</span>
              <span>42 compras · 31 já separadas</span>
            </p>
            <ul className="space-y-1.5 text-sm">
              {[
                ["Sofá (4/10)", "herdado da parcela 3/10", INDIGO, "Casal", "R$ 489,00"],
                ["iFood", "histórico (7×)", INDIGO, "Casal", "R$ 86,90"],
                ["Farmácia", "histórico (4×)", TEAL, "Ana", "R$ 54,20"],
                ["Posto Shell", "histórico (5×)", ORANGE, "Léo", "R$ 310,00"],
              ].map(([name, why, color, owner, value]) => (
                <li
                  key={name}
                  className="flex items-center gap-3 rounded-lg border-l-4 py-2.5 pl-3 pr-2"
                  style={{ borderColor: color, background: `${color}14` }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{name}</span>
                    <span className="block text-[11px] text-neutral-500">⟲ {why}</span>
                  </span>
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium text-white"
                    style={{ background: color }}
                  >
                    {owner}
                  </span>
                  <span className="w-20 text-right font-semibold tabular-nums">{value}</span>
                </li>
              ))}
            </ul>
          </ExampleCard>
        </Statement>

        <Statement
          number="03"
          kicker="Acerto"
          title={
            <>
              No fim do mês,
              <br />
              um número.
            </>
          }
          text="Quem pagou a mais recebe de volta. O sistema soma tudo e mostra quanto um devolve pro outro. Registrou o Pix, zerou."
        >
          <ExampleCard>
            <p className="text-xs text-neutral-500">Léo devolve pra Ana</p>
            <p className="mt-1 text-[2.5rem] font-bold leading-none tracking-tight tabular-nums">
              <span className="mr-2 font-semibold opacity-40">R$</span>
              1.204<span className="text-[0.42em] font-semibold opacity-55">,45</span>
            </p>
            <div className="mt-6 flex justify-between text-xs text-neutral-500">
              <span>Ana adiantou · R$ 2.764,45</span>
              <span>Léo adiantou · R$ 1.560,00</span>
            </div>
            <div className="mt-2 flex h-6 gap-0.5 overflow-hidden rounded-lg text-[11px] font-semibold text-white">
              <span className="flex items-center px-2" style={{ width: "64%", background: TEAL }}>
                64%
              </span>
              <span
                className="flex items-center justify-end px-2"
                style={{ width: "36%", background: ORANGE }}
              >
                36%
              </span>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-neutral-200 pt-4">
              <span className="text-xs text-neutral-500">falta acertar</span>
              <span className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium">
                Registrar acerto
              </span>
            </div>
          </ExampleCard>
        </Statement>
      </div>

      {/* ───────────── o resto, sem caixinhas ───────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
          <Reveal>
            <h2 className="font-headline text-[clamp(2.5rem,5vw,4rem)] leading-none tracking-[-0.01em]">
              E o dia a dia inteiro.
            </h2>
          </Reveal>
          <ul className="mt-12 grid gap-x-12 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {EXTRAS.map((f, i) => (
              <li key={f.title}>
                <Reveal delay={(i % 3) * 90}>
                  <f.icon className="h-5 w-5 text-primary" />
                  <h3 className="mt-3 text-base font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────────── chamada final ───────────── */}
      <section className="relative isolate overflow-hidden text-white" style={{ background: DARK_BG }}>
        <ArtheaStar
          size={520}
          inverted
          className="slow-spin pointer-events-none absolute -bottom-52 -left-40 -z-10 opacity-[0.12]"
        />
        <div className="mx-auto max-w-6xl px-6 py-24 text-center lg:py-32">
          <Reveal>
            <h2 className="font-headline text-[clamp(3rem,8vw,7rem)] leading-[0.92] tracking-[-0.02em]">
              Bora começar?
            </h2>
            <p className="mx-auto mt-6 max-w-md text-lg text-white/70">
              São 30 segundos pra criar a conta. Depois é só convidar quem divide a vida com você.
            </p>
            <Link
              href="/cadastro"
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-base font-medium text-[#061A1A] transition-transform hover:-translate-y-0.5"
            >
              Criar conta
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
        <footer className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-white/50">
            <p>© {new Date().getFullYear()} Arthea Finanças.</p>
            <p>Feito pra quem quer entender pra onde o dinheiro foi.</p>
          </div>
        </footer>
      </section>
    </div>
  );
}

const EXTRAS = [
  {
    icon: CalendarClock,
    title: "Contas a pagar",
    text: "O que vence no mês numa lista só. Pagou, marca com um clique.",
  },
  {
    icon: Repeat,
    title: "Recorrências",
    text: "Aluguel, assinatura, salário: cadastra uma vez e as contas do mês aparecem sozinhas pra pagar.",
  },
  {
    icon: History,
    title: "Parcelas sob controle",
    text: "Cada parcela cai na fatura certa e as próximas já aparecem nos meses seguintes.",
  },
  {
    icon: Target,
    title: "Metas",
    text: "Viagem, reserva, entrada do apê. Acompanhem quanto falta, juntos.",
  },
  {
    icon: PieChart,
    title: "Orçamento",
    text: "Um teto por categoria e o quanto ainda sobra em cada uma.",
  },
  {
    icon: BarChart3,
    title: "Relatórios",
    text: "Quanto cada um gastou, por categoria, no mês ou no ano. Exporta em CSV.",
  },
  {
    icon: EyeOff,
    title: "Modo só despesas",
    text: "Não quer cadastrar salário? Foquem só no que sai, sem ver saldo.",
  },
  {
    icon: UserPlus,
    title: "Cada um com seu login",
    text: "Um cria a conta e convida o outro. Os dois veem a mesma casa.",
  },
];

function Statement({
  number,
  kicker,
  title,
  text,
  flip = false,
  children,
}: {
  number: string;
  kicker: string;
  title: React.ReactNode;
  text: string;
  /** exemplo à esquerda, texto à direita */
  flip?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border first:border-t-0">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 lg:grid-cols-2 lg:gap-16 lg:py-32">
        <Reveal className={flip ? "lg:order-2" : undefined}>
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            <span className="text-primary">{number}</span> — {kicker}
          </p>
          <h2 className="mt-4 font-headline text-[clamp(3rem,7vw,6rem)] leading-[0.92] tracking-[-0.02em]">
            {title}
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">{text}</p>
        </Reveal>
        <Reveal delay={120} className={flip ? "lg:order-1" : undefined}>
          {children}
        </Reveal>
      </div>
    </section>
  );
}

/** Cartão de exemplo — sempre claro, como um recorte do produto. */
function ExampleCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-3xl border border-border bg-[#F1F4F4] p-3 shadow-[0_30px_80px_-40px_rgba(29,112,112,0.45)]"
      aria-hidden
    >
      <div className="rounded-2xl bg-white p-6 text-[#0a0a0a]">{children}</div>
    </div>
  );
}
