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

/** a − b for non-negative API decimals (up to 6 decimals, the database scale); never below 0. Display/remaining only. */
export function subDecimal(a: string, b: string): string {
  const scale = 1_000_000n;
  const toBig = (s: string) => {
    const [i, f = ""] = s.split(".");
    return BigInt(i) * scale + BigInt((f + "000000").slice(0, 6));
  };
  const r = toBig(a) - toBig(b);
  if (r <= 0n) return "0";
  const i = r / scale;
  const f = (r % scale).toString().padStart(6, "0").replace(/0+$/, "");
  return f ? `${i}.${f}` : `${i}`;
}

const SCALE = 6;
const toScaled = (s: string): bigint => {
  const neg = s.startsWith("-");
  const [i, f = ""] = (neg ? s.slice(1) : s).split(".");
  const v = BigInt(i || "0") * 10n ** BigInt(SCALE) + BigInt((f + "0".repeat(SCALE)).slice(0, SCALE) || "0");
  return neg ? -v : v;
};
const fromScaled = (v: bigint, decimals: number): string => {
  const neg = v < 0n;
  let a = neg ? -v : v;
  const drop = 10n ** BigInt(SCALE - decimals);
  a = (a + drop / 2n) / drop; // round half up
  const f = 10n ** BigInt(decimals);
  const frac = decimals ? (a % f).toString().padStart(decimals, "0").replace(/0+$/, "") : "";
  const out = frac ? `${a / f}.${frac}` : `${a / f}`;
  return neg && out !== "0" ? `-${out}` : out;
};

/** Exact a × b of API decimals, rounded to `decimals` (money amounts for display). */
export function mulDecimal(a: string, b: string, decimals = 2): string {
  return fromScaled((toScaled(a) * toScaled(b)) / 10n ** BigInt(SCALE), decimals);
}

/** Exact sum of API decimals. */
export function sumDecimal(values: string[], decimals = SCALE): string {
  return fromScaled(values.reduce((s, v) => s + toScaled(v), 0n), decimals);
}

/** "30" (percent) → "0.30": the fraction to multiply by, exactly. */
export function percentToFraction(p: string): string {
  const [i, f = ""] = p.split(".");
  const padded = i.padStart(3, "0");
  return `${padded.slice(0, -2).replace(/^0+(?=\d)/, "")}.${padded.slice(-2)}${f}`;
}

/** Decimals money is kept to: whole đồng for VND, cents otherwise (as the API rounds). */
export function moneyDecimals(currency: string): number {
  return CURRENCY_DECIMALS[currency] ?? 2;
}

/** pct % of total, rounded to the currency's unit: what a payment term's amount must be. */
export function percentOf(total: string, pct: string, currency: string): string {
  return mulDecimal(total, percentToFraction(pct), moneyDecimals(currency));
}

/** Whole percentages of counts that add up to exactly 100 (largest remainder); all zero when empty. */
export function wholePercents(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return counts.map(() => 0);
  const exact = counts.map((n) => (n / total) * 100);
  const out = exact.map(Math.floor);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r);
  for (let k = 0; k < 100 - out.reduce((a, b) => a + b, 0); k++) out[order[k].i]++;
  return out;
}

/** dd/mm/yyyy (or yyyy-mm-dd) typed by a person → yyyy-mm-dd, or null. */
export function parseDayInput(s: string): string | null {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}
