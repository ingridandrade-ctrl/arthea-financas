import { redirect } from "next/navigation";
import {
  getSessionFromCookies,
  getCurrentUser,
  getImpersonationOriginToken,
} from "@/lib/financas/session";
import { FinancasSidebar } from "@/components/financas/sidebar";
import { ImpersonationBanner } from "@/components/financas/impersonation-banner";
import { runRecurringForHousehold } from "@/lib/financas/recurring";

export default async function FinancasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = getSessionFromCookies();

  if (!session) {
    redirect("/");
  }

  // Recorrências: as contas do mês nascem sozinhas quando alguém abre o
  // sistema, antes de qualquer tela buscar dados. Se der erro aqui, o app
  // abre do mesmo jeito — só não gera nada desta vez.
  try {
    await runRecurringForHousehold(session.hid);
  } catch (err) {
    console.error("[recorrencias] geração automática falhou", err);
  }

  const user = await getCurrentUser();
  const impersonating = !!getImpersonationOriginToken();
  const isAdmin = !!user?.isAdmin;

  return (
    <div className="min-h-screen bg-canvas text-foreground">
      <FinancasSidebar
        isAdmin={isAdmin}
        userName={user?.name ?? null}
        userEmail={user?.email ?? null}
      />
      {/* 0.75rem de respiro + 15rem do menu lateral flutuante */}
      <div className="lg:pl-[15.75rem]">
        {impersonating && user && (
          <ImpersonationBanner asName={user.name} asEmail={user.email} />
        )}
        <main className="mx-auto max-w-[1600px] p-3">{children}</main>
      </div>
    </div>
  );
}
