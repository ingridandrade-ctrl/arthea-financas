import { redirect } from "next/navigation";
import {
  getSessionFromCookies,
  getCurrentUser,
  getImpersonationOriginToken,
} from "@/lib/financas/session";
import { FinancasSidebar } from "@/components/financas/sidebar";
import { ImpersonationBanner } from "@/components/financas/impersonation-banner";

export default async function FinancasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = getSessionFromCookies();

  if (!session) {
    redirect("/");
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
