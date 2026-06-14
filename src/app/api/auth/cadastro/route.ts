import { NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/financas/session";
import { ensureFinanceSchema } from "@/lib/financas/migrate";
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES } from "@/lib/financas/defaults";

/**
 * Cadastro de um novo usuário no Arthea Finanças.
 *
 * - Cria User com email + senha
 * - Cria Household novo associado a esse User como OWNER
 * - Seed de contas e categorias padrão no Household
 * - Loga automaticamente
 */
export async function POST(req: Request) {
  await ensureFinanceSchema();
  const body = await req.json().catch(() => ({}));
  const { email, password, name, partnerAName, partnerBName, ownerSlot } = body ?? {};

  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json(
      { error: "A senha precisa ter ao menos 6 caracteres" },
      { status: 400 }
    );
  }

  const normalized = email.toLowerCase().trim();

  const existingUser = await prisma.user.findUnique({ where: { email: normalized } });
  if (existingUser) {
    return NextResponse.json(
      { error: "Já existe uma conta com esse e-mail. Faça login." },
      { status: 400 }
    );
  }

  // Verifica conflito com Household legacy (pré-User migration)
  const legacyHousehold = await prisma.household.findUnique({ where: { email: normalized } });
  if (legacyHousehold) {
    return NextResponse.json(
      { error: "Já existe uma conta com esse e-mail. Faça login." },
      { status: 400 }
    );
  }

  const hashed = await bcryptjs.hash(password, 10);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalized,
        password: hashed,
        name: typeof name === "string" && name.trim() ? name.trim() : null,
      },
    });

    const household = await tx.household.create({
      data: {
        email: normalized, // legacy compat — Household ainda precisa de email único
        password: hashed,
        partnerAName: typeof partnerAName === "string" && partnerAName.trim()
          ? partnerAName.trim()
          : "Pessoa A",
        partnerBName: typeof partnerBName === "string" && partnerBName.trim()
          ? partnerBName.trim()
          : "Pessoa B",
        currency: "BRL",
        accounts: { create: DEFAULT_ACCOUNTS },
        categories: { create: DEFAULT_CATEGORIES },
      },
    });

    await tx.householdMember.create({
      data: {
        householdId: household.id,
        userId: user.id,
        role: "OWNER",
        ownerSlot:
          ownerSlot === "PARTNER_A" || ownerSlot === "PARTNER_B" ? ownerSlot : "PARTNER_A",
      },
    });

    return { user, household };
  });

  await setSessionCookie({ userId: result.user.id, householdId: result.household.id });
  return NextResponse.json({ ok: true });
}
