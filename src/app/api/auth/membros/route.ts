import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  getSessionFromCookies,
  HouseholdAuthError,
} from "@/lib/financas/session";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.memberships.length === 0) return NextResponse.json([]);
    // A casa aberta nesta sessão — quem pertence a duas via os membros da outra.
    const hid = getSessionFromCookies()?.hid;
    const householdId = (
      user.memberships.find((m) => m.householdId === hid) ?? user.memberships[0]
    ).householdId;
    const members = await prisma.householdMember.findMany({
      where: { householdId },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(members);
  } catch (e) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    throw e;
  }
}
