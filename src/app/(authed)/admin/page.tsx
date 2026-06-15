import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/financas/session";
import { AdminClient } from "./admin-client";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    redirect("/dashboard");
  }
  return <AdminClient />;
}
