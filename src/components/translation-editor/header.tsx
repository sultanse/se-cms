import {
  CheckIcon,
  ChevronsUpDownIcon,
  GitBranchIcon,
  GitPullRequestIcon,
  PlusIcon,
  RotateCcwIcon,
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
import {
  fetchPlatformLocales,
  githubStore,
  startPlatformEditing,
  submitPlatformPullRequest,
} from "@/stores/github-store"
import {
  applyEdits,
  collectEntries,
  collectStringPaths,
  readDraft,
  translationEditorStore,
  type Edits,
} from "@/stores/translation-editor-store"

function TranslationEditorHeader({ busy = false }: { busy?: boolean }) {
  const { t } = useTranslation()
  const { direction } = useLanguage()
  const platformId = useStore(
    translationEditorStore,
    (state) => state.platformId
  )
  const edits = useStore(translationEditorStore, (state) => state.edits)
  const platforms = useStore(githubStore, (state) => state.platforms)
  const localeLoadingPlatformId = useStore(
    githubStore,
    (state) => state.localeLoadingPlatformId
  )
  const sessionLoadingPlatformId = useStore(
    githubStore,
    (state) => state.sessionLoadingPlatformId
  )
  const platform = platforms.find(({ id }) => id === platformId) ?? platforms[0]
  const editCount = Object.keys(edits).length
  const sessionLoading = sessionLoadingPlatformId === platform.id
  const operationBusy =
    busy ||
    localeLoadingPlatformId !== null ||
    sessionLoadingPlatformId !== null
  const editingSessionActive = platform.branchName !== null

  const setEdits = (nextEdits: Edits) => {
    translationEditorStore.setState((state) => ({
      ...state,
      edits: nextEdits,
    }))
  }

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

  const startEditing = async () => {
    try {
      await startPlatformEditing(platform.id)
      const latestPlatform =
        githubStore.state.platforms.find(({ id }) => id === platform.id) ??
        platform
      const draft = readDraft(latestPlatform)
      translationEditorStore.setState((state) => ({
        ...state,
        savedDraft: draft,
        edits: draft,
        draftInitialized: true,
      }))
    } catch (error) {
      console.error("Could not start the editing session:", error)
    }
  }

  const submitPullRequest = async () => {
    if (!editingSessionActive || editCount === 0) return

    const latestPlatform =
      githubStore.state.platforms.find(({ id }) => id === platform.id) ??
      platform

    try {
      await submitPlatformPullRequest(platform.id, {
        ar: applyEdits(latestPlatform.locales.ar, edits, "ar"),
        en: applyEdits(latestPlatform.locales.en, edits, "en"),
      })
      const refetchedPlatform =
        githubStore.state.platforms.find(({ id }) => id === platform.id) ??
        latestPlatform
      const savedValues = new Map(
        collectEntries(refetchedPlatform).map((entry) => [entry.key, entry])
      )
      // Keep only edits the refetched files don't already contain.
      const remainingEdits = Object.fromEntries(
        Object.entries(edits).filter(([key, values]) => {
          const saved = savedValues.get(key)
          return saved?.ar !== values.ar || saved?.en !== values.en
        })
      )
      translationEditorStore.setState((state) => ({
        ...state,
        savedDraft: remainingEdits,
        edits: remainingEdits,
      }))
    } catch (error) {
      console.error("Could not submit the translation pull request:", error)
    }
  }

  return (
    <header
      id="translation-editor-header"
      className="sticky top-0 z-10 h-15 border-b bg-background"
    >
      <div className="mx-auto flex h-full max-w-[1620px] items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={operationBusy || editingSessionActive}
              className="flex h-10 items-center gap-2.5 rounded-lg border bg-background ps-1.5 pe-2.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
            >
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
        </div>

        <div className="flex items-center gap-2">
          {platform.pullRequestUrl && (
            <a
              href={platform.pullRequestUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-[min(var(--radius-md),10px)] border border-border bg-background px-2.5 text-sm font-medium shadow-xs hover:bg-muted"
            >
              <CheckIcon data-icon="inline-start" />
              <span className="hidden sm:inline">
                {t("translationEditor.pullRequestCreated")}
              </span>
            </a>
          )}
          {platform.branchName ? (
            <Button
              size="sm"
              onClick={submitPullRequest}
              disabled={operationBusy || editCount === 0}
            >
              <GitPullRequestIcon data-icon="inline-start" />
              <span className="hidden sm:inline">
                {t("translationEditor.submitPullRequest")}
              </span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={startEditing}
              disabled={operationBusy || sessionLoading}
            >
              <GitBranchIcon
                data-icon="inline-start"
                className={sessionLoading ? "animate-pulse" : undefined}
              />
              <span className="hidden sm:inline">
                {sessionLoading
                  ? t("translationEditor.startingEditing")
                  : t("translationEditor.startEditing")}
              </span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEdits({})}
            disabled={operationBusy || !editingSessionActive || editCount === 0}
          >
            <RotateCcwIcon data-icon="inline-start" />
            <span className="hidden sm:inline">
              {t("translationEditor.reset")}
            </span>
          </Button>
        </div>
      </div>
    </header>
  )
}

export default TranslationEditorHeader
