import { createStore } from "@tanstack/react-store"

import {
  createLocaleBranch,
  createLocalePullRequest,
  findOpenLocalePullRequest,
  getAccount,
  getAllRepositories,
  getPullRequestStatus,
  getRepositoryLocales,
  isUnauthorized,
  updateLocaleBranch,
  type GithubAccount,
  type JsonObject,
  type PullRequestStatus,
} from "@/services/github"

export type { PullRequestStatus }

type Repositories = Awaited<ReturnType<typeof getAllRepositories>>
export type Platform = {
  id: string
  name: string
  domain: string
  files: string
  locales: {
    ar: JsonObject
    en: JsonObject
  }
  localePaths: {
    ar: string
    en: string
  }
  localesLoaded: boolean
  branchName: string | null
  baseBranch: string | null
  pullRequestUrl: string | null
  pullRequestNumber: number | null
  pullRequestStatus: PullRequestStatus | null
}

function platformFromRepository(repository: Repositories[number]): Platform {
  return {
    id: String(repository.id),
    name: repository.name,
    domain: repository.full_name,
    files: "ar.json + en.json",
    locales: { ar: {}, en: {} },
    localePaths: { ar: "", en: "" },
    localesLoaded: false,
    branchName: null,
    baseBranch: null,
    pullRequestUrl: null,
    pullRequestNumber: null,
    pullRequestStatus: null,
  }
}

export type GithubState = {
  account: GithubAccount | null
  repositories: Repositories
  platforms: Platform[]
  loading: boolean
  localeLoadingPlatformId: string | null
  sessionLoadingPlatformId: string | null
  error: unknown
}

export const githubStore = createStore<GithubState>({
  account: null,
  repositories: [],
  platforms: [],
  loading: false,
  localeLoadingPlatformId: null,
  sessionLoadingPlatformId: null,
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
    const [account, repositories] = await Promise.all([
      getAccount(),
      getAllRepositories(),
    ])
    if (repositories.length === 0) {
      throw new Error(
        "GITHUB_TOKEN has no access to any repositories with ar.json and en.json"
      )
    }
    const platforms = repositories.map(platformFromRepository)

    githubStore.setState((state) => ({
      ...state,
      account,
      repositories,
      platforms,
    }))

    await fetchPlatformLocales(platforms[0]?.id)

    githubStore.setState((state) => ({ ...state, loading: false }))
  } catch (error) {
    githubStore.setState((state) => ({
      ...state,
      loading: false,
      error: isUnauthorized(error)
        ? new Error("GITHUB_TOKEN is invalid, expired or revoked")
        : error,
    }))
  }
}

export async function fetchPlatformLocales(
  platformId: string | undefined,
  force = false
) {
  if (!platformId) return

  const { platforms, repositories } = githubStore.state
  const platform = platforms.find(({ id }) => id === platformId)
  const repository = repositories.find(({ id }) => String(id) === platformId)

  if (!platform || !repository || (!force && platform.localesLoaded)) {
    return
  }

  if (githubStore.state.localeLoadingPlatformId) return

  githubStore.setState((state) => ({
    ...state,
    localeLoadingPlatformId: platformId,
  }))

  try {
    const owner = repository.owner?.login
    if (!owner)
      throw new Error(`Could not determine the owner for ${platform.name}`)

    const openPullRequest = platform.branchName
      ? null
      : await findOpenLocalePullRequest(owner, repository.name)
    const branchName = openPullRequest?.branchName ?? platform.branchName
    const [{ locales, paths }, pullRequestStatus] = await Promise.all([
      getRepositoryLocales(owner, repository.name, branchName ?? undefined),
      openPullRequest
        ? getPullRequestStatus(
            owner,
            repository.name,
            openPullRequest.pullRequestNumber
          )
        : null,
    ])
    githubStore.setState((state) => ({
      ...state,
      platforms: state.platforms.map((item) =>
        item.id === platformId
          ? {
              ...item,
              ...(openPullRequest && { ...openPullRequest, pullRequestStatus }),
              locales,
              localePaths: paths,
              localesLoaded: true,
            }
          : item
      ),
    }))
  } finally {
    githubStore.setState((state) => ({
      ...state,
      localeLoadingPlatformId:
        state.localeLoadingPlatformId === platformId
          ? null
          : state.localeLoadingPlatformId,
    }))
  }
}

function localeBranchName() {
  const now = new Date()
  const date = now.toISOString().replace(/[-:]/g, "").replace("T", "-")
  return `locale/${date.slice(0, 15)}`
}

