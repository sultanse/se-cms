import {
  CheckIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  PlusIcon,
  RotateCcwIcon,
  SaveIcon,
} from "lucide-react"
import { useStore } from "@tanstack/react-store"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import { useTranslation } from "react-i18next"
import { Button } from "../ui/button"
import { useLanguage } from "@/hooks/use-language"
import { fetchPlatformLocales, githubStore } from "@/stores/github-store"
import {
  collectStringPaths,
  readDraft,
  sameEdits,
  translationEditorStore,
  writeDraft,
  type Edits,
} from "@/stores/translation-editor-store"

function TranslationEditorHeader() {
  const { t } = useTranslation()
  const { language, direction, changeLanguage } = useLanguage()
  const platformId = useStore(
    translationEditorStore,
    (state) => state.platformId
  )
  const savedDraft = useStore(
    translationEditorStore,
    (state) => state.savedDraft
  )
  const edits = useStore(translationEditorStore, (state) => state.edits)
  const platforms = useStore(githubStore, (state) => state.platforms)
  const platform = platforms.find(({ id }) => id === platformId) ?? platforms[0]
  const editCount = Object.keys(edits).length
  const draftIsCurrent = sameEdits(edits, savedDraft)
  const draftSaved = draftIsCurrent && Object.keys(savedDraft).length > 0

  const setEdits = (nextEdits: Edits) => {
    translationEditorStore.setState((state) => ({
      ...state,
      edits: nextEdits,
    }))
  }

  const saveDraft = () => {
    if (writeDraft(platform.id, edits)) {
      translationEditorStore.setState((state) => ({
        ...state,
        savedDraft: edits,
      }))
    }
  }

  const changePlatform = async (nextPlatformId: string) => {
    const requestedPlatform =
      platforms.find(({ id }) => id === nextPlatformId) ?? platforms[0]
    await fetchPlatformLocales(requestedPlatform.id)
    const nextPlatform =
      githubStore.state.platforms.find(({ id }) => id === requestedPlatform.id) ??
      requestedPlatform
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
    <header
      id="translation-editor-header"
      className="sticky top-0 z-10 h-15 border-b bg-background"
    >
      <div className="mx-auto flex h-full max-w-[1620px] items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-10 items-center gap-2.5 rounded-lg border bg-background ps-1.5 pe-2.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50">
              <span className="grid size-7 flex-none place-items-center rounded-[7px] bg-primary text-xs font-semibold text-primary-foreground">
                {platform.name.slice(0, 1)}
              </span>
              <span className="flex flex-col items-start text-start leading-tight">
                <span className="text-[13px] font-semibold">
                  {platform.name}
                </span>
                <span dir="ltr" className="text-[11px] text-muted-foreground">
                  {platform.domain}
                </span>
              </span>
              <ChevronsUpDownIcon className="ms-1.5 size-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72" dir={direction}>
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
                      <span className="flex min-w-0 flex-col leading-snug">
                        <span className="text-[13px] font-medium">
                          {item.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          <span dir="ltr">{item.files}</span>
                          {" · "}
                          {t("translationEditor.keysCount", {
                            count: collectStringPaths(item.locales.ar).length,
                          })}
                        </span>
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2.5" disabled>
                <PlusIcon className="size-3.5" />
                {t("translationEditor.addPlatform")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ChevronRightIcon className="size-3.5 flex-none text-muted-foreground rtl:rotate-180" />
          <span dir="ltr" className="truncate text-[13px] font-medium">
            {platform.files}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex gap-0.5 rounded-[10px] bg-muted p-0.75"
            role="group"
            aria-label={t("translationEditor.language")}
          >
            {(["ar", "en"] as const).map((option) => (
              <Button
                key={option}
                variant={language === option ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={language === option}
                onClick={() => changeLanguage(option)}
              >
                {option === "ar"
                  ? t("translationEditor.arabicOption")
                  : t("translationEditor.englishOption")}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEdits({})}
            disabled={editCount === 0}
          >
            <RotateCcwIcon data-icon="inline-start" />
            <span className="hidden sm:inline">
              {t("translationEditor.reset")}
            </span>
          </Button>
          <Button size="sm" onClick={saveDraft} disabled={draftIsCurrent}>
            {draftSaved ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <SaveIcon data-icon="inline-start" />
            )}
            <span className="hidden sm:inline">
              {draftSaved
                ? t("translationEditor.draftSaved")
                : t("translationEditor.saveDraft")}
            </span>
          </Button>
        </div>
      </div>
    </header>
  )
}

export default TranslationEditorHeader
