/**
 * Formatting for decimal strings from the API. Quantities and money are never
 * turned into JavaScript numbers (BR-12): grouping is done on the string.
 */
export type Lang = "vi" | "en";

const SEP: Record<Lang, { group: string; decimal: string }> = {
  vi: { group: ".", decimal: "," },
  en: { group: ",", decimal: "." },
};

/** Currencies shown with a fixed number of decimals. */
const CURRENCY_DECIMALS: Record<string, number> = { VND: 0, USD: 2, EUR: 2 };

export function formatDecimal(value: string | null | undefined, lang: Lang, minDecimals = 0): string {
  if (value === null || value === undefined || value === "") return "—";
  const negative = value.startsWith("-");
  const [intRaw, fracRaw = ""] = (negative ? value.slice(1) : value).split(".");
  const grouped = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, SEP[lang].group);
  let frac = fracRaw.replace(/0+$/, "");
  if (frac.length < minDecimals) frac = frac.padEnd(minDecimals, "0");
  return (negative ? "-" : "") + grouped + (frac ? SEP[lang].decimal + frac : "");
}

export function formatMoney(value: string | null | undefined, currency: string, lang: Lang): string {
  return `${formatDecimal(value, lang, CURRENCY_DECIMALS[currency] ?? 2)} ${currency}`;
}

/** YYYY-MM-DD → DD/MM/YYYY without Date parsing (no timezone shifts). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Today's date in the company timezone as YYYY-MM-DD, for date inputs. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

/** Compares two non-negative decimal strings exactly. */
export function compareDecimal(a: string, b: string): number {
  const [ai, af = ""] = a.split(".");
  const [bi, bf = ""] = b.split(".");
  const intA = ai.replace(/^0+(?=\d)/, "");
  const intB = bi.replace(/^0+(?=\d)/, "");
  if (intA.length !== intB.length) return intA.length < intB.length ? -1 : 1;
  if (intA !== intB) return intA < intB ? -1 : 1;
  const len = Math.max(af.length, bf.length);
  const fa = af.padEnd(len, "0");
  const fb = bf.padEnd(len, "0");
  return fa === fb ? 0 : fa < fb ? -1 : 1;
}

/** Ratio for progress bars only (display, never arithmetic on quantities). */
export function ratio(part: string, whole: string): number {
  const w = Number(whole);
  if (!w) return 0;
  return Math.max(0, Math.min(1, Number(part) / w));
}

/** Accepts what people type ("1.250,5" in vi, "1,250.5" in en) and returns an API decimal string, or null when invalid. */
export function parseDecimalInput(input: string, lang: Lang): string | null {
  const s = input.trim().replaceAll(" ", "");
  if (!s) return null;
  const { group, decimal } = SEP[lang];
  const normalized = s.split(group).join("").replace(decimal, ".");
  return /^\d{1,18}(\.\d{1,6})?$/.test(normalized) ? normalized : null;
}
