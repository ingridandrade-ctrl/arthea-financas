import { prisma } from "@/lib/prisma";

function clampDay(year: number, month: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const d = Math.min(Math.max(day, 1), lastDay);
  return new Date(Date.UTC(year, month, d, 12, 0, 0, 0));
}

export function invoicePeriodForDate(
  date: Date,
  closingDay: number,
  dueDay?: number
): { year: number; month: number } {
  const d = new Date(date);
  const day = d.getUTCDate();
  let year = d.getUTCFullYear();
  let month = d.getUTCMonth();

  // Find the month/year of the closing that comes ON or AFTER this purchase.
  // If purchase happened AFTER the closing day, current month's closing
  // already passed — bump to next month's closing.
  if (day > closingDay) {
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  // When closing and due are in the SAME month (dueDay > closingDay), the
  // invoice's labelled month is the closing month. Otherwise (typical bank,
  // dueDay <= closingDay), due is the NEXT month after closing.
  const sameMonth = typeof dueDay === "number" && dueDay > closingDay;
  if (!sameMonth) {
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }
  return { year, month };
}

export function computeInvoiceDates(
  year: number,
  month: number,
  closingDay: number,
  dueDay: number
): { closingDate: Date; dueDate: Date } {
  const sameMonth = dueDay > closingDay;
  let closingDate: Date;
  if (sameMonth) {
    // Closing and due both in (year, month). e.g. closes Apr 1, due Apr 9.
    closingDate = clampDay(year, month, closingDay);
  } else {
    // Typical bank: closes previous month, due current month.
    const prevMonth = month - 1;
    const prevYear = prevMonth < 0 ? year - 1 : year;
    closingDate = clampDay(prevYear, (prevMonth + 12) % 12, closingDay);
  }
  const dueDate = clampDay(year, month, dueDay);
  return { closingDate, dueDate };
}

export async function ensureInvoice(
  householdId: string,
  card: { id: string; closingDay: number | null; dueDay: number | null },
  date: Date
) {
  if (!card.closingDay || !card.dueDay) return null;
  const { year, month } = invoicePeriodForDate(date, card.closingDay, card.dueDay);
  return upsertInvoice(householdId, card.id, year, month, card.closingDay, card.dueDay);
}

export async function ensureInvoiceForMonth(
  householdId: string,
  card: { id: string; closingDay: number | null; dueDay: number | null },
  year: number,
  month: number
) {
  if (!card.closingDay || !card.dueDay) return null;
  return upsertInvoice(householdId, card.id, year, month, card.closingDay, card.dueDay);
}

async function upsertInvoice(
  householdId: string,
  accountId: string,
  year: number,
  month: number,
  closingDay: number,
  dueDay: number
) {
  const { closingDate, dueDate } = computeInvoiceDates(year, month, closingDay, dueDay);
  const existing = await prisma.finCreditCardInvoice.findUnique({
    where: { accountId_year_month: { accountId, year, month } },
  });
  if (existing) {
    if (
      existing.closingDate.getTime() !== closingDate.getTime() ||
      existing.dueDate.getTime() !== dueDate.getTime()
    ) {
      return prisma.finCreditCardInvoice.update({
        where: { id: existing.id },
        data: { closingDate, dueDate },
      });
    }
    return existing;
  }
  return prisma.finCreditCardInvoice.create({
    data: {
      householdId,
      accountId,
      year,
      month,
      closingDate,
      dueDate,
      status: "OPEN",
    },
  });
}
