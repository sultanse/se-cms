import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import i18n, { languageDirection, type SupportedLanguage } from "@/i18n/i18n"

export function App() {
  const { t } = useTranslation()
  const language = i18n.language as SupportedLanguage

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = languageDirection[language]
    localStorage.setItem("language", language)
  }, [language])

  const changeLanguage = (nextLanguage: SupportedLanguage) => {
    void i18n.changeLanguage(nextLanguage)
  }

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,var(--color-muted),transparent_42%)] px-5 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-16">
        <header className="flex items-center justify-between gap-6 border-b border-border/70 pb-5">
          <a className="text-lg font-semibold tracking-tight" href="#top">
            {t("brand")}
          </a>
          <nav className="flex items-center gap-4" aria-label={t("home")}>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {t("home")}
            </span>
            <div
              className="flex gap-1 rounded-full border border-border bg-background/70 p-1"
              role="group"
              aria-label={t("language")}
            >
              <Button
                variant={language === "ar" ? "default" : "outline"}
                size="sm"
                aria-pressed={language === "ar"}
                onClick={() => changeLanguage("ar")}
                className="rounded-full"
              >
                {t("arabic")}
              </Button>
              <Button
                variant={language === "en" ? "default" : "outline"}
                size="sm"
                aria-pressed={language === "en"}
                onClick={() => changeLanguage("en")}
                className="rounded-full"
              >
                {t("english")}
              </Button>
            </div>
          </nav>
        </header>

        <section
          id="top"
          className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end"
        >
          <div className="max-w-3xl space-y-6">
            <h1 className="max-w-2xl text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl">
              {t("title")}
            </h1>
            <p className="max-w-xl text-base leading-8 text-muted-foreground sm:text-lg">
              {t("description")}
            </p>
            <Button size="lg" className="rounded-full px-6">
              {t("action")}
            </Button>
          </div>
          <div className="hidden min-h-56 overflow-hidden rounded-[2rem] bg-primary p-8 text-primary-foreground lg:flex lg:items-end">
            <p className="max-w-xs text-2xl leading-tight font-medium">
              {t("direction")}
            </p>
          </div>
        </section>

        <section className="space-y-6 pb-8" aria-labelledby="content-examples">
          <div className="flex items-end justify-between gap-4 border-b border-border/70 pb-4">
            <h2
              id="content-examples"
              className="text-xl font-semibold tracking-tight"
            >
              {t("cardsLabel")}
            </h2>
            <span className="text-xs text-muted-foreground">{t("language")}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <article className="flex min-h-64 flex-col justify-between rounded-3xl border border-border bg-card p-6 transition-colors hover:bg-muted/60">
              <div className="space-y-8">
                <span className="text-xs font-medium text-muted-foreground">
                  01 / {t("cardOneCategory")}
                </span>
                <h3 className="text-2xl leading-tight font-semibold">
                  {t("cardOneTitle")}
                </h3>
              </div>
              <p className="pt-8 text-sm leading-7 text-muted-foreground">
                {t("cardOneDescription")}
              </p>
            </article>
            <article className="flex min-h-64 flex-col justify-between rounded-3xl bg-primary p-6 text-primary-foreground transition-transform hover:-translate-y-1">
              <div className="space-y-8">
                <span className="text-xs font-medium opacity-70">
                  02 / {t("cardTwoCategory")}
                </span>
                <h3 className="text-2xl leading-tight font-semibold">
                  {t("cardTwoTitle")}
                </h3>
              </div>
              <p className="pt-8 text-sm leading-7 opacity-80">
                {t("cardTwoDescription")}
              </p>
            </article>
            <article className="flex min-h-64 flex-col justify-between rounded-3xl border border-border bg-card p-6 transition-colors hover:bg-muted/60">
              <div className="space-y-8">
                <span className="text-xs font-medium text-muted-foreground">
                  03 / {t("cardThreeCategory")}
                </span>
                <h3 className="text-2xl leading-tight font-semibold">
                  {t("cardThreeTitle")}
                </h3>
              </div>
              <p className="pt-8 text-sm leading-7 text-muted-foreground">
                {t("cardThreeDescription")}
              </p>
            </article>
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
