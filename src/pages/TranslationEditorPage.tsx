import { useEffect, useMemo, useState } from "react"
import { useStore } from "@tanstack/react-store"
import { useTranslation } from "react-i18next"

import { useLanguage } from "@/hooks/use-language"
import { Spinner } from "@/components/ui/spinner"
import {
  fetchRepositories,
  githubStore,
  type Platform,
} from "@/stores/github-store"
import {
  collectEntries,
  readDraft,
  translationEditorStore,
  type LocaleName,
  type TranslationEntry,
} from "@/stores/translation-editor-store"
import FileSections from "@/components/translation-editor/file-sections"
import TranslationEditorHeader from "@/components/translation-editor/header"
import PullRequestPanel from "@/components/translation-editor/pull-request-panel"
import TranslationEditor, {
  type EditFilter,
} from "@/components/translation-editor/translation-editor"

const ROOT_SECTION = "__root__"

function sectionForPath(path: string[]) {
  return path.length > 1 ? path[0] : ROOT_SECTION
}

function TranslationEditorPage() {
  const { direction } = useLanguage()
  const platforms = useStore(githubStore, (state) => state.platforms)
  const githubLoading = useStore(githubStore, (state) => state.loading)
  const githubError = useStore(githubStore, (state) => state.error)
  const { t } = useTranslation()

  useEffect(() => {
    void fetchRepositories()
  }, [])

  if (githubError && platforms.length === 0) {
    return (
      <div
        dir={direction}
        className="grid min-h-svh place-items-center bg-muted p-4 sm:p-6"
      >
        <div className="flex w-full max-w-lg flex-col gap-2 rounded-[28px] border border-border/70 bg-card p-6 text-center sm:p-10">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("translationEditor.loadFailed")}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground" dir="ltr">
            {githubError instanceof Error
              ? githubError.message
              : String(githubError)}
          </p>
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
  const [filter, setFilter] = useState<EditFilter>("all")

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
  const sectionEditCounts = useMemo(
    () =>
      entries.reduce<Record<string, number>>((counts, { key, path }) => {
        if (!(key in edits)) return counts
        const section = sectionForPath(path)
        counts[section] = (counts[section] ?? 0) + 1
        return counts
      }, {}),
    [edits, entries]
  )
  const sectionEntries = activeSection
    ? (sectionCounts[activeSection] ?? 0)
    : entries.length
  const sectionEdits = activeSection
    ? (sectionEditCounts[activeSection] ?? 0)
    : Object.keys(edits).length

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
        ({ entry, values, edited }) =>
          (filter === "all" || edited) &&
          (!normalizedQuery ||
            `${entry.key} ${values.ar} ${values.en}`
              .toLocaleLowerCase()
              .includes(normalizedQuery))
      )
  }, [activeSection, edits, entries, filter, query])

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
      editCount: Object.keys(edits).length,
    },
    ...sections.map((id) => ({
      id,
      label: id === ROOT_SECTION ? "root" : id,
      count: sectionCounts[id],
      editCount: sectionEditCounts[id] ?? 0,
    })),
  ]
  const activeSectionLink =
    sectionLinks.find(({ id }) => id === activeSection) ?? sectionLinks[0]

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
    <div
      dir={direction}
      // Spacing and column widths scale with the viewport instead of jumping
      // at breakpoints. Sticky columns sit below the 3.75rem header.
      className="flex min-h-svh flex-col bg-muted [--page-gutter:clamp(1rem,2.5vw,1.5rem)] [--sticky-max-h:calc(100svh-3.75rem-2*var(--page-gutter))] [--sticky-top:calc(3.75rem+var(--page-gutter))]"
    >
      <TranslationEditorHeader busy={editorBusy} />

      <div className="mx-auto grid w-full max-w-[1620px] flex-1 grid-cols-[minmax(0,1fr)] items-start gap-[clamp(0.75rem,1.5vw,1rem)] p-(--page-gutter) lg:grid-cols-[minmax(0,1fr)_clamp(17.5rem,20vw,18.75rem)] xl:grid-cols-[clamp(10rem,14vw,12.5rem)_minmax(0,1fr)_clamp(17.5rem,20vw,18.75rem)]">
        <FileSections
          sectionLinks={sectionLinks}
          activeSection={activeSection}
          sectionsCount={sections.length}
          entriesCount={entries.length}
          onSectionChange={setActiveSection}
        />

        <PullRequestPanel busy={editorBusy} />

        <main className="flex min-w-0 flex-col lg:col-start-1 lg:row-start-2 xl:col-start-2 xl:row-start-1">
          <TranslationEditor
            rows={rows}
            title={activeSectionLink.label}
            keyPrefixLength={
              activeSection && activeSection !== ROOT_SECTION ? 1 : 0
            }
            valuesCount={sectionEntries}
            editedCount={sectionEdits}
            filter={filter}
            onFilterChange={setFilter}
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
