import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

type SectionLink = {
  id: string | null
  label: string
  count: number
  editCount: number
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
      className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-1 xl:sticky xl:top-(--sticky-top) xl:max-h-(--sticky-max-h)"
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
      <nav className="flex gap-0.5 overflow-x-auto xl:min-h-0 xl:flex-col xl:overflow-y-auto">
        {sectionLinks.map(({ id, label, count, editCount }) => {
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
              <span dir={id ? "ltr" : undefined} className="truncate">
                {label}
              </span>
              <span className="flex flex-none items-center gap-1.5">
                {editCount > 0 && (
                  <span
                    title={t("translationEditor.editedInSection", {
                      count: editCount,
                    })}
                    className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-primary px-1.25 text-[10px] font-semibold text-primary-foreground tabular-nums"
                  >
                    {editCount}
                  </span>
                )}
                <span className="text-[11px] font-normal text-muted-foreground tabular-nums">
                  {count}
                </span>
              </span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}

export default FileSections
