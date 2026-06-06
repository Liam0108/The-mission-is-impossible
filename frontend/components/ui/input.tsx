import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "focus-ring h-10 min-w-0 w-full rounded-lg border border-stroke bg-panel px-3 text-sm text-ink placeholder:text-muted",
        className
      )}
      {...props}
    />
  );
}
