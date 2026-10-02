import { createStore } from "@tanstack/react-store"

type GithubUser = {
  login: string
  avatar_url: string
}

type DeviceCode = {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

type GithubAuthState = {
  accessToken: string
  user: GithubUser | null
  deviceCode: DeviceCode | null
  loading: boolean
  error: string | null
}

const accessTokenKey = "github-user-access-token"
const userKey = "github-user"

function readStoredUser() {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(userKey) ?? "null")
    return value !== null && typeof value === "object" ? (value as GithubUser) : null
  } catch {
    return null
  }
}

export const githubAuthStore = createStore<GithubAuthState>({
  accessToken: localStorage.getItem(accessTokenKey) ?? "",
  user: readStoredUser(),
  deviceCode: null,
  loading: false,
  error: null,
})

export function getGithubAccessToken() {
  return githubAuthStore.state.accessToken
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

async function githubJson<T>(url: string, options: RequestInit) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.headers ?? {}),
    },
  })
  const payload: unknown = await response.json()
  if (!response.ok) {
    const message =
      payload !== null && typeof payload === "object" && "error_description" in payload
        ? String(payload.error_description)
        : "GitHub authentication failed"
    throw new Error(message)
  }
  return payload as T
}

export async function startGithubDeviceLogin() {
  const clientId = import.meta.env.GITHUB_APP_CLIENT_ID
  if (!clientId) throw new Error("GITHUB_APP_CLIENT_ID is not configured")

  githubAuthStore.setState((state) => ({
    ...state,
    loading: true,
    error: null,
  }))

  try {
    const device = await githubJson<{
      device_code: string
      user_code: string
      verification_uri: string
      expires_in: number
      interval?: number
    }>("/github-oauth/device/code", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId }).toString(),
    })

    const deviceCode = {
      deviceCode: device.device_code,
      userCode: device.user_code,
      verificationUri: device.verification_uri,
      expiresIn: device.expires_in,
      interval: device.interval ?? 5,
    }
    githubAuthStore.setState((state) => ({ ...state, deviceCode }))

    const expiresAt = Date.now() + device.expires_in * 1000
    let interval = deviceCode.interval
    let token = ""

    while (Date.now() < expiresAt) {
      await wait(interval * 1000)
      const result = await fetch("/github-oauth/oauth/access_token", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          device_code: device.device_code,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }).toString(),
      })
      const payload = (await result.json()) as {
        access_token?: string
        error?: string
      }

      if (payload.access_token) {
        token = payload.access_token
        break
      }
      if (payload.error === "slow_down") interval += 5
      if (payload.error !== "authorization_pending" && payload.error !== "slow_down") {
        throw new Error(payload.error ?? "GitHub authentication failed")
      }
    }

    if (!token) throw new Error("GitHub authorization expired")

    const user = await githubJson<GithubUser>("https://api.github.com/user", {
      headers: { authorization: `Bearer ${token}` },
    })
    localStorage.setItem(accessTokenKey, token)
    localStorage.setItem(userKey, JSON.stringify(user))
    githubAuthStore.setState((state) => ({
      ...state,
      accessToken: token,
      user,
      deviceCode: null,
      loading: false,
    }))
  } catch (error) {
    githubAuthStore.setState((state) => ({
      ...state,
      loading: false,
      deviceCode: null,
      error: error instanceof Error ? error.message : "GitHub authentication failed",
    }))
  }
}

export function logoutGithub() {
  localStorage.removeItem(accessTokenKey)
  localStorage.removeItem(userKey)
  githubAuthStore.setState((state) => ({
    ...state,
    accessToken: "",
    user: null,
    deviceCode: null,
    error: null,
  }))
}
