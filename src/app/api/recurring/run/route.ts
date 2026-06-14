import { NextResponse } from "next/server";
import { requireHousehold, HouseholdAuthError } from "@/lib/financas/session";
import { runRecurringForHousehold } from "@/lib/financas/recurring";

export async function POST() {
  try {
    const household = await requireHousehold();
    const result = await runRecurringForHousehold(household.id);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof HouseholdAuthError) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    throw e;
  }
}
