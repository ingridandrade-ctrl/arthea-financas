import { redirect } from "next/navigation";
import {
  getSessionFromCookies,
  householdExists,
} from "@/lib/financas/session";
import { LoginForm } from "./login-form";

export default async function FinancasLoginPage() {
  const session = getSessionFromCookies();
  if (session) redirect("/dashboard");
  const exists = await householdExists();
  if (!exists) redirect("/setup");
  return <LoginForm />;
}
