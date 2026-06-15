import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, HouseholdAuthError } from "@/lib/financas/session";

export async function GET() {
  try {
    await requireAdmin();

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalHouseholds,
      totalTransactions,
      totalAccounts,
      totalInvoices,
      newUsers7d,
      newUsers30d,
      activeUsers7d,
      activeUsers30d,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.household.count(),
      prisma.finTransaction.count(),
      prisma.finAccount.count(),
      prisma.finCreditCardInvoice.count(),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({ where: { lastLoginAt: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { lastLoginAt: { gte: thirtyDaysAgo } } }),
    ]);

    // Signups por dia, últimos 30 dias
    const recentUsers = await prisma.user.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    });
    const dailySignups: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const k = d.toISOString().slice(0, 10);
      dailySignups[k] = 0;
    }
    for (const u of recentUsers) {
      const k = u.createdAt.toISOString().slice(0, 10);
      if (k in dailySignups) dailySignups[k]++;
    }

    return NextResponse.json({
      counts: {
        users: totalUsers,
        households: totalHouseholds,
        transactions: totalTransactions,
        accounts: totalAccounts,
        invoices: totalInvoices,
      },
      growth: {
        newUsers7d,
        newUsers30d,
        activeUsers7d,
        activeUsers30d,
      },
      dailySignups: Object.entries(dailySignups).map(([day, count]) => ({ day, count })),
    });
  } catch (e) {
    if (e instanceof HouseholdAuthError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    throw e;
  }
}
