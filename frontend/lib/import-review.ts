import type { Trade, TradePayload } from "@/lib/types";

export const IMPORTED_COMPLETENESS_FIELDS = [
  { key: "stop_loss", label: "Stop Loss" },
  { key: "setup_type", label: "Setup Type" },
  { key: "session", label: "Session" },
  { key: "regime_label", label: "Regime Label" },
  { key: "manual_quality", label: "Manual Quality" },
  { key: "notes", label: "Notes" }
] as const satisfies ReadonlyArray<{ key: keyof TradePayload; label: string }>;

export type ImportedCompletenessSummary = {
  totalImported: number;
  unreviewed: number;
  reviewed: number;
  missingStopLoss: number;
  missingSetupType: number;
  missingSession: number;
  missingRegimeLabel: number;
  missingManualQuality: number;
  missingNotes: number;
  withResultR: number;
  withoutResultR: number;
  rCompletionRate: number;
  missingRReasons: Array<{ reason: string; count: number }>;
};

function hasValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value);
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function finiteNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateImportedResultR(
  trade: Pick<TradePayload, "direction" | "entry_price" | "exit_price">,
  stopLoss: number | null | undefined
) {
  const entry = finiteNumber(trade.entry_price);
  const exit = finiteNumber(trade.exit_price);
  const stop = finiteNumber(stopLoss);
  if (entry === null || exit === null || stop === null) return null;
  const risk = Math.abs(entry - stop);
  if (!risk) return null;
  const reward = trade.direction === "Long" ? exit - entry : entry - exit;
  return Number((reward / risk).toFixed(2));
}

export function importedTradeMissingFields(trade: Partial<TradePayload>, includeResultR = true) {
  const missing: string[] = IMPORTED_COMPLETENESS_FIELDS
    .filter(({ key }) => !hasValue(trade[key]))
    .map(({ label }) => label);
  if (includeResultR && finiteNumber(trade.result_r) === null) missing.push("Result R");
  return missing;
}

export function edgeLabEligibility(trade: Partial<TradePayload>) {
  const missing: string[] = [];
  if (trade.trade_decision !== "Taken") missing.push("Decision must be Taken");
  if (finiteNumber(trade.result_r) === null) missing.push("Result R");
  if (!hasValue(trade.setup_type)) missing.push("Setup Type");
  if (!hasValue(trade.session)) missing.push("Session");
  if (!hasValue(trade.manual_quality)) missing.push("Manual Quality");
  return { eligible: missing.length === 0, missing };
}

export function importedTradeCompleteness(trade: Partial<TradePayload>) {
  const missing = importedTradeMissingFields(trade);
  const total = IMPORTED_COMPLETENESS_FIELDS.length + 1;
  const completed = total - missing.length;
  const percent = Math.round((completed / total) * 100);
  const tone = missing.length === 0 ? "positive" : missing.length <= 2 ? "caution" : "danger";
  const label = missing.length === 0 ? "Complete" : `${percent}% complete`;
  return { missing, completed, total, percent, tone, label } as const;
}

export function missingRReason(trade: Partial<TradePayload>) {
  if (finiteNumber(trade.result_r) !== null) return null;
  if (finiteNumber(trade.stop_loss) === null) return "Missing stop loss";
  if (finiteNumber(trade.entry_price) === null) return "Missing entry price";
  if (finiteNumber(trade.exit_price) === null) return "Missing exit price";
  if (finiteNumber(trade.entry_price) === finiteNumber(trade.stop_loss)) return "Stop equals entry";
  return "R needs recalculation";
}

export function summarizeImportedTrades(trades: Trade[]): ImportedCompletenessSummary {
  const imported = trades.filter((trade) => trade.imported);
  const countMissing = (key: keyof TradePayload) => imported.filter((trade) => !hasValue(trade[key])).length;
  const withResultR = imported.filter((trade) => finiteNumber(trade.result_r) !== null).length;
  const reasons = new Map<string, number>();
  for (const trade of imported) {
    const reason = missingRReason(trade);
    if (reason) reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }
  return {
    totalImported: imported.length,
    unreviewed: imported.filter((trade) => trade.review_status === "unreviewed").length,
    reviewed: imported.filter((trade) => trade.review_status === "reviewed").length,
    missingStopLoss: countMissing("stop_loss"),
    missingSetupType: countMissing("setup_type"),
    missingSession: countMissing("session"),
    missingRegimeLabel: countMissing("regime_label"),
    missingManualQuality: countMissing("manual_quality"),
    missingNotes: countMissing("notes"),
    withResultR,
    withoutResultR: imported.length - withResultR,
    rCompletionRate: imported.length ? Number(((withResultR / imported.length) * 100).toFixed(1)) : 0,
    missingRReasons: [...reasons.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
  };
}

function newestTimestamp(trade: Trade) {
  const value = trade.entry_time ?? trade.created_at ?? trade.date;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function absolutePnl(trade: Trade) {
  return Math.abs(finiteNumber(trade.net_pnl) ?? finiteNumber(trade.gross_pnl) ?? 0);
}

export function prioritizeImportedReviews(trades: Trade[]) {
  return trades
    .filter((trade) => trade.imported && trade.review_status === "unreviewed")
    .sort((left, right) => {
      const comparisons = [
        Number(!hasValue(right.stop_loss)) - Number(!hasValue(left.stop_loss)),
        Number(!hasValue(right.setup_type)) - Number(!hasValue(left.setup_type)),
        Number(!hasValue(right.session)) - Number(!hasValue(left.session)),
        Number(!hasValue(right.manual_quality)) - Number(!hasValue(left.manual_quality)),
        absolutePnl(right) - absolutePnl(left),
        newestTimestamp(right) - newestTimestamp(left)
      ];
      return comparisons.find((value) => value !== 0) ?? 0;
    });
}
