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

// ---------------------------------------------------------------------------
// "Hoje" no horário de Brasília
//
// O servidor roda em UTC e as datas do sistema são gravadas como dia-calendário
// ao meio-dia UTC. Comparar essas datas com `new Date()` cru dá dois erros:
//  - a fatura que vence hoje aparecia "atrasada" a partir das 9h da manhã
//    (meio-dia UTC já passou);
//  - depois das 21h no Brasil o UTC já está no dia seguinte, então contas de
//    hoje viravam "atrasadas" e um pagamento feito à noite era gravado com a
//    data de amanhã.
// Brasília está em UTC-3 fixo (sem horário de verão desde 2019).
// ---------------------------------------------------------------------------
const BR_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Ano, mês (0-11) e dia de "agora" no horário de Brasília. */
export function nowPartsBR(): { year: number; month: number; day: number } {
  const br = new Date(Date.now() - BR_OFFSET_MS);
  return { year: br.getUTCFullYear(), month: br.getUTCMonth(), day: br.getUTCDate() };
}

/** Hoje (Brasília) no mesmo formato das datas gravadas: meio-dia UTC. */
export function todayBR(): Date {
  const { year, month, day } = nowPartsBR();
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
}

/**
 * Começo de hoje (Brasília), 00:00 UTC. `data < startOfTodayBR()` quer dizer
 * "antes de hoje": o que vence hoje ainda não está atrasado.
 */
export function startOfTodayBR(): Date {
  const { year, month, day } = nowPartsBR();
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

/** Fim de hoje (Brasília), 23:59:59.999 UTC. */
export function endOfTodayBR(): Date {
  const { year, month, day } = nowPartsBR();
  return new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
}

/** Hoje (Brasília) como YYYY-MM-DD. */
export function todayBRString(): string {
  return toISODateString(todayBR())!;
}
