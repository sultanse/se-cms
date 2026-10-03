import { useState, type ComponentProps } from "react"
import {
  CheckIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  CircleXIcon,
  ExternalLinkIcon,
  GitBranchIcon,
  GitMergeIcon,
  GitPullRequestIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react"
import { useStore } from "@tanstack/react-store"
import { useTranslation } from "react-i18next"

import { useLanguage } from "@/hooks/use-language"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import {
  cancelPlatformEditing,
  githubStore,
  refreshPullRequestStatus,
  startPlatformEditing,
  submitPlatformPullRequest,
  type Platform,
} from "@/stores/github-store"
import {
  applyEdits,
  collectEntries,
  readDraft,
  translationEditorStore,
} from "@/stores/translation-editor-store"

type StepState = "done" | "current" | "pending"

type Step = {
  label: string
  description: string
  state: StepState
  // Shows a check instead of the step number on the current step.
  reached?: boolean
}

function StatusBadge({ platform }: { platform: Platform }) {
  const { t } = useTranslation()

  switch (platform.pullRequestStatus) {
    case "open":
      return (
        <Badge variant="secondary">{t("translationEditor.statusOpen")}</Badge>
      )
    case "approved":
      return (
        <Badge>
          <CheckIcon />
          {t("translationEditor.statusApproved")}
        </Badge>
      )
    case "merged":
      return (
        <Badge>
          <GitMergeIcon />
          {t("translationEditor.statusMerged")}
        </Badge>
      )
    case "closed":
      return (
        <Badge variant="destructive">
          {t("translationEditor.statusClosed")}
        </Badge>
      )
    default:
      return platform.branchName ? (
        <Badge variant="outline">
          {t("translationEditor.statusNotOpened")}
        </Badge>
      ) : null
  }
}

// Slides open and closed below lg; from lg up the content always shows.
function Collapse({
  open,
  className,
  innerClassName,
  children,
  ...props
}: ComponentProps<"div"> & { open: boolean; innerClassName?: string }) {
  return (
    <div
      className={cn(
        "grid grid-rows-[1fr] transition-[grid-template-rows,opacity,visibility] duration-200 ease-out motion-reduce:transition-none",
        !open && "max-lg:invisible max-lg:grid-rows-[0fr] max-lg:opacity-0",
        className
      )}
      {...props}
    >
      <div className={cn("min-h-0 overflow-hidden", innerClassName)}>
        {children}
      </div>
    </div>
  )
}

function Timeline({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col px-5 py-4">
      {steps.map(({ label, description, state, reached }, index) => {
        const last = index === steps.length - 1
        return (
          <li
            key={index}
            aria-current={state === "current" ? "step" : undefined}
            className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2.5"
          >
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "grid size-5 flex-none place-items-center rounded-full border bg-card text-[11px] font-semibold",
                  state === "done" &&
                    "border-primary bg-primary text-primary-foreground",
                  state === "current" &&
                    "border-primary text-primary ring-2 ring-primary/20"
                )}
              >
                {state === "done" || reached ? (
                  <CheckIcon className="size-3" strokeWidth={2.5} />
                ) : (
                  index + 1
                )}
              </span>
              {!last && (
                <span
                  className={cn(
                    "min-h-4.5 w-px flex-1",
                    state === "done" ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </div>
            <div className={cn("flex flex-col", !last && "pb-3.5")}>
              <span
                className={cn(
                  "text-xs font-medium",
                  state === "current" && "font-semibold text-primary"
                )}
              >
                {label}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {description}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function PullRequestPanel({ busy = false }: { busy?: boolean }) {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const platformId = useStore(
    translationEditorStore,
    (state) => state.platformId
  )
  const edits = useStore(translationEditorStore, (state) => state.edits)
  const platforms = useStore(githubStore, (state) => state.platforms)
  const sessionLoadingPlatformId = useStore(
    githubStore,
    (state) => state.sessionLoadingPlatformId
  )
  const [refreshing, setRefreshing] = useState(false)
  // Below lg the panel sits above the table, so its details start collapsed.
  const [expanded, setExpanded] = useState(false)

  const platform = platforms.find(({ id }) => id === platformId) ?? platforms[0]
  const editedKeys = Object.keys(edits)
  const editCount = editedKeys.length
  const sessionLoading = sessionLoadingPlatformId === platform.id
  const editingSessionActive = platform.branchName !== null
  const status = platform.pullRequestStatus
  const hasPullRequest = platform.pullRequestNumber !== null

  const startEditing = async () => {
    try {
      await startPlatformEditing(platform.id)
      const latestPlatform =
        githubStore.state.platforms.find(({ id }) => id === platform.id) ??
        platform
      const draft = readDraft(latestPlatform)
      translationEditorStore.setState((state) => ({
        ...state,
        savedDraft: draft,
        edits: draft,
        draftInitialized: true,
      }))
    } catch (error) {
      console.error("Could not start the editing session:", error)
    }
  }

  const cancelEditing = () => {
    cancelPlatformEditing(platform.id)
    translationEditorStore.setState((state) => ({
      ...state,
      savedDraft: {},
      edits: {},
    }))
  }

  const discardEdits = () => {
    translationEditorStore.setState((state) => ({ ...state, edits: {} }))
  }

  const submitEdits = async () => {
    if (!editingSessionActive || editCount === 0) return

    const latestPlatform =
      githubStore.state.platforms.find(({ id }) => id === platform.id) ??
      platform

    try {
      await submitPlatformPullRequest(platform.id, {
        ar: applyEdits(latestPlatform.locales.ar, edits, "ar"),
        en: applyEdits(latestPlatform.locales.en, edits, "en"),
      })
      const refetchedPlatform =
        githubStore.state.platforms.find(({ id }) => id === platform.id) ??
        latestPlatform
      const savedValues = new Map(
        collectEntries(refetchedPlatform).map((entry) => [entry.key, entry])
      )
      // Keep only edits the refetched files don't already contain.
      const remainingEdits = Object.fromEntries(
        Object.entries(edits).filter(([key, values]) => {
          const saved = savedValues.get(key)
          return saved?.ar !== values.ar || saved?.en !== values.en
        })
      )
      translationEditorStore.setState((state) => ({
        ...state,
        savedDraft: remainingEdits,
        edits: remainingEdits,
      }))
    } catch (error) {
      console.error("Could not submit the translation pull request:", error)
    }
  }

  const refreshStatus = async () => {
    setRefreshing(true)
    try {
      await refreshPullRequestStatus(platform.id)
    } catch (error) {
      console.error("Could not refresh the pull request status:", error)
    } finally {
      setRefreshing(false)
    }
  }

  const openedAt = platform.pullRequestCreatedAt
    ? new Intl.DateTimeFormat(language === "ar" ? "ar-u-nu-latn" : "en", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(platform.pullRequestCreatedAt))
    : ""

  const steps: Step[] = [
    hasPullRequest
      ? {
          label: t("translationEditor.stepOpened"),
          description: openedAt,
          state: "done",
        }
      : {
          label: t("translationEditor.stepOpen"),
          description: t("translationEditor.stepOpenDescription"),
          state: "current",
        },
    status === "approved" || status === "merged"
      ? {
          label: t("translationEditor.stepApproved"),
          description: t("translationEditor.stepApprovedDescription"),
          state: status === "merged" ? "done" : "current",
          reached: true,
        }
      : {
          label: t("translationEditor.stepAwaitingApproval"),
          description: t("translationEditor.stepAwaitingApprovalDescription"),
          state: status === "open" ? "current" : "pending",
        },
    status === "merged"
      ? {
          label: t("translationEditor.stepMerged"),
          description: t("translationEditor.stepMergedDescription"),
          state: "done",
        }
      : {
          label: t("translationEditor.stepPublish"),
          description: t("translationEditor.stepPublishDescription"),
          state: "pending",
        },
  ]

  const openInGithub = platform.pullRequestUrl && (
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      render={
        <a href={platform.pullRequestUrl} target="_blank" rel="noreferrer" />
      }
      nativeButton={false}
    >
      <ExternalLinkIcon data-icon="inline-start" />
      {t("translationEditor.openInGithub")}
    </Button>
  )

  return (
    <aside
      id="pull-request-panel"
      aria-labelledby="pull-request-panel-title"
      className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card lg:sticky lg:top-(--sticky-top) lg:col-start-2 lg:row-start-2 lg:max-h-(--sticky-max-h) xl:col-start-3 xl:row-start-1"
    >
      <div className="flex flex-col gap-2.5 border-b border-divider px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <h2
            id="pull-request-panel-title"
            className="text-[15px] font-semibold"
          >
            {t("translationEditor.pullRequest")}
          </h2>
          <div className="flex items-center gap-1">
            <StatusBadge platform={platform} />
            {hasPullRequest && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={refreshStatus}
                disabled={refreshing}
                aria-label={t("translationEditor.refreshStatus")}
                title={t("translationEditor.refreshStatus")}
              >
                <RefreshCwIcon className={cn(refreshing && "animate-spin")} />
              </Button>
            )}
            {(hasPullRequest || editingSessionActive) && (
              <Button
                variant="ghost"
                size="icon-xs"
                className="lg:hidden"
                onClick={() => setExpanded((value) => !value)}
                aria-expanded={expanded}
                aria-controls="pull-request-details"
                aria-label={
                  expanded
                    ? t("translationEditor.hideDetails")
                    : t("translationEditor.showDetails")
                }
                title={
                  expanded
                    ? t("translationEditor.hideDetails")
                    : t("translationEditor.showDetails")
                }
              >
                <ChevronDownIcon
                  className={cn(
                    "transition-transform",
                    expanded && "rotate-180"
                  )}
                />
              </Button>
            )}
          </div>
        </div>
        {(hasPullRequest || editingSessionActive) && (
          <div dir="ltr" className="flex flex-col gap-0.5 text-start">
            {hasPullRequest && (
              <span className="text-[13px] font-medium [overflow-wrap:anywhere]">
                <span className="text-muted-foreground">
                  #{platform.pullRequestNumber}
                </span>{" "}
                {platform.pullRequestTitle}
              </span>
            )}
            {editingSessionActive && (
              <span className="text-[11px] [overflow-wrap:anywhere] text-muted-foreground">
                {platform.branchName}
                {platform.baseBranch && ` → ${platform.baseBranch}`}
              </span>
            )}
          </div>
        )}
        {!hasPullRequest && !editingSessionActive && (
          <p className="text-xs leading-relaxed text-pretty text-muted-foreground">
            {t("translationEditor.noSessionDescription")}
          </p>
        )}
      </div>

      {status === "closed" ? (
        <div className="flex gap-2 px-5 py-4">
          <CircleXIcon className="mt-0.5 size-4 flex-none text-destructive" />
          <span className="text-xs leading-relaxed text-muted-foreground">
            {t("translationEditor.workflowClosed")}
          </span>
        </div>
      ) : (
        (hasPullRequest || editingSessionActive) && (
          <Collapse id="pull-request-details" open={expanded}>
            <Timeline steps={steps} />
          </Collapse>
        )
      )}

      <div className="flex min-h-0 flex-col gap-3 border-t border-divider bg-muted px-5 py-4">
        {editingSessionActive ? (
          <>
            <div className="flex gap-2">
              <CircleAlertIcon className="mt-0.5 size-4 flex-none text-primary" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold">
                  {editCount > 0
                    ? t("translationEditor.unsentEdits", { count: editCount })
                    : t("translationEditor.noUnsentEdits")}
                </span>
                <Collapse open={expanded}>
                  <span className="block text-xs leading-relaxed text-pretty text-muted-foreground">
                    {editCount === 0
                      ? t("translationEditor.noUnsentEditsDescription")
                      : hasPullRequest
                        ? t("translationEditor.unsentEditsToPullRequest")
                        : t("translationEditor.unsentEditsNoPullRequest")}
                  </span>
                </Collapse>
              </div>
            </div>
            {editCount > 0 && (
              // The negative margin cancels the footer gap while collapsed.
              <Collapse open={expanded} className="-mt-3" innerClassName="pt-3">
                <ul
                  dir="ltr"
                  aria-label={t("translationEditor.editedKeys")}
                  className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-lg border border-divider bg-card px-2.5 py-2 text-xs"
                >
                  {editedKeys.map((key) => (
                    <li key={key} className="truncate" title={key}>
                      {key}
                    </li>
                  ))}
                </ul>
              </Collapse>
            )}
            <Button
              className="w-full"
              onClick={submitEdits}
              disabled={busy || editCount === 0}
            >
              {sessionLoading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <GitPullRequestIcon data-icon="inline-start" />
              )}
              {sessionLoading
                ? t("translationEditor.sendingEdits")
                : hasPullRequest
                  ? t("translationEditor.sendEditsToPullRequest")
                  : t("translationEditor.sendEditsOpenPullRequest")}
            </Button>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-2">
              {openInGithub || (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={cancelEditing}
                  disabled={busy}
                >
                  <XIcon data-icon="inline-start" />
                  {t("translationEditor.cancelEditing")}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={discardEdits}
                disabled={busy || editCount === 0}
              >
                <RotateCcwIcon data-icon="inline-start" />
                {t("translationEditor.discardEdits")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <Button className="w-full" onClick={startEditing} disabled={busy}>
              {sessionLoading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <GitBranchIcon data-icon="inline-start" />
              )}
              {sessionLoading
                ? t("translationEditor.startingEditing")
                : hasPullRequest
                  ? t("translationEditor.startNewEditing")
                  : t("translationEditor.startEditing")}
            </Button>
            {openInGithub}
          </>
        )}
      </div>
    </aside>
  )
}

export default PullRequestPanel
