import { cn } from "@/lib/utils";

type SegmentedControlProps = {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  compact?: boolean;
  getOptionLabel?: (option: string) => string;
};

export function SegmentedControl({ value, options, onChange, compact, getOptionLabel }: SegmentedControlProps) {
  return (
    <div className="grid min-h-10 grid-flow-col overflow-hidden rounded-lg border border-stroke bg-canvas p-1">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "focus-ring rounded-md px-3 text-sm font-medium text-muted transition",
            compact && "px-2 text-xs",
            value === option && "bg-panel text-ink shadow-sm"
          )}
        >
          {getOptionLabel ? getOptionLabel(option) : option}
        </button>
      ))}
    </div>
  );
}
