import { createStore } from "@tanstack/react-store"

import type { Platform } from "@/stores/github-store"

export type LocaleName = "ar" | "en"
export type EntryValues = Record<LocaleName, string>
export type Edits = Record<string, EntryValues>
export type JsonValue = unknown
export type JsonObject = { [key: string]: JsonValue }
export type TranslationEntry = { key: string; path: string[] } & EntryValues
export function collectStringPaths(
  value: JsonValue,
  path: string[] = []
): string[][] {
  if (typeof value === "string") return [path]
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectStringPaths(item, [...path, String(index)])
    )
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      collectStringPaths(child, [...path, key])
    )
  }
  return []
}

function getStringAtPath(value: JsonValue, path: string[]): string {
  const result = path.reduce<JsonValue>((current, segment) => {
    if (Array.isArray(current)) return current[Number(segment)]
    if (current !== null && typeof current === "object") {
      return (current as JsonObject)[segment]
    }
    return undefined
  }, value)
  return typeof result === "string" ? result : ""
}

function setStringAtPath(value: JsonValue, path: string[], nextValue: string) {
  let current = value
  path.forEach((segment, index) => {
    const isLast = index === path.length - 1
    if (isLast) {
      if (Array.isArray(current)) current[Number(segment)] = nextValue
      else if (current !== null && typeof current === "object") {
        ;(current as JsonObject)[segment] = nextValue
      }
      return
    }

    const nextSegment = path[index + 1]
    if (Array.isArray(current)) {
      const arrayIndex = Number(segment)
      if (current[arrayIndex] === undefined) {
        current[arrayIndex] = /^\d+$/.test(nextSegment) ? [] : {}
      }
      current = current[arrayIndex]
    } else if (current !== null && typeof current === "object") {
      const object = current as JsonObject
      if (object[segment] === undefined) {
        object[segment] = /^\d+$/.test(nextSegment) ? [] : {}
      }
      current = object[segment]
    }
  })
}

export function applyEdits(value: JsonObject, edits: Edits, locale: LocaleName) {
  const result = JSON.parse(JSON.stringify(value)) as JsonObject
  Object.entries(edits).forEach(([key, values]) => {
    setStringAtPath(result, key.split("."), values[locale])
  })
  return result
}

export function collectEntries(platform: Platform): TranslationEntry[] {
  return collectStringPaths(platform.locales.ar).map((path) => ({
    key: path.join("."),
    path,
    ar: getStringAtPath(platform.locales.ar, path),
    en: getStringAtPath(platform.locales.en, path),
  }))
}

function draftStorageKey(platformId: string) {
  return `translation-draft:${platformId}`
}

export function readDraft(platform: Platform): Edits {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(draftStorageKey(platform.id)) ?? "{}"
    )
    if (stored === null || typeof stored !== "object") return {}
    const keys = new Set(collectEntries(platform).map(({ key }) => key))
    return Object.fromEntries(
      Object.entries(stored).filter(
        ([key, values]) =>
          keys.has(key) &&
          typeof values?.ar === "string" &&
          typeof values?.en === "string"
      )
    ) as Edits
  } catch {
    return {}
  }
}

export function writeDraft(platformId: string, edits: Edits) {
  try {
    if (Object.keys(edits).length === 0) {
      localStorage.removeItem(draftStorageKey(platformId))
    } else {
      localStorage.setItem(draftStorageKey(platformId), JSON.stringify(edits))
    }
    return true
  } catch {
    return false
  }
}

export function sameEdits(a: Edits, b: Edits) {
  const keys = Object.keys(a)
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => a[key].ar === b[key]?.ar && a[key].en === b[key]?.en)
  )
}

type TranslationEditorState = {
  platformId: string
  savedDraft: Edits
  edits: Edits
  draftInitialized: boolean
}

export const translationEditorStore = createStore<TranslationEditorState>({
  platformId: "",
  savedDraft: {},
  edits: {},
  draftInitialized: false,
})