export async function startPlatformEditing(platformId: string) {
  const { platforms, repositories } = githubStore.state
  const platform = platforms.find(({ id }) => id === platformId)
  const repository = repositories.find(({ id }) => String(id) === platformId)

  if (!platform || !repository) throw new Error("Platform not found")
  if (platform.branchName) return platform.branchName

  githubStore.setState((state) => ({
    ...state,
    sessionLoadingPlatformId: platformId,
  }))

  try {
    await fetchPlatformLocales(platformId, true)
    const refreshedPlatform =
      githubStore.state.platforms.find(({ id }) => id === platformId) ??
      platform
    if (refreshedPlatform.branchName) return refreshedPlatform.branchName

    const owner = repository.owner?.login
    if (!owner)
      throw new Error(`Could not determine the owner for ${platform.name}`)

    const branchName = localeBranchName()
    const baseBranch = await createLocaleBranch(
      owner,
      repository.name,
      branchName
    )

    githubStore.setState((state) => ({
      ...state,
      platforms: state.platforms.map((item) =>
        item.id === platformId
          ? {
              ...refreshedPlatform,
              branchName,
              baseBranch,
              pullRequestUrl: null,
              pullRequestNumber: null,
              pullRequestStatus: null,
            }
          : item
      ),
    }))

    return branchName
  } finally {
    githubStore.setState((state) => ({
      ...state,
      sessionLoadingPlatformId:
        state.sessionLoadingPlatformId === platformId
          ? null
          : state.sessionLoadingPlatformId,
    }))
  }
}

export async function submitPlatformPullRequest(
  platformId: string,
  locales: { ar: JsonObject; en: JsonObject }
) {
  const { platforms, repositories } = githubStore.state
  const platform = platforms.find(({ id }) => id === platformId)
  const repository = repositories.find(({ id }) => String(id) === platformId)

  if (!platform?.branchName || !platform.baseBranch || !repository) {
    throw new Error("Start an editing session before submitting changes")
  }

  const owner = repository.owner?.login
  if (!owner)
    throw new Error(`Could not determine the owner for ${platform.name}`)

  githubStore.setState((state) => ({
    ...state,
    sessionLoadingPlatformId: platformId,
  }))

  try {
    let url = platform.pullRequestUrl
    if (url) {
      await updateLocaleBranch({
        owner,
        repo: repository.name,
        branch: platform.branchName,
        paths: platform.localePaths,
        locales,
      })
    } else {
      const result = await createLocalePullRequest({
        owner,
        repo: repository.name,
        branch: platform.branchName,
        baseBranch: platform.baseBranch,
        paths: platform.localePaths,
        locales,
      })
      url = result.url
      githubStore.setState((state) => ({
        ...state,
        platforms: state.platforms.map((item) =>
          item.id === platformId
            ? {
                ...item,
                pullRequestUrl: result.url,
                pullRequestNumber: result.number,
                pullRequestStatus: "open",
              }
            : item
        ),
      }))
    }

    // The commit is saved; a failed refetch must not report the save as failed.
    await Promise.all([
      fetchPlatformLocales(platformId, true),
      refreshPullRequestStatus(platformId),
    ]).catch((error) =>
      console.error("Could not refetch after saving the pull request:", error)
    )

    return { url }
  } finally {
    githubStore.setState((state) => ({
      ...state,
      sessionLoadingPlatformId:
        state.sessionLoadingPlatformId === platformId
          ? null
          : state.sessionLoadingPlatformId,
    }))
  }
}

export async function refreshPullRequestStatus(platformId: string) {
  const { platforms, repositories } = githubStore.state
  const platform = platforms.find(({ id }) => id === platformId)
  const repository = repositories.find(({ id }) => String(id) === platformId)
  const owner = repository?.owner?.login

  if (!platform?.pullRequestNumber || !repository || !owner) return

  const pullRequestStatus = await getPullRequestStatus(
    owner,
    repository.name,
    platform.pullRequestNumber
  )
  // A merged or closed PR ends the editing session; the next one starts a new branch.
  const sessionEnded =
    pullRequestStatus === "merged" || pullRequestStatus === "closed"

  githubStore.setState((state) => ({
    ...state,
    platforms: state.platforms.map((item) =>
      item.id === platformId
        ? {
            ...item,
            pullRequestStatus,
            ...(sessionEnded && { branchName: null, baseBranch: null }),
          }
        : item
    ),
  }))
}
