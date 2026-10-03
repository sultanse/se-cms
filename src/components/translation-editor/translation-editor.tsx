import { SearchIcon, Undo2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  type EntryValues,
  type LocaleName,
  type TranslationEntry,
} from "@/stores/translation-editor-store"

export type TranslationEditorRow = {
  entry: TranslationEntry
  values: EntryValues
  edited: boolean
}

export type EditFilter = "all" | "edited"

type TranslationEditorProps = {
  rows: TranslationEditorRow[]
  title: string
  // Path segments shared by every row (the active section), hidden from keys.
  keyPrefixLength: number
  valuesCount: number
  editedCount: number
  filter: EditFilter
  onFilterChange: (filter: EditFilter) => void
  query: string
  onQueryChange: (query: string) => void
  onEntryChange: (
    entry: TranslationEntry,
    localeName: LocaleName,
    value: string
  ) => void
  onRevertEntry: (key: string) => void
  disabled?: boolean
}

// The editor's fields use the design's neutral border, shadow and focus ring
// rather than the app-wide indigo ring.
const fieldClassName =
  "border-field shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] focus-visible:border-field-ring focus-visible:ring-field-ring/50"

// Below the container breakpoint a row stacks: key and revert on top, then
// one value per line. The key column scales with the card's width.
const rowGrid =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 @xl:grid-cols-[clamp(8rem,24cqi,12rem)_minmax(0,1fr)_minmax(0,1fr)_1.75rem]"

function TranslationEditor({
  rows,
  title,
  keyPrefixLength,
  valuesCount,
  editedCount,
  filter,
  onFilterChange,
  query,
  onQueryChange,
  onEntryChange,
  onRevertEntry,
  disabled = false,
}: TranslationEditorProps) {
  const { t } = useTranslation()

  const filters: { id: EditFilter; label: string }[] = [
    { id: "all", label: t("translationEditor.allFilter") },
    {
      id: "edited",
      label: t("translationEditor.editedFilter", { count: editedCount }),
    },
  ]

  return (
    <section
      id="translations-section"
      className="@container min-w-0 rounded-2xl border bg-card"
    >
      <div className="rounded-t-2xl bg-card md:sticky md:top-15 md:z-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 dir="auto" className="truncate text-base font-semibold">
              {title}
            </h2>
            <span className="text-[13px] text-muted-foreground">
              {editedCount > 0
                ? t("translationEditor.valuesSummaryEdited", {
                    values: valuesCount,
                    count: editedCount,
                  })
                : t("translationEditor.valuesSummary", { count: valuesCount })}
            </span>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 @2xl:w-auto">
            <div
              role="group"
              aria-label={t("translationEditor.filterLabel")}
              className="flex gap-0.5 rounded-lg bg-muted p-0.75"
            >
              {filters.map(({ id, label }) => (
                <Button
                  key={id}
                  variant={filter === id ? "outline" : "ghost"}
                  size="xs"
                  aria-pressed={filter === id}
                  onClick={() => onFilterChange(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="relative min-w-48 flex-1 @2xl:w-70 @2xl:flex-none">
              <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") onQueryChange("")
                }}
                placeholder={t("translationEditor.searchPlaceholder")}
                aria-label={t("translationEditor.searchLabel")}
                className={cn(fieldClassName, "h-9 ps-9")}
              />
            </div>
          </div>
        </div>
        <div
          aria-hidden="true"
          className={cn(
            rowGrid,
            "hidden border-y bg-muted px-5 py-4 text-sm font-bold text-muted-foreground @xl:grid"
          )}
        >
          <span>{t("translationEditor.keyColumn")}</span>
          <span>{t("translationEditor.arabicValue")}</span>
          <span>{t("translationEditor.englishValue")}</span>
        </div>
      </div>

      <div
        id="translations-editor"
        className="flex flex-col border-t @xl:border-t-0"
      >
        {rows.map(({ entry, values, edited }) => {
          const keyPath = entry.path.slice(keyPrefixLength)
          const arChanged = values.ar !== entry.ar
          const enChanged = values.en !== entry.en
          return (
            <div
              key={entry.key}
              className={cn(
                rowGrid,
                "items-start gap-y-2 border-b border-divider px-5 py-3 last:rounded-b-2xl last:border-b-0",
                edited && "bg-muted"
              )}
            >
              <div className="flex min-w-0 flex-col items-start gap-1.5 @xl:pt-1.75">
                <span dir="ltr" className="text-xs [overflow-wrap:anywhere]">
                  {keyPath.length > 1 && (
                    <span className="text-muted-foreground">
                      {keyPath.slice(0, -1).join(".")}.
                    </span>
                  )}
                  {keyPath[keyPath.length - 1]}
                </span>
                {edited && (
                  <Badge variant="outline">
                    {t("translationEditor.edited")}
                  </Badge>
                )}
              </div>

              <div className="col-start-2 row-start-1 @xl:col-start-4 @xl:pt-1.5">
                {edited && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={disabled}
                    onClick={() => onRevertEntry(entry.key)}
                    aria-label={t("translationEditor.revertEntry", {
                      path: entry.key,
                    })}
                    title={t("translationEditor.revert")}
                  >
                    <Undo2Icon className="rtl:-scale-x-100" />
                  </Button>
                )}
              </div>

              <label className="col-span-2 flex flex-col gap-1 @xl:col-span-1 @xl:col-start-2 @xl:row-start-1">
                <span className="text-xs font-medium text-muted-foreground @xl:hidden">
                  {t("translationEditor.arabicValue")}
                </span>
                <Textarea
                  dir="rtl"
                  rows={1}
                  disabled={disabled}
                  value={values.ar}
                  onChange={(event) =>
                    onEntryChange(entry, "ar", event.target.value)
                  }
                  aria-label={t("translationEditor.editArabicEntry", {
                    path: entry.key,
                  })}
                  className={cn(fieldClassName, "min-h-9 leading-relaxed")}
                />
                {arChanged && (
                  <span className="text-[11px] text-muted-foreground">
                    {t("translationEditor.was")}{" "}
                    <span dir="rtl" className="line-through">
                      {entry.ar}
                    </span>
                  </span>
                )}
              </label>

              <label className="col-span-2 flex flex-col gap-1 @xl:col-span-1 @xl:col-start-3 @xl:row-start-1">
                <span className="text-xs font-medium text-muted-foreground @xl:hidden">
                  {t("translationEditor.englishValue")}
                </span>
                <Textarea
                  dir="ltr"
                  rows={1}
                  disabled={disabled}
                  value={values.en}
                  onChange={(event) =>
                    onEntryChange(entry, "en", event.target.value)
                  }
                  aria-label={t("translationEditor.editEnglishEntry", {
                    path: entry.key,
                  })}
                  className={cn(fieldClassName, "min-h-9 leading-relaxed")}
                />
                {enChanged && (
                  <span className="text-[11px] text-muted-foreground">
                    {t("translationEditor.was")}{" "}
                    <span dir="ltr" className="line-through">
                      {entry.en}
                    </span>
                  </span>
                )}
              </label>
            </div>
          )
        })}
        {rows.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 px-6 py-14 text-center">
            <span className="text-sm font-medium">
              {t("translationEditor.noResults")}
            </span>
            <span className="text-[13px] text-muted-foreground">
              {filter === "edited"
                ? t("translationEditor.noEditedDescription")
                : t("translationEditor.noResultsDescription")}
            </span>
          </div>
        )}
      </div>
    </section>
  )
}

export default TranslationEditor
