import { LogOutIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type SectionLink = {
  id: string | null
  label: string
  count: number
}

type FileSectionsProps = {
  sectionLinks: SectionLink[]
  activeSection: string | null
  sectionsCount: number
  entriesCount: number
  onSectionChange: (section: string | null) => void
}

function FileSections({
  sectionLinks,
  activeSection,
  sectionsCount,
  entriesCount,
  onSectionChange,
}: FileSectionsProps) {
  const { t } = useTranslation()

  return (
    <aside
      id="file-sections"
      className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-21 lg:h-[calc(100svh-6.75rem)]"
    >
      <div className="flex flex-col gap-0.5 px-2.5">
        <h3 className="text-sm font-semibold">
          {t("translationEditor.fileSections")}
        </h3>
        <span className="text-xs text-muted-foreground">
          {t("translationEditor.sectionsSummary", {
            sections: sectionsCount,
            values: entriesCount,
          })}
        </span>
      </div>
      <nav className="flex gap-0.5 overflow-x-auto lg:min-h-0 lg:flex-col lg:overflow-y-auto">
        {sectionLinks.map(({ id, label, count }) => {
          const active = id === activeSection
          return (
            <button
              key={id ?? "all"}
              type="button"
              aria-current={active ? "true" : undefined}
              onClick={() => onSectionChange(id)}
              className={cn(
                "flex h-8.5 flex-none items-center justify-between gap-2 rounded-lg px-2.5 text-[13px] hover:bg-accent",
                active && "bg-accent font-semibold"
              )}
            >
              <span dir={id ? "ltr" : undefined}>{label}</span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {count}
              </span>
            </button>
          )
        })}
      </nav>
      <div className="mt-auto border-t pt-3">
        <Button
          variant="ghost"
          className="h-8.5 w-full justify-start gap-2 px-2.5 text-[13px] font-normal text-muted-foreground"
        >
          <LogOutIcon data-icon="inline-start" className="rtl:rotate-180" />
          {t("translationEditor.logout")}
        </Button>
      </div>
    </aside>
  )
}

export default FileSections
