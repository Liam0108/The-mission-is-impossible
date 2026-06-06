import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPct(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
}

export function formatR(value: number) {
  const fixed = Number.isFinite(value) ? value.toFixed(2) : "0.00";
  return `${value > 0 ? "+" : ""}${fixed}R`;
}

