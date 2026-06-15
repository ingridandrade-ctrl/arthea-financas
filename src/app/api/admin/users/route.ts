import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, HouseholdAuthError } from "@/lib/financas/session";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim().toLowerCase() || "";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 500);

    const where: any = {};
    if (q) {
      where.OR = [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        createdAt: true,
        lastLoginAt: true,
        memberships: {
          select: {
            role: true,
            ownerSlot: true,
            household: {
              select: {
                id: true,
                partnerAName: true,
                partnerBName: true,
                _count: {
                  select: { transactions: true, accounts: true, invoices: true },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(users);
  } catch (e) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    throw e;
  }
}
