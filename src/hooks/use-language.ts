import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  languageDirection,
  type SupportedLanguage,
} from "@/i18n/i18n"

function normalizeLanguage(language: string): SupportedLanguage {
  return language === "ar" ? "ar" : "en"
}

export function useLanguage() {
  const { i18n } = useTranslation()
  const [language, setLanguage] = useState<SupportedLanguage>(() =>
    normalizeLanguage(i18n.language)
  )

  useEffect(() => {
    const handleLanguageChanged = (nextLanguage: string) => {
      setLanguage(normalizeLanguage(nextLanguage))
    }

    i18n.on("languageChanged", handleLanguageChanged)

    return () => {
      i18n.off("languageChanged", handleLanguageChanged)
    }
  }, [i18n])

  const changeLanguage = useCallback(
    (nextLanguage: SupportedLanguage) => {
      void i18n.changeLanguage(nextLanguage)
    },
    [i18n]
  )

  return {
    language,
    direction: languageDirection[language],
    changeLanguage,
  }
}
