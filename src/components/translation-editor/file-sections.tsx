import { ChevronsUpDownIcon, LanguagesIcon } from "lucide-react"
import { useStore } from "@tanstack/react-store"
import { useTranslation } from "react-i18next"

import { useLanguage } from "@/hooks/use-language"
import { cn } from "@/lib/utils"
import { githubStore } from "@/stores/github-store"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  const { language, changeLanguage } = useLanguage()
  const user = useStore(githubStore, (state) => state.account)

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
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex h-14 w-full items-center gap-2 rounded-xl px-2 text-start outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label={user?.login ?? "GitHub account"}
          >
            <Avatar className="size-9 rounded-lg">
              <AvatarImage src={user?.avatar_url} alt="" />
              <AvatarFallback className="rounded-lg text-sm font-semibold">
                {user?.login.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-[13px] font-semibold">
                {user?.login ?? "GitHub"}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                GitHub account
              </span>
            </span>
            <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            className="w-64"
            dir={language === "ar" ? "rtl" : "ltr"}
          >
            <DropdownMenuGroup>
              <div className="flex items-center gap-2 px-2 py-2 text-xs font-medium text-muted-foreground">
                <Avatar size="sm" className="rounded-md">
                  <AvatarImage src={user?.avatar_url} alt="" />
                  <AvatarFallback className="rounded-md">
                    {user?.login.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-sm font-semibold">
                    {user?.login ?? "GitHub"}
                  </span>
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    GitHub account
                  </span>
                </span>
              </div>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => changeLanguage(language === "ar" ? "en" : "ar")}
                className="gap-2"
              >
                <LanguagesIcon className="size-3.5" />
                {language === "ar"
                  ? t("translationEditor.englishOption")
                  : t("translationEditor.arabicOption")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}

export default FileSections
