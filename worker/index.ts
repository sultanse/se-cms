import { Octokit, RequestError } from "octokit"

// GITHUB_TOKEN is a fine-grained personal access token. Its repository
// selection and permissions (Contents and Pull requests: read and write) are
// the only limit on what the editor can reach.
type Env = {
  GITHUB_TOKEN: string
}

class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  })
}

function fromBase64(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

// --- Repository operations -------------------------------------------------

type Args = Record<string, unknown>
type TranslationLocale = "ar" | "en"
type JsonObject = { [key: string]: unknown }
type LocaleCommit = {
  owner: string
  repo: string
  branch: string
  paths: Record<TranslationLocale, string>
  locales: Record<TranslationLocale, JsonObject>
}

const locales = ["ar", "en"] as const

const translationPaths = (locale: TranslationLocale) => [
  `src/i18n/${locale}.json`,
  `src/i18n/locales/${locale}.json`,
]

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function readString(args: Args, key: string) {
  const value = args[key]
  if (typeof value !== "string" || !value) {
    throw new HttpError(400, `Missing "${key}"`)
  }
  return value
}

function readLocaleCommit(args: Args): LocaleCommit {
  const { paths, locales: values } = args
  if (!isObject(paths) || !isObject(values)) {
    throw new HttpError(400, "Missing locale paths or values")
  }
  for (const locale of locales) {
    // Only the translation files themselves may be written
    if (!translationPaths(locale).includes(paths[locale] as string)) {
      throw new HttpError(400, `Invalid path for ${locale}.json`)
    }
    if (!isObject(values[locale])) {
      throw new HttpError(400, `Invalid values for ${locale}.json`)
    }
  }
  return {
    owner: readString(args, "owner"),
    repo: readString(args, "repo"),
    branch: readString(args, "branch"),
    paths: paths as LocaleCommit["paths"],
    locales: values as LocaleCommit["locales"],
  }
}

async function getTranslationFile(
  client: Octokit,
  owner: string,
  repo: string,
  locale: TranslationLocale,
  ref?: string
) {
  for (const path of translationPaths(locale)) {
    try {
      const { data } = await client.rest.repos.getContent({
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
      if (isObject(json)) return { path, sha: data.sha, json }
    } catch (error) {
      if (error instanceof RequestError && error.status === 404) continue
      throw error
    }
  }

  throw new HttpError(404, `Could not find ${locale}.json in ${owner}/${repo}`)
}

const localeCommitMessage = "Update translations from the locale editor"

// Writes both locale files as one commit. When the branch tip is a previous
// locale-editor commit, it is replaced (amended and force-updated) instead of
// stacking a new commit on top of it.
async function commitLocaleFiles(
  client: Octokit,
  { owner, repo, branch, paths, locales: values }: LocaleCommit
) {
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

const actions: Record<
  string,
  (client: Octokit, args: Args) => Promise<unknown>
> = {
  // The token's owner, who authors every branch, commit and pull request
  async account(client) {
    const { data } = await client.rest.users.getAuthenticated()
    return { login: data.login, avatar_url: data.avatar_url }
  },

  // A fine-grained token lists only the repositories it was granted
  async repositories(client) {
    const { data } = await client.rest.repos.listForAuthenticatedUser({
      per_page: 100,
      page: 1,
      sort: "updated",
      direction: "desc",
    })
    return data.map(({ id, name, full_name, owner }) => ({
      id,
      name,
      full_name,
      owner: owner ? { login: owner.login } : null,
    }))
  },

  async locales(client, args) {
    const owner = readString(args, "owner")
    const repo = readString(args, "repo")
    const ref = typeof args.ref === "string" ? args.ref : undefined
    const [ar, en] = await Promise.all([
      getTranslationFile(client, owner, repo, "ar", ref),
      getTranslationFile(client, owner, repo, "en", ref),
    ])

    return {
      locales: { ar: ar.json, en: en.json },
      paths: { ar: ar.path, en: en.path },
    }
  },

  async findLocalePullRequest(client, args) {
    const owner = readString(args, "owner")
    const repo = readString(args, "repo")
    const { data: pullRequests } = await client.rest.pulls.list({
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
    }
  },

  async pullRequestStatus(client, args) {
    const owner = readString(args, "owner")
    const repo = readString(args, "repo")
    const pull_number = Number(args.pullNumber)
    if (!Number.isInteger(pull_number)) {
      throw new HttpError(400, 'Missing "pullNumber"')
    }

    const { data: pullRequest } = await client.rest.pulls.get({
      owner,
      repo,
      pull_number,
    })
    if (pullRequest.merged) return "merged"
    if (pullRequest.state === "closed") return "closed"

    const { data: reviews } = await client.rest.pulls.listReviews({
      owner,
      repo,
      pull_number,
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
  },

  async createLocaleBranch(client, args) {
    const owner = readString(args, "owner")
    const repo = readString(args, "repo")
    const branch = readString(args, "branch")
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

    return { baseBranch: repository.default_branch }
  },

  async createLocalePullRequest(client, args) {
    const localeCommit = readLocaleCommit(args)
    const baseBranch = readString(args, "baseBranch")
    await commitLocaleFiles(client, localeCommit)

    const { owner, repo, branch } = localeCommit
    const { data } = await client.rest.pulls.create({
      owner,
      repo,
      title: `Update translations (${branch})`,
      head: branch,
      base: baseBranch,
      body: "Translation updates submitted from the locale editor.",
    })

    return { url: data.html_url, number: data.number }
  },

  async updateLocaleBranch(client, args) {
    await commitLocaleFiles(client, readLocaleCommit(args))
    return null
  },
}

// --- Router ----------------------------------------------------------------

async function route(request: Request, env: Env) {
  const { pathname } = new URL(request.url)

  if (request.method !== "POST") throw new HttpError(404, "Not found")
  // Cross-site forms can't send JSON, so they can't trigger writes
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new HttpError(415, "Expected a JSON request")
  }

  const action = pathname.match(/^\/api\/github\/(\w+)$/)?.[1]
  if (!action || !Object.hasOwn(actions, action)) {
    throw new HttpError(404, "Not found")
  }

  const args: unknown = await request.json().catch(() => null)
  if (!isObject(args)) throw new HttpError(400, "Expected a JSON object")

  // The throttling plugin queues every client's requests in module-level
  // Bottleneck groups; the Workers runtime cancels a request that waits on
  // another request's promise, so concurrent calls would hang.
  const client = new Octokit({
    auth: env.GITHUB_TOKEN,
    throttle: { enabled: false },
  })
  return json(await actions[action](client, args))
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (!env.GITHUB_TOKEN) {
        throw new HttpError(500, "GITHUB_TOKEN must be configured")
      }
      return await route(request, env)
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) {
        return json(
          { error: "GITHUB_TOKEN is invalid, expired or revoked" },
          502
        )
      }
      if (error instanceof HttpError || error instanceof RequestError) {
        return json({ error: error.message }, error.status)
      }
      console.error(error)
      return json({ error: "Unexpected server error" }, 500)
    }
  },
}
