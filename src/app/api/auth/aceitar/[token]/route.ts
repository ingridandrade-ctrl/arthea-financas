import { NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/financas/session";

/**
 * GET — retorna os metadados do convite (sem revelar token)
 * POST — aceita o convite. Body: { password, name } se for usuário novo,
 *        ou { password } pra login se já existir.
 */

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const invite = await prisma.householdInvite.findUnique({
    where: { token: params.token },
    include: {
      household: { select: { partnerAName: true, partnerBName: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });
  if (!invite) {
    return NextResponse.json({ error: "Convite inválido" }, { status: 404 });
  }
  if (invite.acceptedAt) {
    return NextResponse.json({ error: "Convite já aceito" }, { status: 400 });
  }
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Convite expirado" }, { status: 400 });
  }
  const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
  return NextResponse.json({
    email: invite.email,
    ownerSlot: invite.ownerSlot,
    household: {
      partnerAName: invite.household.partnerAName,
      partnerBName: invite.household.partnerBName,
    },
    invitedBy: {
      name: invite.createdBy.name ?? invite.createdBy.email,
    },
    isExistingUser: !!existingUser,
  });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const invite = await prisma.householdInvite.findUnique({
    where: { token: params.token },
  });
  if (!invite) {
    return NextResponse.json({ error: "Convite inválido" }, { status: 404 });
  }
  if (invite.acceptedAt) {
    return NextResponse.json({ error: "Convite já aceito" }, { status: 400 });
  }
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Convite expirado" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { password, name } = body ?? {};

  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json(
      { error: "A senha precisa ter ao menos 6 caracteres" },
      { status: 400 }
    );
  }

  // Já existe esse user?
  let user = await prisma.user.findUnique({ where: { email: invite.email } });

  if (user) {
    // Login: confirma senha
    const valid = await bcryptjs.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
    }
  } else {
    // Cria usuário novo
    const hashed = await bcryptjs.hash(password, 10);
    user = await prisma.user.create({
      data: {
        email: invite.email,
        password: hashed,
        name: typeof name === "string" && name.trim() ? name.trim() : null,
      },
    });
  }

  // Cria membership se ainda não existe
  await prisma.householdMember.upsert({
    where: {
      householdId_userId: { householdId: invite.householdId, userId: user.id },
    },
    update: {},
    create: {
      householdId: invite.householdId,
      userId: user.id,
      role: "MEMBER",
      ownerSlot: invite.ownerSlot,
    },
  });

  await prisma.householdInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date(), acceptedByUserId: user.id },
  });

  await setSessionCookie({ userId: user.id, householdId: invite.householdId });
  return NextResponse.json({ ok: true });
}
