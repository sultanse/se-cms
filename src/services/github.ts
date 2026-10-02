import { Octokit } from "octokit"

import { getGithubAccessToken } from "@/stores/github-auth-store"

function getGithubClient() {
  const accessToken = getGithubAccessToken()
  if (!accessToken)
    throw new Error("Sign in with GitHub before using the editor")
  return new Octokit({ auth: accessToken })
}

// GitHub responses carry `Cache-Control: private, max-age=60`, so reads that
// must reflect a commit made seconds ago skip the browser cache.
const uncached = {
  request: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, { ...init, cache: "no-store" }),
  },
}

type TranslationLocale = "ar" | "en"
export type JsonObject = { [key: string]: unknown }

type TranslationFile = {
  path: string
  sha: string
  json: JsonObject
}

const translationPaths = (locale: TranslationLocale) => [
  `src/i18n/${locale}.json`,
  `src/i18n/locales/${locale}.json`,
]

async function getTranslationFile(
  owner: string,
  repo: string,
  locale: TranslationLocale,
  ref?: string
): Promise<TranslationFile> {
  for (const path of translationPaths(locale)) {
    try {
      const { data } = await getGithubClient().rest.repos.getContent({
        owner,
        repo,
        path,
        ...(ref ? { ref } : {}),
        ...uncached,
      })

      if (Array.isArray(data) || data.type !== "file" || !data.content) {
        continue
      }

      const binary = atob(data.content.replace(/\n/g, ""))
      const bytes = Uint8Array.from(binary, (character: string) =>
        character.charCodeAt(0)
      )
      const json = JSON.parse(new TextDecoder().decode(bytes))
      if (json !== null && typeof json === "object" && !Array.isArray(json)) {
        return { path, sha: data.sha, json: json as JsonObject }
      }
    } catch (error) {
      if ((error as { status?: number }).status === 404) continue
      throw error
    }
  }

  throw new Error(`Could not find ${locale}.json in ${owner}/${repo}`)
}

export async function getRepositoryLocales(
  owner: string,
  repo: string,
  ref?: string
) {
  const [ar, en] = await Promise.all([
    getTranslationFile(owner, repo, "ar", ref),
    getTranslationFile(owner, repo, "en", ref),
  ])

  return {
    locales: { ar: ar.json, en: en.json },
    paths: { ar: ar.path, en: en.path },
  }
}

export async function findOpenLocalePullRequest(owner: string, repo: string) {
  const { data: pullRequests } = await getGithubClient().rest.pulls.list({
    owner,
    repo,
    state: "open",
    per_page: 100,
    ...uncached,
  })
  const pullRequest = pullRequests.find(
    ({ head, title }) =>
      head.repo?.full_name === `${owner}/${repo}` &&
      head.ref.startsWith("locale/") &&
      title.startsWith("Update translations (")
  )

  if (!pullRequest) return null

  return {
    branchName: pullRequest.head.ref,
    baseBranch: pullRequest.base.ref,
    pullRequestUrl: pullRequest.html_url,
    pullRequestNumber: pullRequest.number,
  }
}

export type PullRequestStatus = "open" | "approved" | "merged" | "closed"

export async function getPullRequestStatus(
  owner: string,
  repo: string,
  pullNumber: number
): Promise<PullRequestStatus> {
  const { data: pullRequest } = await getGithubClient().rest.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
    ...uncached,
  })
  if (pullRequest.merged) return "merged"
  if (pullRequest.state === "closed") return "closed"

  const { data: reviews } = await getGithubClient().rest.pulls.listReviews({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
    ...uncached,
  })
  const latestReviewStates = new Map<string, string>()
  for (const { user, state } of reviews) {
    if (!user || (state !== "APPROVED" && state !== "CHANGES_REQUESTED"))
      continue
    latestReviewStates.set(user.login, state)
  }
  const states = [...latestReviewStates.values()]

  return states.includes("APPROVED") && !states.includes("CHANGES_REQUESTED")
    ? "approved"
    : "open"
}

const localeCommitMessage = "Update translations from the locale editor"

type LocaleCommit = {
  owner: string
  repo: string
  branch: string
  paths: Record<TranslationLocale, string>
  locales: Record<TranslationLocale, JsonObject>
}

// Writes both locale files as one commit. When the branch tip is a previous
// locale-editor commit, it is replaced (amended and force-updated) instead of
// stacking a new commit on top of it.
async function commitLocaleFiles({
  owner,
  repo,
  branch,
  paths,
  locales,
}: LocaleCommit) {
  const client = getGithubClient()
  const ref = `heads/${branch}`
  const { data: branchRef } = await client.rest.git.getRef({
    owner,
    repo,
    ref,
    ...uncached,
  })
  const { data: head } = await client.rest.git.getCommit({
    owner,
    repo,
    commit_sha: branchRef.object.sha,
  })
  const amend =
    head.message === localeCommitMessage && head.parents.length === 1

  const { data: tree } = await client.rest.git.createTree({
    owner,
    repo,
    base_tree: head.tree.sha,
    tree: (["ar", "en"] as const).map((locale) => ({
      path: paths[locale],
      mode: "100644" as const,
      type: "blob" as const,
      content: `${JSON.stringify(locales[locale], null, 2)}\n`,
    })),
  })
  if (tree.sha === head.tree.sha) return

  const { data: commit } = await client.rest.git.createCommit({
    owner,
    repo,
    message: localeCommitMessage,
    tree: tree.sha,
    parents: [amend ? head.parents[0].sha : head.sha],
  })
  await client.rest.git.updateRef({
    owner,
    repo,
    ref,
    sha: commit.sha,
    force: amend,
  })
}

export async function createLocaleBranch(
  owner: string,
  repo: string,
  branch: string
) {
  const { data: repository } = await getGithubClient().rest.repos.get({
    owner,
    repo,
  })
  const { data: baseBranch } = await getGithubClient().rest.repos.getBranch({
    owner,
    repo,
    branch: repository.default_branch,
  })

  await getGithubClient().rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branch}`,
    sha: baseBranch.commit.sha,
  })

  return repository.default_branch
}

export async function createLocalePullRequest({
  baseBranch,
  ...localeCommit
}: LocaleCommit & { baseBranch: string }) {
  await commitLocaleFiles(localeCommit)

  const { owner, repo, branch } = localeCommit
  const { data } = await getGithubClient().rest.pulls.create({
    owner,
    repo,
    title: `Update translations (${branch})`,
    head: branch,
    base: baseBranch,
    body: "Translation updates submitted from the locale editor.",
  })

  return { url: data.html_url, number: data.number }
}

export async function updateLocaleBranch(localeCommit: LocaleCommit) {
  await commitLocaleFiles(localeCommit)
}

export async function getAllRepositories() {
  try {
    const { data } =
      await getGithubClient().rest.repos.listForAuthenticatedUser({
        per_page: 100,
        page: 1,
        sort: "updated",
        direction: "desc",
      })

    return data
  } catch (error) {
    console.error("Error fetching GitHub repositories:", error)
    throw error
  }
}
