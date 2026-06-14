export function parseLocalDate(input: unknown): Date {
  if (input instanceof Date) return input;
  if (typeof input !== "string" || !input) return new Date();
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?Z?)?$/);
  if (m) {
    const [, y, mo, d, h, mi, s] = m;
    if (h != null) {
      return new Date(input);
    }
    return new Date(Date.UTC(parseInt(y), parseInt(mo) - 1, parseInt(d), 12, 0, 0));
  }
  return new Date(input);
}

/**
 * Parse a YYYY-MM-DD as the END of that day in UTC (23:59:59.999). Used for
 * `to`/`lte` filters so that transactions stored at noon UTC on that day still
 * fall inside the range.
 */
export function parseLocalDateEnd(input: unknown): Date {
  if (input instanceof Date) return input;
  if (typeof input !== "string" || !input) return new Date();
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return new Date(Date.UTC(parseInt(y), parseInt(mo) - 1, parseInt(d), 23, 59, 59, 999));
  }
  return new Date(input);
}

export function toISODateString(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = typeof d === "string" ? parseLocalDate(d) : d;
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
