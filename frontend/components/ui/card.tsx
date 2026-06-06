import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 rounded-lg border border-stroke bg-panel shadow-soft", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-w-0 flex-wrap items-start justify-between gap-3 border-b border-stroke p-4 sm:p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("min-w-0 break-words text-base font-semibold text-ink", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 p-4 sm:p-5", className)} {...props} />;
}
