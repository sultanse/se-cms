import { ChevronsUpDownIcon, GitBranchIcon } from "lucide-react"
import { useStore } from "@tanstack/react-store"
import { useTranslation } from "react-i18next"

import { useLanguage } from "@/hooks/use-language"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { fetchPlatformLocales, githubStore } from "@/stores/github-store"
import {
  collectStringPaths,
  readDraft,
  translationEditorStore,
} from "@/stores/translation-editor-store"

function RepositoryPicker({ busy }: { busy: boolean }) {
  const { t } = useTranslation()
  const { direction } = useLanguage()
  const platformId = useStore(
    translationEditorStore,
    (state) => state.platformId
  )
  const platforms = useStore(githubStore, (state) => state.platforms)
  const platform = platforms.find(({ id }) => id === platformId) ?? platforms[0]
  const editingSessionActive = platform.branchName !== null

  const changePlatform = async (nextPlatformId: string) => {
    const requestedPlatform =
      platforms.find(({ id }) => id === nextPlatformId) ?? platforms[0]
    await fetchPlatformLocales(requestedPlatform.id)
    const nextPlatform =
      githubStore.state.platforms.find(
        ({ id }) => id === requestedPlatform.id
      ) ?? requestedPlatform
    const draft = readDraft(nextPlatform)
    translationEditorStore.setState((state) => ({
      ...state,
      platformId: nextPlatform.id,
      savedDraft: draft,
      edits: draft,
      draftInitialized: true,
    }))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={busy || editingSessionActive}
        aria-label={t("translationEditor.repository")}
        className="flex h-9 min-w-0 items-center gap-2 rounded-[10px] border bg-card ps-2 pe-2.5 text-start outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:hover:bg-card"
      >
        <span className="grid size-6 flex-none place-items-center rounded-[7px] bg-primary text-xs font-semibold text-primary-foreground">
          {platform.name.slice(0, 1)}
        </span>
        <span className="truncate text-[13px] font-semibold">
          {platform.name}
        </span>
        <span
          dir="ltr"
          className="hidden truncate text-xs text-muted-foreground md:inline"
        >
          {platform.domain}
        </span>
        <ChevronsUpDownIcon className="size-4 flex-none text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56" dir={direction}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {t("translationEditor.platforms")}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={platform.id}
            onValueChange={(value) => changePlatform(String(value))}
          >
            {platforms.map((item) => (
              <DropdownMenuRadioItem
                key={item.id}
                value={item.id}
                className="gap-2.5 py-2"
              >
                <span className="grid size-6.5 flex-none place-items-center rounded-[7px] bg-muted text-[11px] font-semibold">
                  {item.name.slice(0, 1)}
                </span>
                <span className="flex min-w-0 items-center gap-1.5 leading-snug">
                  <span className="text-[13px] font-medium">{item.name}</span>
                  {item.localesLoaded && (
                    <span className="text-[11px] text-muted-foreground">
                      {t("translationEditor.keysCount", {
                        count: collectStringPaths(item.locales.ar).length,
                      })}
                    </span>
                  )}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LanguageToggle() {
  const { t } = useTranslation()
  const { language, changeLanguage } = useLanguage()

  return (
    <div
      role="group"
      aria-label={t("translationEditor.language")}
      className="flex flex-none gap-1 rounded-full border bg-background/70 p-1"
    >
      {(["ar", "en"] as const).map((option) => (
        <Button
          key={option}
          variant={language === option ? "default" : "outline"}
          size="sm"
          aria-pressed={language === option}
          aria-label={t(option === "ar" ? "arabic" : "english")}
          onClick={() => changeLanguage(option)}
          className="rounded-full"
        >
          <span className="sm:hidden">
            {t(
              option === "ar"
                ? "translationEditor.arabicOption"
                : "translationEditor.englishOption"
            )}
          </span>
          <span className="max-sm:hidden">
            {t(option === "ar" ? "arabic" : "english")}
          </span>
        </Button>
      ))}
    </div>
  )
}

function TranslationEditorHeader({ busy = false }: { busy?: boolean }) {
  const { t } = useTranslation()
  const platformId = useStore(
    translationEditorStore,
    (state) => state.platformId
  )
  const platforms = useStore(githubStore, (state) => state.platforms)
  const platform = platforms.find(({ id }) => id === platformId) ?? platforms[0]

  return (
    <header
      id="translation-editor-header"
      className="sticky top-0 z-10 h-15 border-b bg-background"
    >
      <div className="mx-auto flex h-full max-w-[1620px] items-center justify-between gap-[clamp(0.75rem,2vw,1rem)] px-(--page-gutter)">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex flex-none items-center gap-2">
            <img src="/app-icon.svg" alt="" className="size-8 rounded-lg" />
            <span className="hidden text-sm font-semibold sm:inline">
              {t("brand")}
            </span>
          </div>
          <span aria-hidden="true" className="h-6 w-px flex-none bg-border" />
          <RepositoryPicker busy={busy} />
          {platform.branchName && (
            <span
              dir="ltr"
              title={t("translationEditor.editingBranch")}
              className="hidden h-7 min-w-0 items-center gap-1.5 rounded-md bg-secondary px-2 text-xs text-secondary-foreground lg:flex"
            >
              <GitBranchIcon className="size-3.5 flex-none" />
              <span className="truncate">{platform.branchName}</span>
            </span>
          )}
        </div>

        <LanguageToggle />
      </div>
    </header>
  )
}

export default TranslationEditorHeader
