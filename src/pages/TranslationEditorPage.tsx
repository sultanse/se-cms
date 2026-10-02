import { useEffect, useMemo, useState } from "react"
import { useStore } from "@tanstack/react-store"
import { useTranslation } from "react-i18next"

import { useLanguage } from "@/hooks/use-language"
import GithubLoginButton from "@/components/github-login-button"
import { Spinner } from "@/components/ui/spinner"
import {
  fetchRepositories,
  githubStore,
  refreshPullRequestStatus,
  type Platform,
} from "@/stores/github-store"
import { githubAuthStore } from "@/stores/github-auth-store"
import {
  collectEntries,
  readDraft,
  translationEditorStore,
  type LocaleName,
  type TranslationEntry,
} from "@/stores/translation-editor-store"
import FileSections from "@/components/translation-editor/file-sections"
import TranslationEditorHeader from "@/components/translation-editor/header"
import TranslationEditor from "@/components/translation-editor/translation-editor"

const ROOT_SECTION = "__root__"

function sectionForPath(path: string[]) {
  return path.length > 1 ? path[0] : ROOT_SECTION
}

function TranslationEditorPage() {
  const { direction } = useLanguage()
  const accessToken = useStore(githubAuthStore, (state) => state.accessToken)
  const platforms = useStore(githubStore, (state) => state.platforms)
  const githubLoading = useStore(githubStore, (state) => state.loading)
  const { t } = useTranslation()

  useEffect(() => {
    if (!accessToken) return
    void fetchRepositories()
  }, [accessToken])

  if (!accessToken) {
    return (
      <div
        dir={direction}
        className="grid min-h-svh place-items-center bg-[radial-gradient(circle_at_top,_#eef2ff,_transparent_55%),_var(--muted)] p-4 sm:p-6"
      >
        <div className="flex w-full max-w-lg flex-col items-center gap-6 rounded-[28px] border border-border/70 bg-card p-6 text-center sm:p-10">
          <div className="grid size-12 place-items-center rounded-2xl bg-[#24292f] text-white">
            <svg
              aria-hidden="true"
              className="size-6"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M8 0C3.58 0 0 3.64 0 8.13c0 3.59 2.29 6.63 5.47 7.7.4.08.55-.18.55-.39 0-.19-.01-.7-.01-1.37-2.01.45-2.43-.99-2.43-.99-.36-.94-.88-1.19-.88-1.19-.72-.5.05-.49.05-.49.8.06 1.22.84 1.22.84.71 1.24 1.87.88 2.33.67.07-.52.28-.88.5-1.08-1.78-.21-3.65-.91-3.65-4.02 0-.89.31-1.62.82-2.19-.08-.21-.36-1.04.08-2.16 0 0 .67-.22 2.2.84a7.45 7.45 0 0 1 4 0c1.53-1.06 2.2-.84 2.2-.84.44 1.12.16 1.95.08 2.16.51.57.82 1.3.82 2.19 0 3.12-1.87 3.81-3.65 4.02.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.19 0 .21.15.47.55.39A8.14 8.14 0 0 0 16 8.13C16 3.64 12.42 0 8 0Z" />
            </svg>
          </div>
          <div className="flex max-w-md flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("translationEditor.signInTitle")}
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              {t("translationEditor.signInDescription")}
            </p>
          </div>
          <GithubLoginButton />
        </div>
      </div>
    )
  }

  if (githubLoading || platforms.length === 0) {
    return (
      <div className="grid min-h-svh place-items-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  return <TranslationEditorContent platforms={platforms} />
}

function TranslationEditorContent({ platforms }: { platforms: Platform[] }) {
  const { t } = useTranslation()
  const { direction } = useLanguage()
  const platformId = useStore(
    translationEditorStore,
    (state) => state.platformId
  )
  const edits = useStore(translationEditorStore, (state) => state.edits)
  const localeLoadingPlatformId = useStore(
    githubStore,
    (state) => state.localeLoadingPlatformId
  )
  const sessionLoadingPlatformId = useStore(
    githubStore,
    (state) => state.sessionLoadingPlatformId
  )
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  const platform = platforms.find(({ id }) => id === platformId) ?? platforms[0]
  const editorBusy =
    localeLoadingPlatformId !== null || sessionLoadingPlatformId !== null
  const editingSessionActive = platform.branchName !== null
  const entries = useMemo(() => collectEntries(platform), [platform])
  const sectionCounts = useMemo(
    () =>
      entries.reduce<Record<string, number>>((counts, { path }) => {
        const section = sectionForPath(path)
        counts[section] = (counts[section] ?? 0) + 1
        return counts
      }, {}),
    [entries]
  )
  const sections = Object.keys(sectionCounts)
  const editCount = Object.keys(edits).length

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return entries
      .filter(
        ({ path }) => !activeSection || sectionForPath(path) === activeSection
      )
      .map((entry) => ({
        entry,
        values: edits[entry.key] ?? entry,
        edited: entry.key in edits,
      }))
      .filter(
        ({ entry, values }) =>
          !normalizedQuery ||
          `${entry.key} ${values.ar} ${values.en}`
            .toLocaleLowerCase()
            .includes(normalizedQuery)
      )
  }, [activeSection, edits, entries, query])

  const updateEntry = (
    entry: TranslationEntry,
    localeName: LocaleName,
    value: string
  ) => {
    translationEditorStore.setState((state) => {
      const current = state.edits
      const next = { ...current }
      const values = {
        ...(current[entry.key] ?? { ar: entry.ar, en: entry.en }),
        [localeName]: value,
      }
      if (values.ar === entry.ar && values.en === entry.en) {
        delete next[entry.key]
      } else {
        next[entry.key] = values
      }
      return { ...state, edits: next }
    })
  }

  const revertEntry = (key: string) => {
    translationEditorStore.setState((state) => {
      const next = { ...state.edits }
      delete next[key]
      return { ...state, edits: next }
    })
  }

  const sectionLinks = [
    {
      id: null,
      label: t("translationEditor.allTranslations"),
      count: entries.length,
    },
    ...sections.map((id) => ({
      id,
      label: id === ROOT_SECTION ? "root" : id,
      count: sectionCounts[id],
    })),
  ]

  useEffect(() => {
    translationEditorStore.setState((state) => {
      if (state.draftInitialized) return state
      const draft = readDraft(platforms[0])
      return {
        ...state,
        platformId: state.platformId || platforms[0].id,
        savedDraft: draft,
        edits: draft,
        draftInitialized: true,
      }
    })
  }, [platforms])

  return (
    <div className="flex min-h-svh flex-col bg-muted" dir={direction}>
      <TranslationEditorHeader busy={editorBusy} />

      <div className="mx-auto grid w-full max-w-[1620px] flex-1 grid-cols-[minmax(0,1fr)] items-start gap-6 p-4 md:p-6 lg:grid-cols-[184px_minmax(0,1fr)]">
        <FileSections
          sectionLinks={sectionLinks}
          activeSection={activeSection}
          sectionsCount={sections.length}
          entriesCount={entries.length}
          onSectionChange={setActiveSection}
        />

        <main className="flex min-w-0 flex-col gap-5">
          <TranslationEditor
            rows={rows}
            direction={direction}
            overview={{
              textValues: entries.length,
              sectionsCount: sections.length,
              visibleResults: rows.length,
              unsavedValues: editCount,
              pullRequestStatus: platform.pullRequestStatus,
              onRefreshStatus: platform.pullRequestNumber
                ? () => refreshPullRequestStatus(platform.id)
                : undefined,
            }}
            activeSection={activeSection}
            query={query}
            onQueryChange={setQuery}
            onEntryChange={updateEntry}
            onRevertEntry={revertEntry}
            disabled={editorBusy || !editingSessionActive}
          />
        </main>
      </div>
    </div>
  )
}

export default TranslationEditorPage
