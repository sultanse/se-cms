import { useEffect, useMemo, useState } from "react"
import { useStore } from "@tanstack/react-store"
import { useTranslation } from "react-i18next"

import { useLanguage } from "@/hooks/use-language"
import { githubStore, type Platform } from "@/stores/github-store"
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
  const platforms = useStore(githubStore, (state) => state.platforms)
  const githubLoading = useStore(githubStore, (state) => state.loading)

  if (githubLoading || platforms.length === 0) {
    return <div className="grid min-h-svh place-items-center">Loading...</div>
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
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  const platform = platforms.find(({ id }) => id === platformId) ?? platforms[0]
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
      <TranslationEditorHeader />

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
            }}
            activeSection={activeSection}
            query={query}
            onQueryChange={setQuery}
            onEntryChange={updateEntry}
            onRevertEntry={revertEntry}
          />
        </main>
      </div>
    </div>
  )
}

export default TranslationEditorPage
