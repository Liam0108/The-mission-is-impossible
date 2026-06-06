import * as React from "react";
import { cn } from "@/lib/utils";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: readonly string[];
  getOptionLabel?: (option: string) => string;
};

export function Select({ className, options, getOptionLabel, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "focus-ring h-10 min-w-0 w-full rounded-lg border border-stroke bg-panel px-3 text-sm text-ink",
        className
      )}
      {...props}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {getOptionLabel ? getOptionLabel(option) : option}
        </option>
      ))}
    </select>
  );
}
