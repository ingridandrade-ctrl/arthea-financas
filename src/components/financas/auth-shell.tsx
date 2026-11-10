import { ArtheaLogo, ArtheaStar } from "@/components/financas/logo";
import { ThemeToggle } from "@/components/financas/theme-toggle";

/**
 * Moldura das telas de entrada (login, cadastro, setup, convite): painel da
 * marca à esquerda em telas largas, formulário à direita. Em telas estreitas
 * fica só o formulário.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[1.05fr_1fr]">
      <aside
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex xl:p-16"
        style={{
          background:
            "radial-gradient(70% 55% at 0% 100%, rgba(43,160,160,0.45) 0%, transparent 70%), radial-gradient(55% 45% at 100% 0%, rgba(29,112,112,0.5) 0%, transparent 70%), #061A1A",
        }}
      >
        <ArtheaStar
          size={620}
          inverted
          className="slow-spin pointer-events-none absolute -bottom-40 -right-44 opacity-[0.13]"
        />
        <div className="relative">
          <ArtheaLogo size="base" inverted />
        </div>
        <div className="relative">
          <p
            className="rise-in font-headline text-[clamp(3.5rem,6.2vw,6.5rem)] leading-[0.92] tracking-[-0.02em]"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            Pra você e<br />
            quem você <span className="text-[#8EE3D8]">ama.</span>
          </p>
          <p
            className="rise-in mt-6 max-w-md text-base leading-relaxed text-white/70"
            style={{ "--i": 3 } as React.CSSProperties}
          >
            Cada gasto é meu, seu ou nosso. No fim do mês, um número só: quem acerta com quem.
          </p>
        </div>
        <p className="relative text-[11px] font-medium uppercase tracking-[0.22em] text-white/45">
          Finanças a dois, sem planilha
        </p>
      </aside>

      <div className="relative flex items-center justify-center p-6">
        <div className="absolute right-6 top-6">
          <ThemeToggle variant="icon" />
        </div>
        {children}
      </div>
    </div>
  );
}
