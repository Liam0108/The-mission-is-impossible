import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "focus-ring min-h-24 w-full resize-y rounded-lg border border-stroke bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted",
        className
      )}
      {...props}
    />
  );
}

