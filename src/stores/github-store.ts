import { createStore } from "@tanstack/react-store"

import { getAllRepositories, getRepositoryLocales } from "@/services/github"

type Repositories = Awaited<ReturnType<typeof getAllRepositories>>
type JsonObject = { [key: string]: unknown }

export type Platform = {
  id: string
  name: string
  domain: string
  files: string
  locales: {
    ar: JsonObject
    en: JsonObject
  }
  localesLoaded: boolean
}

function platformFromRepository(repository: Repositories[number]): Platform {
  return {
    id: String(repository.id),
    name: repository.name,
    domain: repository.full_name,
    files: "ar.json + en.json",
    locales: { ar: {}, en: {} },
    localesLoaded: false,
  }
}

export type GithubState = {
  repositories: Repositories
  platforms: Platform[]
  loading: boolean
  error: unknown
}

export const githubStore = createStore<GithubState>({
  repositories: [],
  platforms: [],
  loading: false,
  error: null,
})

export async function fetchRepositories() {
  const { loading, repositories } = githubStore.state

  if (loading || repositories.length > 0) return

  githubStore.setState((state) => ({
    ...state,
    loading: true,
    error: null,
  }))

  try {
    const repositories = await getAllRepositories()
    const platforms = repositories.map(platformFromRepository)

    githubStore.setState((state) => ({
      ...state,
      repositories,
      platforms,
    }))

    await fetchPlatformLocales(platforms[0]?.id)

    githubStore.setState((state) => ({ ...state, loading: false }))
  } catch (error) {
    githubStore.setState((state) => ({
      ...state,
      loading: false,
      error,
    }))
  }
}

export async function fetchPlatformLocales(platformId: string | undefined) {
  if (!platformId) return

  const { platforms, repositories } = githubStore.state
  const platform = platforms.find(({ id }) => id === platformId)
  const repository = repositories.find(({ id }) => String(id) === platformId)

  if (!platform || !repository || platform.localesLoaded) {
    return
  }

  const owner = repository.owner?.login
  if (!owner)
    throw new Error(`Could not determine the owner for ${platform.name}`)

  const locales = await getRepositoryLocales(owner, repository.name)
  githubStore.setState((state) => ({
    ...state,
    platforms: state.platforms.map((item) =>
      item.id === platformId ? { ...item, locales, localesLoaded: true } : item
    ),
  }))
}
