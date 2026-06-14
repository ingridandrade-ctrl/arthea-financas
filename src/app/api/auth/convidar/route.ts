import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser, HouseholdAuthError } from "@/lib/financas/session";

/**
 * Cria um convite pra alguém entrar no Household atual como membro.
 * Quem chama precisa estar logado e ser OWNER do household ativo.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const { email, ownerSlot } = body ?? {};

    if (typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
    }
    const normalized = email.toLowerCase().trim();

    // Identifica household ativo a partir do userId
    if (user.memberships.length === 0) {
      return NextResponse.json({ error: "Você não tem casa ativa" }, { status: 400 });
    }
    const membership = user.memberships[0];
    if (membership.role !== "OWNER") {
      return NextResponse.json(
        { error: "Só o dono da casa pode convidar membros" },
        { status: 403 }
      );
    }

    // Não pode convidar você mesma
    if (normalized === user.email) {
      return NextResponse.json({ error: "Você já está nessa casa" }, { status: 400 });
    }

    // Já existe convite ativo pra esse email nesse household?
    const existing = await prisma.householdInvite.findFirst({
      where: {
        householdId: membership.householdId,
        email: normalized,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (existing) {
      return NextResponse.json({
        token: existing.token,
        reused: true,
        url: buildInviteUrl(existing.token, req),
      });
    }

    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 dias

    const invite = await prisma.householdInvite.create({
      data: {
        householdId: membership.householdId,
        email: normalized,
        token,
        ownerSlot:
          ownerSlot === "PARTNER_A" || ownerSlot === "PARTNER_B" ? ownerSlot : "PARTNER_B",
        expiresAt,
        createdById: user.id,
      },
    });

    return NextResponse.json({
      token: invite.token,
      reused: false,
      url: buildInviteUrl(invite.token, req),
    });
  } catch (e) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    console.error("[convidar]", e);
    return NextResponse.json({ error: "Erro ao convidar" }, { status: 500 });
  }
}

function buildInviteUrl(token: string, req: Request): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}/aceitar/${token}`;
}
