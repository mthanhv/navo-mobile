import type { TFunction } from "i18next";
import { formatDate, formatDecimal, type Lang } from "./format";
import type { Flag, LineRow } from "./types";

/** One plain sentence describing a line's most important flag (REQUIREMENTS 5.8.2 "next action"). */
export function nextActionText(t: TFunction, lang: Lang, row: LineRow, flag: Flag | undefined): string {
  if (!flag) return row.name_on_contract;
  const p = flag.params ?? {};
  const n = (v?: string) => formatDecimal(v ?? "0", lang);
  return t(`next.${flag.code}`, {
    defaultValue: `${row.name_on_contract}: ${t(`flags.${flag.code}`)}`,
    line: row.line_no,
    name: row.name_on_contract,
    unit: row.unit,
    remaining: n(p.remaining ?? row.remaining),
    available: n(p.available ?? row.available),
    needed: n(p.needed),
    missing: n(p.missing),
    over: n(p.over),
    date: formatDate(p.planned_on),
  });
}
