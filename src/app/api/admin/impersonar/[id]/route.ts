import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  requireAdmin,
  setSessionCookie,
  setImpersonationOriginCookie,
  HouseholdAuthError,
} from "@/lib/financas/session";

/**
 * POST /api/admin/impersonar/[id] — admin assume sessão do user `id`.
 * A sessão original (admin) é guardada no cookie financas_admin_session
 * pra restaurar depois.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();

    const target = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        // Mesma casa que o login abre (a mais recente), pra admin ver o que
        // a pessoa vê.
        memberships: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (!target) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    if (target.memberships.length === 0) {
      return NextResponse.json({ error: "Usuário sem casa cadastrada" }, { status: 400 });
    }

    // Salva a sessão atual (admin) pra restaurar depois
    const currentToken = cookies().get("financas_session")?.value;
    if (currentToken) {
      await setImpersonationOriginCookie(currentToken);
    }

    // Troca a sessão pelo user alvo
    await setSessionCookie({
      userId: target.id,
      householdId: target.memberships[0].householdId,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    throw e;
  }
}
