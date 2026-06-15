import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getImpersonationOriginToken,
  clearImpersonationOriginCookie,
} from "@/lib/financas/session";

/**
 * POST /api/admin/impersonar/sair — restaura a sessão admin original.
 */
export async function POST() {
  const original = getImpersonationOriginToken();
  if (!original) {
    return NextResponse.json({ error: "Sem sessão admin pra restaurar" }, { status: 400 });
  }

  // Restaura cookie de sessão pra o token original do admin
  cookies().set("financas_session", original, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  await clearImpersonationOriginCookie();
  return NextResponse.json({ ok: true });
}
