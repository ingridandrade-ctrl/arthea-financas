import { redirect } from "next/navigation";
import {
  getSessionFromCookies,
  householdExists,
} from "@/lib/financas/session";
import { SetupForm } from "./setup-form";

export default async function FinancasSetupPage() {
  const session = getSessionFromCookies();
  if (session) redirect("/dashboard");
  const exists = await householdExists();
  if (exists) redirect("/login");
  return <SetupForm />;
}
