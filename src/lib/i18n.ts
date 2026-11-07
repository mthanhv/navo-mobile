import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import { getLocales } from "expo-localization";
import vi from "../locales/vi.json";
import en from "../locales/en.json";
import type { Lang } from "./format";

// i18n.use is i18next's documented plugin API; the rule confuses it with the named export `use`.
// eslint-disable-next-line import/no-named-as-default-member
void i18n.use(initReactI18next).init({
  resources: { vi: { translation: vi }, en: { translation: en } },
  lng: getLocales()[0]?.languageCode === "en" ? "en" : "vi",
  fallbackLng: "vi",
  interpolation: { escapeValue: false },
});

export function useT() {
  const { t, i18n: inst } = useTranslation();
  return { t, lang: (inst.language === "en" ? "en" : "vi") as Lang, setLang: (l: Lang) => void inst.changeLanguage(l) };
}

export default i18n;
