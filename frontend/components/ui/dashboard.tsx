"use client";

import { AlertCircle, ChevronDown, Inbox, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DashboardCard({
  children,
  className,
  padding = "none"
}: {
  children: ReactNode;
  className?: string;
  padding?: "none" | "compact" | "default";
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-lg border border-stroke bg-panel shadow-soft",
        padding === "compact" && "p-3 sm:p-4",
        padding === "default" && "p-4 sm:p-5",
        className
      )}
    >
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  helper,
  icon,
  tone = "neutral"
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "positive" | "caution" | "danger";
}) {
  return (
    <DashboardCard className="p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
          <div
            className={cn(
              "mt-2 break-words text-2xl font-semibold text-ink",
              tone === "positive" && "text-positive",
              tone === "caution" && "text-caution",
              tone === "danger" && "text-danger"
            )}
          >
            {value}
          </div>
          {helper ? <div className="mt-1 break-words text-xs leading-5 text-muted">{helper}</div> : null}
        </div>
        {icon ? <div className="shrink-0 rounded-md border border-stroke bg-canvas p-2 text-muted">{icon}</div> : null}
      </div>
    </DashboardCard>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
  className
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "caution" | "danger";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 max-w-full items-center whitespace-normal break-words rounded-md border px-2.5 py-1 text-xs font-medium",
        tone === "neutral" && "border-stroke bg-canvas text-muted",
        tone === "positive" && "border-positive/30 bg-positive/10 text-positive",
        tone === "caution" && "border-caution/30 bg-caution/10 text-caution",
        tone === "danger" && "border-danger/30 bg-danger/10 text-danger",
        className
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeader({
  title,
  description,
  eyebrow,
  action,
  className
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="text-xs font-medium uppercase tracking-wide text-accent">{eyebrow}</div> : null}
        <h2 className="mt-1 break-words text-lg font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-1 max-w-3xl break-words text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      {action ? <div className="min-w-0 max-w-full sm:shrink-0">{action}</div> : null}
    </div>
  );
}

export function DataTableWrapper({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 overflow-x-auto rounded-lg border border-stroke [scrollbar-gutter:stable]", className)}>
      {children}
    </div>
  );
}

export function CollapsiblePanel({
  title,
  description,
  badge,
  defaultOpen = false,
  children,
  className,
  contentClassName
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <details className={cn("group min-w-0 overflow-hidden rounded-lg border border-stroke bg-panel shadow-soft", className)} open={defaultOpen}>
      <summary className="focus-ring flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-4 marker:hidden sm:px-5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="break-words text-sm font-semibold text-ink">{title}</div>
          {description ? <div className="mt-1 break-words text-xs leading-5 text-muted">{description}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge}
          <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
        </div>
      </summary>
      <div className={cn("min-w-0 border-t border-stroke p-3 sm:p-5", contentClassName)}>{children}</div>
    </details>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid min-h-40 place-items-center rounded-lg border border-dashed border-stroke bg-canvas p-6 text-center", className)}>
      <div className="max-w-md">
        <Inbox className="mx-auto h-5 w-5 text-muted" />
        <div className="mt-3 text-sm font-semibold text-ink">{title}</div>
        <div className="mt-1 text-sm leading-6 text-muted">{description}</div>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

export function LoadingState({ label = "Loading data..." }: { label?: string }) {
  return (
    <div className="flex min-h-24 items-center justify-center gap-2 rounded-lg border border-stroke bg-canvas text-sm text-muted">
      <LoaderCircle className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({
  title = "Something needs attention",
  description,
  action
}: {
  title?: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink">{title}</div>
        <div className="mt-1 break-words text-sm leading-6 text-muted">{description}</div>
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}
