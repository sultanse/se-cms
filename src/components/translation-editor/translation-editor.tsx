import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import OverviewSection from "@/components/translation-editor/overview-section"
import TranslationsSearch from "@/components/translation-editor/translations-search"
import { cn } from "@/lib/utils"
import {
  type EntryValues,
  type LocaleName,
  type TranslationEntry,
} from "@/stores/translation-editor-store"

type TranslationEditorRow = {
  entry: TranslationEntry
  values: EntryValues
  edited: boolean
}

type TranslationEditorProps = {
  rows: TranslationEditorRow[]
  direction: "ltr" | "rtl"
  overview: {
    textValues: number
    sectionsCount: number
    visibleResults: number
    unsavedValues: number
  }
  activeSection: string | null
  query: string
  onQueryChange: (query: string) => void
  onEntryChange: (
    entry: TranslationEntry,
    localeName: LocaleName,
    value: string
  ) => void
  onRevertEntry: (key: string) => void
}

function TranslationEditor({
  rows,
  direction,
  overview,
  activeSection,
  query,
  onQueryChange,
  onEntryChange,
  onRevertEntry,
}: TranslationEditorProps) {
  const { t } = useTranslation()

  return (
    <>
      <OverviewSection {...overview} />
      <section id="translations-section" className="rounded-2xl border bg-card">
        <TranslationsSearch
          visibleCount={rows.length}
          activeSection={activeSection}
          query={query}
          onQueryChange={onQueryChange}
        />

        <div id="translations-editor" className="flex flex-col">
          {rows.map(({ entry, values, edited }) => (
            <div
              key={entry.key}
              className={cn(
                "flex flex-col gap-3.5 border-b px-6 py-5",
                edited && "bg-muted"
              )}
            >
              <div
                dir="ltr"
                className="flex items-center justify-between gap-3"
              >
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {entry.path.map((segment, index) => {
                    const last = index === entry.path.length - 1
                    return (
                      <span key={index} className="flex items-center gap-1.5">
                        <span
                          className={
                            last ? "text-foreground" : "text-muted-foreground"
                          }
                        >
                          {segment}
                        </span>
                        {!last && <span className="text-border">/</span>}
                      </span>
                    )
                  })}
                </div>
                {edited && (
                  <div className="flex items-center gap-2" dir={direction}>
                    <Badge variant="outline">
                      {t("translationEditor.edited")}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRevertEntry(entry.key)}
                    >
                      {t("translationEditor.revert")}
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground sm:hidden">
                    {t("translationEditor.arabicValue")}
                  </span>
                  <Textarea
                    dir="rtl"
                    rows={1}
                    value={values.ar}
                    onChange={(event) =>
                      onEntryChange(entry, "ar", event.target.value)
                    }
                    aria-label={t("translationEditor.editArabicEntry", {
                      path: entry.key,
                    })}
                    className="min-h-9 leading-relaxed"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground sm:hidden">
                    {t("translationEditor.englishValue")}
                  </span>
                  <Textarea
                    dir="ltr"
                    rows={1}
                    value={values.en}
                    onChange={(event) =>
                      onEntryChange(entry, "en", event.target.value)
                    }
                    aria-label={t("translationEditor.editEnglishEntry", {
                      path: entry.key,
                    })}
                    className="min-h-9 leading-relaxed"
                  />
                </label>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 px-6 py-14 text-center">
              <span className="text-sm font-medium">
                {t("translationEditor.noResults")}
              </span>
              <span className="text-[13px] text-muted-foreground">
                {t("translationEditor.noResultsDescription")}
              </span>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export default TranslationEditor
