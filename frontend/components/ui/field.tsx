import * as React from "react";
import { cn } from "@/lib/utils";

type FieldProps = React.HTMLAttributes<HTMLLabelElement> & {
  label: string;
  helper?: string;
};

export function Field({ label, helper, className, children, ...props }: FieldProps) {
  return (
    <label className={cn("grid min-w-0 gap-1.5 text-xs font-medium uppercase tracking-normal text-muted", className)} {...props}>
      <span className="flex min-w-0 items-center gap-1 break-words">
        {label}
        {helper ? (
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-stroke text-[10px] normal-case text-muted" title={helper}>
            ?
          </span>
        ) : null}
      </span>
      {children}
      {helper ? <span className="break-words text-[11px] normal-case leading-4 text-muted">{helper}</span> : null}
    </label>
  );
}
