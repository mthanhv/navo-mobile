import type { TFunction } from "i18next";
import { ApiError } from "./api";

/** Same wording rules as the web app: business reason, then error code, then generic. */
export function errorMessage(t: TFunction, err: unknown): string {
  if (!(err instanceof ApiError)) return t("errors.generic");
  if (err.code.startsWith("network.")) return t(`errors.${err.code}`);
  if (err.reason && t(`errors.reasons.${err.reason}`, { defaultValue: "" })) return t(`errors.reasons.${err.reason}`, err.params ?? {});
  const text = t(`errors.codes.${err.code.replaceAll(".", "_")}`, { defaultValue: "" }) || t("errors.generic");
  return err.status >= 500 ? `${text} ${t("errors.reference", { id: err.requestId })}` : text;
}
