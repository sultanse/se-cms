import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import ar from "./ar.json"
import en from "./en.json"

export const supportedLanguages = ["ar", "en"] as const
export type SupportedLanguage = (typeof supportedLanguages)[number]

const initialLanguage: SupportedLanguage = (() => {
  const storedLanguage = localStorage.getItem("language")
  if (storedLanguage === "ar" || storedLanguage === "en") {
    return storedLanguage
  }

  return navigator.language.toLowerCase().startsWith("ar") ? "ar" : "en"
})()

export const languageDirection: Record<SupportedLanguage, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
}

void i18n.use(initReactI18next).init({
  lng: initialLanguage,
  fallbackLng: "en",
  supportedLngs: supportedLanguages,
  interpolation: {
    escapeValue: false,
  },
  resources: {
    ar: { translation: ar },
    en: { translation: en },
  },
})

export default i18n
