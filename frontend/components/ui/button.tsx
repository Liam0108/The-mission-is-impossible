import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
};

export function Button({ className, variant = "secondary", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "focus-ring inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "border-transparent bg-ink text-canvas hover:opacity-90 dark:bg-ink dark:text-canvas",
        variant === "secondary" && "border-stroke bg-panel text-ink hover:bg-ink/5 dark:hover:bg-white/5",
        variant === "ghost" && "border-transparent bg-transparent text-muted hover:bg-ink/5 hover:text-ink dark:hover:bg-white/5",
        variant === "danger" && "border-transparent bg-danger text-white hover:opacity-90",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-10 px-4 text-sm",
        size === "icon" && "h-10 w-10",
        className
      )}
      {...props}
    />
  );
}

