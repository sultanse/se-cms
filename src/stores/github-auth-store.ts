import { createStore } from "@tanstack/react-store"

type GithubUser = {
  login: string
  avatar_url: string
}

type DeviceCode = {
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

type GithubAuthState = {
  user: GithubUser | null
  deviceCode: DeviceCode | null
  loading: boolean
  error: string | null
}

// The GitHub token lives in an HttpOnly cookie set by the Worker; only the
// user's public profile is cached here so the UI can render before /api/auth/me.
const userKey = "github-user"
localStorage.removeItem("github-user-access-token")

function readStoredUser() {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(userKey) ?? "null")
    return value !== null && typeof value === "object"
      ? (value as GithubUser)
      : null
  } catch {
    return null
  }
}

export const githubAuthStore = createStore<GithubAuthState>({
  user: readStoredUser(),
  deviceCode: null,
  loading: false,
  error: null,
})

function setUser(user: GithubUser | null) {
  if (user) localStorage.setItem(userKey, JSON.stringify(user))
  else localStorage.removeItem(userKey)
  githubAuthStore.setState((state) => ({ ...state, user }))
}

// Calls the Worker's /api routes. A 401 means the session cookie is missing or
// the GitHub token was revoked, so the user is signed out.
export async function githubApi<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    path,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
  )
  const payload: unknown = await response.json().catch(() => null)
  if (response.status === 401) setUser(null)
  if (!response.ok) {
    const message =
      payload !== null && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : `GitHub request failed (${response.status})`
    throw new Error(message)
  }
  return payload as T
}

githubApi<{ user: GithubUser }>("/api/auth/me").then(
  ({ user }) => setUser(user),
  // Already signed out by githubApi on 401; keep the cached user if the Worker is unreachable
  () => {}
)

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

type PollResult =
  | { status: "authorization_pending" | "slow_down" }
  | { status: "complete"; user: GithubUser }

export async function startGithubDeviceLogin() {
  githubAuthStore.setState((state) => ({
    ...state,
    loading: true,
    error: null,
  }))

  try {
    const deviceCode = await githubApi<DeviceCode>("/api/auth/device", {})
    githubAuthStore.setState((state) => ({ ...state, deviceCode }))

    const expiresAt = Date.now() + deviceCode.expiresIn * 1000
    let interval = deviceCode.interval
    let user: GithubUser | null = null

    while (Date.now() < expiresAt) {
      await wait(interval * 1000)
      const result = await githubApi<PollResult>("/api/auth/poll", {})

      if (result.status === "complete") {
        user = result.user
        break
      }
      if (result.status === "slow_down") interval += 5
    }

    if (!user) throw new Error("GitHub authorization expired")

    setUser(user)
    githubAuthStore.setState((state) => ({
      ...state,
      deviceCode: null,
      loading: false,
    }))
  } catch (error) {
    githubAuthStore.setState((state) => ({
      ...state,
      loading: false,
      deviceCode: null,
      error:
        error instanceof Error ? error.message : "GitHub authentication failed",
    }))
  }
}

export function logoutGithub() {
  void githubApi("/api/auth/logout", {}).catch(() => {})
  setUser(null)
  githubAuthStore.setState((state) => ({
    ...state,
    deviceCode: null,
    error: null,
  }))
}
