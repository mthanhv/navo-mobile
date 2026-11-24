import type { TFunction } from "i18next";
import { compareDecimal, formatDate, formatDecimal, type Lang } from "./format";
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

/** Tình trạng cell (mockup S-03/S-04): the most important flag as a word, and why, in one short line. */
export type StatusTone = "red" | "amber" | "gray" | "ok" | "done";

export function lineStatus(t: TFunction, lang: Lang, row: LineRow): { tone: StatusTone; label: string; why: string } {
  const flag = row.flags[0];
  const n = (v?: string) => formatDecimal(v ?? "0", lang);
  if (!flag) {
    const ready = row.next_delivery && compareDecimal(row.available, row.next_delivery.quantity) >= 0;
    return { tone: "ok", label: t("flags.on_track"), why: ready ? t("why.ready") : "" };
  }
  const p = flag.params ?? {};
  const tone: StatusTone = flag.severity === "critical" ? "red" : flag.severity === "warning" ? "amber" : flag.severity === "info" ? "gray" : "done";
  const vars = { unit: row.unit, days: p.days_late, due: formatDate(p.due_on), needed: n(p.needed), available: n(p.available ?? row.available), missing: n(p.missing), over: n(p.over) };
  const key = flag.code === "delivery_overdue" && !p.days_late ? "why.delivery_overdue_plan" : `why.${flag.code}`;
  return { tone, label: t(`flags.${flag.code}`), why: t(key, vars) };
}

/** Cần chú ý cell of the contract list: one detailed reason, or "N việc · reason". */
export function contractAttentionText(t: TFunction, lang: Lang, a: { count: number; flag: Flag | null; unit?: string } | undefined): { tone: StatusTone; text: string } {
  const flag = a?.flag;
  if (!flag) return { tone: "ok", text: t("flags.on_track") };
  const tone: StatusTone = flag.severity === "critical" ? "red" : flag.severity === "warning" ? "amber" : flag.severity === "info" ? "gray" : "done";
  const p = flag.params ?? {};
  const one = t(flag.code === "delivery_overdue" && !p.days_late ? "attnShort.delivery_overdue_plan" : `attnShort.${flag.code}`, {
    days: p.days_late, over: formatDecimal(p.over ?? "0", lang), unit: a?.unit ?? "", date: formatDate(p.planned_on).slice(0, 5),
  });
  return { tone, text: a && a.count > 1 ? t("contracts.manyActions", { count: a.count, reason: t(`flags.${flag.code}`).toLowerCase() }) : one };
}
