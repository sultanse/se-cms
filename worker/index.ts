import { Octokit, RequestError } from "octokit"

type Env = {
  GITHUB_APP_CLIENT_ID: string
  SESSION_SECRET: string
}

type GithubUser = {
  login: string
  avatar_url: string
}

type Session = { token: string; user: GithubUser; exp: number }
type DeviceLogin = { deviceCode: string; exp: number }

class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// --- Responses & cookies ---------------------------------------------------

const sessionCookie = "gh_session"
const deviceCookie = "gh_device"
const sessionMaxAge = 30 * 24 * 60 * 60

function json(body: unknown, status = 200, cookies: string[] = []) {
  const headers = new Headers({
    "content-type": "application/json",
    "cache-control": "no-store",
  })
  for (const cookie of cookies) headers.append("set-cookie", cookie)
  return new Response(JSON.stringify(body), { status, headers })
}

function setCookie(name: string, value: string, maxAge: number) {
  return `${name}=${value}; Path=/api; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`
}

function clearCookie(name: string) {
  return setCookie(name, "", 0)
}

function readCookie(request: Request, name: string) {
  for (const part of request.headers.get("cookie")?.split(";") ?? []) {
    const [key, ...value] = part.trim().split("=")
    if (key === name) return value.join("=")
  }
  return null
}

// Cookies are AES-GCM sealed with a key derived from SESSION_SECRET, so the
// browser can neither read the GitHub token nor forge a session.
async function cookieKey(secret: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret)
  )
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ])
}

function toBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function fromBase64Url(value: string) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function seal(value: { exp: number }, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await cookieKey(secret),
    new TextEncoder().encode(JSON.stringify(value))
  )
  const sealed = new Uint8Array(iv.length + ciphertext.byteLength)
  sealed.set(iv)
  sealed.set(new Uint8Array(ciphertext), iv.length)
  return toBase64Url(sealed)
}

async function unseal<T extends { exp: number }>(
  value: string | null,
  secret: string
): Promise<T | null> {
  if (!value) return null
  try {
    const sealed = fromBase64Url(value)
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: sealed.slice(0, 12) },
      await cookieKey(secret),
      sealed.slice(12)
    )
    const payload = JSON.parse(new TextDecoder().decode(plaintext)) as T
    return payload.exp > Date.now() ? payload : null
  } catch {
    return null
  }
}

function readSession(request: Request, env: Env) {
  return unseal<Session>(readCookie(request, sessionCookie), env.SESSION_SECRET)
}

// --- Device-flow login -----------------------------------------------------

async function githubLogin<T>(path: string, params: Record<string, string>) {
  const response = await fetch(`https://github.com/login${path}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  })
  const payload = (await response.json()) as T & {
    error?: string
    error_description?: string
  }
  if (!response.ok) {
    throw new HttpError(
      502,
      payload.error_description ?? "GitHub authentication failed"
    )
  }
  return payload
}

async function startDeviceLogin(env: Env) {
  const device = await githubLogin<{
    device_code: string
    user_code: string
    verification_uri: string
    expires_in: number
    interval?: number
  }>("/device/code", { client_id: env.GITHUB_APP_CLIENT_ID })

  const login: DeviceLogin = {
    deviceCode: device.device_code,
    exp: Date.now() + device.expires_in * 1000,
  }
  return json(
    {
      userCode: device.user_code,
      verificationUri: device.verification_uri,
      expiresIn: device.expires_in,
      interval: device.interval ?? 5,
    },
    200,
    [
      setCookie(
        deviceCookie,
        await seal(login, env.SESSION_SECRET),
        device.expires_in
      ),
    ]
  )
}

async function pollDeviceLogin(request: Request, env: Env) {
  const login = await unseal<DeviceLogin>(
    readCookie(request, deviceCookie),
    env.SESSION_SECRET
  )
  if (!login) throw new HttpError(400, "GitHub authorization expired")

  const payload = await githubLogin<{
    access_token?: string
    expires_in?: number
  }>("/oauth/access_token", {
    client_id: env.GITHUB_APP_CLIENT_ID,
    device_code: login.deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  })

  if (
    payload.error === "authorization_pending" ||
    payload.error === "slow_down"
  ) {
    return json({ status: payload.error })
  }
  if (!payload.access_token) {
    return json(
      {
        error:
          payload.error_description ??
          payload.error ??
          "GitHub authentication failed",
      },
      400,
      [clearCookie(deviceCookie)]
    )
  }

  const { data } = await new Octokit({
    auth: payload.access_token,
  }).rest.users.getAuthenticated()
  const user = { login: data.login, avatar_url: data.avatar_url }
  // GitHub App user tokens expire (usually after 8 hours); match the cookie to it.
  const maxAge = payload.expires_in ?? sessionMaxAge
  const session: Session = {
    token: payload.access_token,
    user,
    exp: Date.now() + maxAge * 1000,
  }

  return json({ status: "complete", user }, 200, [
    setCookie(sessionCookie, await seal(session, env.SESSION_SECRET), maxAge),
    clearCookie(deviceCookie),
  ])
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

      const bytes = fromBase64Url(data.content.replace(/\n/g, ""))
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

  if (request.method === "GET" && pathname === "/api/auth/me") {
    const session = await readSession(request, env)
    return session
      ? json({ user: session.user })
      : json({ error: "Not signed in" }, 401, [clearCookie(sessionCookie)])
  }

  if (request.method !== "POST") throw new HttpError(404, "Not found")
  // Cross-site forms can't send JSON, so this plus SameSite=Lax blocks CSRF
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new HttpError(415, "Expected a JSON request")
  }

  if (pathname === "/api/auth/device") return startDeviceLogin(env)
  if (pathname === "/api/auth/poll") return pollDeviceLogin(request, env)
  if (pathname === "/api/auth/logout") {
    return json(null, 200, [
      clearCookie(sessionCookie),
      clearCookie(deviceCookie),
    ])
  }

  const action = pathname.match(/^\/api\/github\/(\w+)$/)?.[1]
  if (!action || !Object.hasOwn(actions, action)) {
    throw new HttpError(404, "Not found")
  }

  const session = await readSession(request, env)
  if (!session)
    throw new HttpError(401, "Sign in with GitHub before using the editor")

  const args: unknown = await request.json().catch(() => null)
  if (!isObject(args)) throw new HttpError(400, "Expected a JSON object")

  return json(await actions[action](new Octokit({ auth: session.token }), args))
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (!env.GITHUB_APP_CLIENT_ID || !env.SESSION_SECRET) {
        throw new HttpError(
          500,
          "GITHUB_APP_CLIENT_ID and SESSION_SECRET must be configured"
        )
      }
      return await route(request, env)
    } catch (error) {
      // An expired or revoked token ends the session
      if (
        (error instanceof RequestError || error instanceof HttpError) &&
        error.status === 401
      ) {
        return json({ error: error.message }, 401, [clearCookie(sessionCookie)])
      }
      if (error instanceof HttpError || error instanceof RequestError) {
        return json({ error: error.message }, error.status)
      }
      console.error(error)
      return json({ error: "Unexpected server error" }, 500)
    }
  },
}
