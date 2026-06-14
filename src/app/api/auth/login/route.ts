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

  const normalized = email.toLowerCase().trim();

  // Try User first (new auth flow)
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    include: {
      memberships: {
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  if (user) {
    const valid = await bcryptjs.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "E-mail ou senha incorretos" }, { status: 401 });
    }
    if (user.memberships.length === 0) {
      return NextResponse.json(
        { error: "Sua conta não tem casa cadastrada. Crie ou aceite um convite." },
        { status: 403 }
      );
    }
    await setSessionCookie({ userId: user.id, householdId: user.memberships[0].householdId });
    return NextResponse.json({ ok: true });
  }

  // Fallback to legacy Household auth (pre-User migration)
  // On successful legacy login, auto-backfill: create User + OWNER membership.
  const household = await prisma.household.findUnique({ where: { email: normalized } });
  if (!household) {
    return NextResponse.json({ error: "E-mail ou senha incorretos" }, { status: 401 });
  }
  const validLegacy = await bcryptjs.compare(password, household.password);
  if (!validLegacy) {
    return NextResponse.json({ error: "E-mail ou senha incorretos" }, { status: 401 });
  }

  const backfilled = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: household.email,
        password: household.password, // already hashed
      },
    });
    await tx.householdMember.create({
      data: {
        householdId: household.id,
        userId: created.id,
        role: "OWNER",
        ownerSlot: "PARTNER_A",
      },
    });
    return created;
  });

  await setSessionCookie({ userId: backfilled.id, householdId: household.id });
  return NextResponse.json({ ok: true });
}
