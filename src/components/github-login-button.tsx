import { CheckIcon, CopyIcon, LogOutIcon } from "lucide-react"
import { useStore } from "@tanstack/react-store"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  githubAuthStore,
  logoutGithub,
  startGithubDeviceLogin,
} from "@/stores/github-auth-store"

function GithubMark() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M8 0C3.58 0 0 3.64 0 8.13c0 3.59 2.29 6.63 5.47 7.7.4.08.55-.18.55-.39 0-.19-.01-.7-.01-1.37-2.01.45-2.43-.99-2.43-.99-.36-.94-.88-1.19-.88-1.19-.72-.5.05-.49.05-.49.8.06 1.22.84 1.22.84.71 1.24 1.87.88 2.33.67.07-.52.28-.88.5-1.08-1.78-.21-3.65-.91-3.65-4.02 0-.89.31-1.62.82-2.19-.08-.21-.36-1.04.08-2.16 0 0 .67-.22 2.2.84a7.45 7.45 0 0 1 4 0c1.53-1.06 2.2-.84 2.2-.84.44 1.12.16 1.95.08 2.16.51.57.82 1.3.82 2.19 0 3.12-1.87 3.81-3.65 4.02.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.19 0 .21.15.47.55.39A8.14 8.14 0 0 0 16 8.13C16 3.64 12.42 0 8 0Z" />
    </svg>
  )
}

function GithubLoginButton() {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const { accessToken, user, deviceCode, loading, error } = useStore(
    githubAuthStore,
    (state) => state
  )

  if (accessToken && user) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {user.login}
        </span>
        <Button variant="outline" size="sm" onClick={logoutGithub}>
          <LogOutIcon data-icon="inline-start" />
          <span className="hidden sm:inline">GitHub</span>
        </Button>
      </div>
    )
  }

  if (deviceCode) {
    const copyDeviceCode = async () => {
      await navigator.clipboard.writeText(deviceCode.userCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }

    return (
      <div className="flex w-full max-w-md flex-col gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-11 w-full justify-between px-3 font-mono text-base tracking-wider"
          onClick={() => void copyDeviceCode()}
          aria-label={t("translationEditor.copyCode")}
        >
          <span>{deviceCode.userCode}</span>
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
        <div className="flex items-center justify-between gap-3 px-1">
          <a
            href={deviceCode.verificationUri}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("translationEditor.openGithub")}
          </a>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void startGithubDeviceLogin()}
            disabled={loading}
          >
            {loading
              ? t("translationEditor.waiting")
              : t("translationEditor.retry")}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        className="border-[#1f2328] bg-[#24292f] text-white shadow-sm hover:border-[#1f2328] hover:bg-[#1f2328] hover:text-white"
        onClick={() => void startGithubDeviceLogin()}
        disabled={loading}
      >
        <GithubMark />
        {loading
          ? t("translationEditor.connecting")
          : t("translationEditor.loginWithGithub")}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}

export default GithubLoginButton
