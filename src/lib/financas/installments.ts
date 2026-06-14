import { createHash } from "crypto";

export type ParsedInstallment = {
  index: number;
  total: number;
  baseDescription: string;
};

const INSTALLMENT_PATTERNS: RegExp[] = [
  /\bparc(?:ela)?\.?\s*(\d+)\s*[\/de]+\s*(\d+)\b/i,
  /\b(\d+)\s*\/\s*(\d+)\b/,
  /\b(\d+)\s+de\s+(\d+)\b/i,
];

function normalizeBase(d: string): string {
  let out = d.toLowerCase();
  for (const p of INSTALLMENT_PATTERNS) out = out.replace(p, " ");
  return out.replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

export function parseInstallment(desc: string): ParsedInstallment | null {
  if (!desc) return null;
  for (const p of INSTALLMENT_PATTERNS) {
    const m = desc.match(p);
    if (!m) continue;
    const index = parseInt(m[1], 10);
    const total = parseInt(m[2], 10);
    if (!Number.isFinite(index) || !Number.isFinite(total)) continue;
    if (total < 2 || total > 60) continue;
    if (index < 1 || index > total) continue;
    return { index, total, baseDescription: normalizeBase(desc) };
  }
  return null;
}

export function installmentGroupId(
  accountId: string,
  baseDescription: string,
  total: number,
  /** Cents (rounded). When provided, locks the group to a specific value so
   * two purchases like 'APPLE.COM 1/12' R$100 in Jan and R$250 in Jun don't
   * collide. */
  amountCents?: number
): string {
  const key =
    typeof amountCents === "number"
      ? `${accountId}|${baseDescription}|${total}|${amountCents}`
      : `${accountId}|${baseDescription}|${total}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 24);
}

export function addMonths(date: Date, n: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const daysInTarget = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
  ).getUTCDate();
  d.setUTCDate(Math.min(day, daysInTarget));
  return d;
}
