import { NextResponse } from "next/server";
import { HouseholdAuthError, requireHousehold } from "./session";

export async function withHousehold<T>(
  handler: (household: { id: string; partnerAName: string; partnerBName: string; currency: string }) => Promise<T>
): Promise<T | NextResponse> {
  try {
    const household = await requireHousehold();
    return handler(household);
  } catch (err) {
    if (err instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 }) as any;
    }
    throw err;
  }
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Não encontrado") {
  return NextResponse.json({ error: message }, { status: 404 });
}
