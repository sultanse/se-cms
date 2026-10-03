// All GitHub calls run in the Worker (worker/index.ts), which holds the
// fine-grained access token; these wrappers only forward arguments to
// /api/github/<action>.
async function callGithub<T>(
  action: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const response = await fetch(`/api/github/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      payload !== null && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : `GitHub request failed (${response.status})`
    throw new Error(message)
  }
  return payload as T
}

type TranslationLocale = "ar" | "en"
export type JsonObject = { [key: string]: unknown }

export type GithubAccount = {
  login: string
  avatar_url: string
}

export function getAccount() {
  return callGithub<GithubAccount>("account")
}

export type Repository = {
  id: number
  name: string
  full_name: string
  owner: { login: string } | null
}

export function getRepositoryLocales(
  owner: string,
  repo: string,
  ref?: string
) {
  return callGithub<{
    locales: Record<TranslationLocale, JsonObject>
    paths: Record<TranslationLocale, string>
  }>("locales", { owner, repo, ref })
}

export function findOpenLocalePullRequest(owner: string, repo: string) {
  return callGithub<{
    branchName: string
    baseBranch: string
    pullRequestUrl: string
    pullRequestNumber: number
  } | null>("findLocalePullRequest", { owner, repo })
}

export type PullRequestStatus = "open" | "approved" | "merged" | "closed"

export function getPullRequestStatus(
  owner: string,
  repo: string,
  pullNumber: number
) {
  return callGithub<PullRequestStatus>("pullRequestStatus", {
    owner,
    repo,
    pullNumber,
  })
}

type LocaleCommit = {
  owner: string
  repo: string
  branch: string
  paths: Record<TranslationLocale, string>
  locales: Record<TranslationLocale, JsonObject>
}

export async function createLocaleBranch(
  owner: string,
  repo: string,
  branch: string
) {
  const { baseBranch } = await callGithub<{ baseBranch: string }>(
    "createLocaleBranch",
    { owner, repo, branch }
  )
  return baseBranch
}

export function createLocalePullRequest(
  localeCommit: LocaleCommit & { baseBranch: string }
) {
  return callGithub<{ url: string; number: number }>(
    "createLocalePullRequest",
    localeCommit
  )
}

export async function updateLocaleBranch(localeCommit: LocaleCommit) {
  await callGithub<null>("updateLocaleBranch", localeCommit)
}

export async function getAllRepositories() {
  try {
    return await callGithub<Repository[]>("repositories")
  } catch (error) {
    console.error("Error fetching GitHub repositories:", error)
    throw error
  }
}
