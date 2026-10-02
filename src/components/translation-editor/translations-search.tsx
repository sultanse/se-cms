import { SearchIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

type TranslationsSearchProps = {
  visibleCount: number
  activeSection: string | null
  query: string
  onQueryChange: (query: string) => void
}

function TranslationsSearch({
  visibleCount,
  activeSection,
  query,
  onQueryChange,
}: TranslationsSearchProps) {
  const { t } = useTranslation()

  return (
    <div
      id="translations-search"
      className="sticky top-15 z-5 flex flex-col gap-3.5 rounded-t-2xl border-b bg-card px-6 py-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.75">
          <h2 className="text-lg font-semibold">
            {t("translationEditor.translations")}
          </h2>
          <p className="text-[13px] text-muted-foreground">
            {t("translationEditor.visibleValues", { count: visibleCount })}
          </p>
        </div>
        {activeSection && (
          <Badge variant="secondary">
            <span dir="ltr">{activeSection}</span>
          </Badge>
        )}
      </div>
      <div className="relative">
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
          className="h-10 ps-9"
        />
      </div>
      <div className="hidden gap-4 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-2">
        <span>{t("translationEditor.arabicValue")}</span>
        <span>{t("translationEditor.englishValue")}</span>
      </div>
    </div>
  )
}

export default TranslationsSearch
