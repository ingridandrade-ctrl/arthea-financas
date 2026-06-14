import { NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { householdExists, setSessionCookie } from "@/lib/financas/session";
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES } from "@/lib/financas/defaults";

export async function GET() {
  return NextResponse.json({ needsSetup: !(await householdExists()) });
}

export async function POST(req: Request) {
  if (await householdExists()) {
    return NextResponse.json(
      { error: "Configuração já realizada. Faça login." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { email, password, partnerAName, partnerBName, currency } = body ?? {};

  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json(
      { error: "A senha deve ter ao menos 6 caracteres" },
      { status: 400 }
    );
  }

  const hashed = await bcryptjs.hash(password, 10);

  const household = await prisma.household.create({
    data: {
      email: email.toLowerCase().trim(),
      password: hashed,
      partnerAName: typeof partnerAName === "string" && partnerAName.trim()
        ? partnerAName.trim()
        : "Pessoa A",
      partnerBName: typeof partnerBName === "string" && partnerBName.trim()
        ? partnerBName.trim()
        : "Pessoa B",
      currency: typeof currency === "string" && currency.trim() ? currency.trim() : "BRL",
      accounts: { create: DEFAULT_ACCOUNTS },
      categories: { create: DEFAULT_CATEGORIES },
    },
  });

  await setSessionCookie(household.id);
  return NextResponse.json({ ok: true });
}
