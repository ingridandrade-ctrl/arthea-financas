import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/financas/session";
import { FinancasSidebar } from "@/components/financas/sidebar";

export default async function FinancasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = getSessionFromCookies();

  if (!session) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <FinancasSidebar />
      <div className="flex-1 ml-64">
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
