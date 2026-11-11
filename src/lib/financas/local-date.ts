/**
 * Datas no fuso do aparelho de quem está usando (lado do navegador).
 *
 * Não usar `new Date().toISOString().slice(0, 10)` pra "hoje": toISOString
 * converte pra UTC e, depois das 21h no Brasil, devolve o dia seguinte.
 */
const pad = (n: number) => String(n).padStart(2, "0");

/** Data local como YYYY-MM-DD. */
export function localISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Hoje, no fuso do aparelho, como YYYY-MM-DD. */
export function todayISO(): string {
  return localISODate(new Date());
}
