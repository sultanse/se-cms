import { Octokit, RequestError } from "octokit"

// Every GitHub call runs in the browser with GITHUB_TOKEN, a fine-grained
// personal access token read from .env and inlined into the bundle at build
// time. Its repository selection and permissions (Contents and Pull requests:
// read and write) are the only limit on what the editor can reach.
const token = import.meta.env.GITHUB_TOKEN
const client = token ? new Octokit({ auth: token }) : null

function github() {
  if (!client) throw new Error("GITHUB_TOKEN must be set in .env")
  return client
}

export function isUnauthorized(error: unknown) {
  return error instanceof RequestError && error.status === 401
}

type TranslationLocale = "ar" | "en"
export type JsonObject = { [key: string]: unknown }

const locales = ["ar", "en"] as const

const translationPaths = (locale: TranslationLocale) => [
  `src/i18n/${locale}.json`,
  `src/i18n/locales/${locale}.json`,
]

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function fromBase64(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export type Repository = {
  id: number
  name: string
  full_name: string
  owner: { login: string } | null
}

// One GraphQL alias per candidate translation path, e.g. ar0, ar1, en0, en1
const translationCandidates = locales.flatMap((locale) =>
  translationPaths(locale).map((path, index) => ({
    locale,
    alias: `${locale}${index}`,
    path,
  }))
)

// Lists repositories and checks the translation files on their default
// branch in a single request, without downloading the files
const repositoriesQuery = `
  query {
    viewer {
      repositories(
        first: 100
        orderBy: { field: UPDATED_AT, direction: DESC }
        affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
      ) {
        nodes {
          databaseId
          name
          nameWithOwner
          owner { login }
          ${translationCandidates
            .map(
              ({ alias, path }) =>
                `${alias}: object(expression: "HEAD:${path}") { __typename }`
            )
            .join("\n          ")}
        }
      }
    }
  }
`

type RepositoryNode = {
  databaseId: number
  name: string
  nameWithOwner: string
  owner: { login: string }
  [alias: string]: unknown
}

function hasTranslationFiles(repository: RepositoryNode) {
  return locales.every((locale) =>
    translationCandidates.some(({ locale: candidate, alias }) => {
      const file = repository[alias]
      return (
        candidate === locale && isObject(file) && file.__typename === "Blob"
      )
    })
  )
}

// A fine-grained token lists only the repositories it was granted
// and only those with both translation files are returned
export async function getAllRepositories(): Promise<Repository[]> {
  // octokit.graphql throws on any error; a repository the token can't fully
  // read comes back as a null node with an error, so keep the partial data
  const { data: response } = await github().request("POST /graphql", {
    query: repositoriesQuery,
  })
  const nodes: (RepositoryNode | null)[] | undefined =
    response.data?.viewer?.repositories?.nodes
  if (!nodes) {
    throw new Error(
      response.errors?.[0]?.message ?? "Could not list repositories"
    )
  }

  return nodes
    .filter((repository) => repository !== null)
    .filter(hasTranslationFiles)
    .map((repository) => ({
      id: repository.databaseId,
      name: repository.name,
      full_name: repository.nameWithOwner,
      owner: { login: repository.owner.login },
    }))
}

async function getTranslationFile(
  owner: string,
  repo: string,
  locale: TranslationLocale,
  ref?: string
) {
  for (const path of translationPaths(locale)) {
    try {
      const { data } = await github().rest.repos.getContent({
        owner,
        repo,
        path,
        ...(ref ? { ref } : {}),
      })

      if (Array.isArray(data) || data.type !== "file" || !data.content) {
        continue
      }

      const bytes = fromBase64(data.content.replace(/\n/g, ""))
      const json: unknown = JSON.parse(new TextDecoder().decode(bytes))
      if (isObject(json)) return { path, json }
    } catch (error) {
      if (error instanceof RequestError && error.status === 404) continue
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
  const { data: pullRequests } = await github().rest.pulls.list({
    owner,
    repo,
    state: "open",
    per_page: 100,
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
    pullRequestTitle: pullRequest.title,
    pullRequestCreatedAt: pullRequest.created_at,
  }
}

export type PullRequestStatus = "open" | "approved" | "merged" | "closed"

export async function getPullRequestStatus(
  owner: string,
  repo: string,
  pullNumber: number
): Promise<PullRequestStatus> {
  const { data: pullRequest } = await github().rest.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  })
  if (pullRequest.merged) return "merged"
  if (pullRequest.state === "closed") return "closed"

  const { data: reviews } = await github().rest.pulls.listReviews({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
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

type LocaleCommit = {
  owner: string
  repo: string
  branch: string
  paths: Record<TranslationLocale, string>
  locales: Record<TranslationLocale, JsonObject>
}

const localeCommitMessage = "Update translations from the locale editor"

// Writes both locale files as one commit. When the branch tip is a previous
// locale-editor commit, it is replaced (amended and force-updated) instead of
// stacking a new commit on top of it.
async function commitLocaleFiles({
  owner,
  repo,
  branch,
  paths,
  locales: values,
}: LocaleCommit) {
  const client = github()
  const ref = `heads/${branch}`
  const { data: branchRef } = await client.rest.git.getRef({ owner, repo, ref })
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
    tree: locales.map((locale) => ({
      path: paths[locale],
      mode: "100644" as const,
      type: "blob" as const,
      content: `${JSON.stringify(values[locale], null, 2)}\n`,
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
  const client = github()
  const { data: repository } = await client.rest.repos.get({ owner, repo })
  const { data: baseBranch } = await client.rest.repos.getBranch({
    owner,
    repo,
    branch: repository.default_branch,
  })

  await client.rest.git.createRef({
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
  const { data } = await github().rest.pulls.create({
    owner,
    repo,
    title: `Update translations (${branch})`,
    head: branch,
    base: baseBranch,
    body: "Translation updates submitted from the locale editor.",
  })

  return {
    url: data.html_url,
    number: data.number,
    title: data.title,
    createdAt: data.created_at,
  }
}

export function updateLocaleBranch(localeCommit: LocaleCommit) {
  return commitLocaleFiles(localeCommit)
}
