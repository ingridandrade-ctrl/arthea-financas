import { redirect } from "next/navigation";
import Link from "next/link";
import {
  PiggyBank,
  Sparkles,
  Users,
  CreditCard,
  Repeat,
  Target,
  BarChart3,
  FileText,
  ArrowRight,
} from "lucide-react";
import { getSessionFromCookies, householdExists } from "@/lib/financas/session";

export default async function FinancasLandingPage() {
  const session = getSessionFromCookies();
  if (session) redirect("/dashboard");
  const exists = await householdExists();
  const ctaHref = exists ? "/login" : "/setup";
  const ctaLabel = exists ? "Entrar" : "Criar conta";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <header className="sticky top-0 z-10 backdrop-blur bg-background/70 border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <PiggyBank className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <p className="text-base font-bold">Arthea</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Finanças Pessoais
              </p>
            </div>
          </div>
          <Link
            href={ctaHref}
            className="text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 font-medium"
          >
            {ctaLabel}
          </Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          Importe fatura em PDF com IA
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-5 max-w-3xl mx-auto">
          Finanças pessoais{" "}
          <span className="text-primary">pra você e quem você ama</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Controle os gastos do casal sem planilha. Categorize compras
          automaticamente, divida despesas e descubra pra onde foi o dinheiro do
          mês.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 text-base"
          >
            {ctaLabel}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border hover:bg-muted text-base font-medium"
          >
            Conhecer recursos
          </a>
        </div>
      </section>

      <section
        id="features"
        className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <FeatureCard
          icon={<Sparkles className="w-5 h-5" />}
          title="Importação de fatura com IA"
          description="Anexa o PDF do seu cartão (Itaú, Nubank, Bradesco, Inter, etc.), a IA lê e cria todos os lançamentos categorizados em segundos."
        />
        <FeatureCard
          icon={<Users className="w-5 h-5" />}
          title="Conta de casal"
          description="Um único login compartilhado entre você e seu parceiro. Cada despesa pode ser sua, dele(a) ou dividida 50/50 — ou qualquer percentual."
        />
        <FeatureCard
          icon={<CreditCard className="w-5 h-5" />}
          title="Cartão de crédito decente"
          description="Faturas mensais geradas automaticamente com fechamento e vencimento. Marca como paga quando rola e tudo se ajusta sozinho."
        />
        <FeatureCard
          icon={<Repeat className="w-5 h-5" />}
          title="Recorrências automáticas"
          description="Aluguel, assinaturas, salário... cadastra uma vez e o sistema lança todo mês, sem você precisar lembrar."
        />
        <FeatureCard
          icon={<Target className="w-5 h-5" />}
          title="Metas de poupança"
          description="Viagem dos sonhos? Reserva pra casa nova? Defina objetivos, acompanhe o progresso e veja quanto falta."
        />
        <FeatureCard
          icon={<BarChart3 className="w-5 h-5" />}
          title="Relatórios e orçamento"
          description="Quanto cada um gastou, por categoria, no mês ou no ano. Defina tetos e acompanhe quanto sobrou em cada categoria."
        />
        <FeatureCard
          icon={<FileText className="w-5 h-5" />}
          title="Quem deve a quem"
          description="O sistema calcula automaticamente as contas do casal estilo Splitwise: pague junto, registre quem pagou, veja saldo entre vocês."
        />
        <FeatureCard
          icon={<PiggyBank className="w-5 h-5" />}
          title="Modo só despesas"
          description="Não quer cadastrar salário? Sem problema. Liga o modo só despesas e foca só no que sai, sem ver saldo negativo."
        />
        <FeatureCard
          icon={<BarChart3 className="w-5 h-5" />}
          title="Exporta tudo em CSV"
          description="Quer mexer no Excel ou levar pro contador? Baixa qualquer relatório em CSV (UTF-8 com BOM, abre certo no Excel BR)."
        />
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">
          Bora começar?
        </h2>
        <p className="text-muted-foreground mb-6">
          {exists
            ? "Sua conta já existe. Entra e segue do ponto que parou."
            : "São 30 segundos pra criar a conta compartilhada do casal."}
        </p>
        <Link
          href={ctaHref}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90"
        >
          {ctaLabel}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      <footer className="border-t border-border mt-10">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between flex-wrap gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Arthea Finanças Pessoais.</p>
          <p>Feito pra quem quer entender pra onde o dinheiro foi.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="text-base font-semibold mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
