import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 max-w-full items-center justify-center break-words rounded-lg border border-stroke bg-canvas px-2.5 py-1 text-center text-xs font-medium text-muted",
        className
      )}
      {...props}
    />
  );
}
