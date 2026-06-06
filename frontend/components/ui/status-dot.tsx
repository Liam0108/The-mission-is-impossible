import { cn } from "@/lib/utils";

export function StatusDot({ tone = "muted" }: { tone?: "positive" | "caution" | "danger" | "muted" }) {
  return (
    <span
      className={cn(
        "h-2 w-2 rounded-full",
        tone === "positive" && "bg-positive",
        tone === "caution" && "bg-caution",
        tone === "danger" && "bg-danger",
        tone === "muted" && "bg-muted"
      )}
    />
  );
}

