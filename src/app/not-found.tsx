import Link from "next/link";
import type { Metadata } from "next";
import { ArtheaLogo, ArtheaStar } from "@/components/financas/logo";

export const metadata: Metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden px-6 py-8 text-white"
      style={{
        background:
          "radial-gradient(70% 55% at 0% 100%, rgba(43,160,160,0.45) 0%, transparent 70%), radial-gradient(55% 45% at 100% 0%, rgba(29,112,112,0.5) 0%, transparent 70%), #061A1A",
      }}
    >
      <ArtheaStar
        size={560}
        inverted
        className="slow-spin pointer-events-none absolute -bottom-44 -right-40 opacity-[0.12]"
      />
      <div className="relative">
        <ArtheaLogo size="sm" inverted />
      </div>
      <main className="relative mx-auto flex w-full max-w-xl flex-1 flex-col justify-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
          Erro 404
        </p>
        <h1 className="rise-in mt-3 font-headline text-[clamp(3rem,9vw,5.5rem)] leading-[0.95] tracking-[-0.02em]">
          Essa página <span className="text-[#8EE3D8]">não existe.</span>
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-white/70">
          O endereço pode ter mudado ou ter sido digitado com algum erro. Seus dados continuam
          guardados, é só voltar.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#062020] transition-opacity hover:opacity-90"
          >
            Voltar para a visão geral
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Página inicial
          </Link>
        </div>
      </main>
    </div>
  );
}
