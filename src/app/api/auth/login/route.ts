import { NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/financas/session";
import { ensureFinanceSchema } from "@/lib/financas/migrate";

export async function POST(req: Request) {
  await ensureFinanceSchema();
  const body = await req.json().catch(() => ({}));
  const { email, password } = body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Credenciais inválidas" }, { status: 400 });
  }

  const household = await prisma.household.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!household) {
    return NextResponse.json({ error: "E-mail ou senha incorretos" }, { status: 401 });
  }

  const valid = await bcryptjs.compare(password, household.password);
  if (!valid) {
    return NextResponse.json({ error: "E-mail ou senha incorretos" }, { status: 401 });
  }

  await setSessionCookie(household.id);
  return NextResponse.json({ ok: true });
}
