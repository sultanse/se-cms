import { useState } from "react"
import { CheckIcon, RefreshCwIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PullRequestStatus } from "@/stores/github-store"

export type OverviewSectionProps = {
  textValues: number
  sectionsCount: number
  visibleResults: number
  unsavedValues: number
  pullRequestStatus: PullRequestStatus | null
  onRefreshStatus?: () => Promise<void>
}

const activeStageIndex: Record<PullRequestStatus, number> = {
  open: 0,
  approved: 1,
  merged: 2,
  closed: -1,
}

function OverviewSection({
  textValues,
  sectionsCount,
  visibleResults,
  unsavedValues,
  pullRequestStatus,
  onRefreshStatus,
}: OverviewSectionProps) {
  const { t } = useTranslation()
  const [refreshing, setRefreshing] = useState(false)
  const activeIndex = pullRequestStatus
    ? activeStageIndex[pullRequestStatus]
    : -1

  const refreshStatus = async () => {
    if (!onRefreshStatus) return
    setRefreshing(true)
    try {
      await onRefreshStatus()
    } catch (error) {
      console.error("Could not refresh the pull request status:", error)
    } finally {
      setRefreshing(false)
    }
  }
  const stats = [
    { label: t("translationEditor.textValues"), value: textValues },
    { label: t("translationEditor.sectionsCount"), value: sectionsCount },
    {
      label: t("translationEditor.visibleResultsLabel"),
      value: visibleResults,
    },
    { label: t("translationEditor.unsavedValues"), value: unsavedValues },
  ]

  const workflowStages = [
    {
      id: "submitting",
      label: t("translationEditor.workflowSubmittingLabel"),
      description: t("translationEditor.workflowSubmitting"),
    },
    {
      id: "approved",
      label: t("translationEditor.workflowApprovedLabel"),
      description: t("translationEditor.workflowApproved"),
    },
    {
      id: "publishing",
      label: t("translationEditor.workflowPublishingLabel"),
      description: t("translationEditor.workflowPublishing"),
    },
  ]

  return (
    <section
      id="overview-section"
      className="overflow-hidden rounded-[14px] border bg-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[15px] font-semibold">
            {t("translationEditor.overview")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("translationEditor.overviewDescription")}
          </p>
        </div>
        <dl className="flex flex-wrap items-center">
          {stats.map(({ label, value }) => (
            <div
              key={label}
              className="flex flex-col-reverse gap-1 border-s px-4 py-0.5"
            >
              <dd className="text-xl leading-tight font-semibold tracking-tight tabular-nums">
                {value}
              </dd>
              <dt className="text-xs text-muted-foreground">{label}</dt>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t bg-muted px-5 py-3">
        <span className="flex-none text-xs font-semibold">
          {t("translationEditor.workflowTitle")}
        </span>
        <ol className="grid min-w-0 flex-1 gap-2 sm:grid-cols-3">
          {workflowStages.map(({ id, label, description }, index) => {
            const done = index < activeIndex
            const active = index === activeIndex
            return (
              <li
                key={id}
                title={description}
                aria-current={active ? "step" : undefined}
                className="flex min-w-0 items-center gap-2"
              >
                <span
                  className={cn(
                    "grid size-5 flex-none place-items-center rounded-full border bg-background text-[11px] font-semibold",
                    done && "border-primary bg-primary text-primary-foreground",
                    active &&
                      "border-primary text-primary ring-2 ring-primary/20"
                  )}
                >
                  {done ? <CheckIcon className="size-3" /> : index + 1}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span
                    className={cn(
                      "text-start text-xs font-medium",
                      active && "font-semibold text-primary"
                    )}
                  >
                    {label}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {description}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
        {pullRequestStatus === "closed" && (
          <span className="text-[11px] text-muted-foreground">
            {t("translationEditor.workflowClosed")}
          </span>
        )}
        {onRefreshStatus && (
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
      </div>
    </section>
  )
}

export default OverviewSection
