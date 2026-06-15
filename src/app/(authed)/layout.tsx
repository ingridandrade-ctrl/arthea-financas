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
    <div className="flex min-h-screen bg-background text-foreground">
      <FinancasSidebar isAdmin={isAdmin} />
      <div className="flex-1 ml-64">
        {impersonating && user && (
          <ImpersonationBanner asName={user.name} asEmail={user.email} />
        )}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
