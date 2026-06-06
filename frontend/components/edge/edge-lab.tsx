"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, BarChart3, Calculator, LineChart, Sigma, SlidersHorizontal, Trophy, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import { DIRECTIONS, INSTRUMENTS, MANUAL_QUALITIES, REGIME_LABELS, SESSIONS, SETUP_TYPES } from "@/lib/constants";
import type { Trade } from "@/lib/types";

const ALL = "All";
const UNLABELED = "Unlabeled";
const SIMULATION_OPTIONS = ["1000", "2500", "5000", "10000"];

type EdgeDecision = "Strong Positive Edge" | "Positive Edge" | "Weak / Unclear Edge" | "Negative Edge" | "Not Enough Data";
type RiskRecommendation = "Skip" | "0.25R" | "0.5R" | "1R";

type EdgeFilters = {
  startDate: string;
  endDate: string;
  instrument: string;
  session: string;
  direction: string;
  regime_label: string;
  setup_type: string;
  manual_quality: string;
};

type EdgeMetrics = {
  sampleSize: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  lossRate: number;
  averageWin: number;
  averageLoss: number;
  expectedValue: number;
  averageR: number;
  medianR: number;
  bestR: number;
  worstR: number;
  standardDeviationR: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  payoffRatio: number;
  maxDrawdown: number;
  averageRewardRisk: number;
  requiredBreakevenWinRate: number;
  edgeDifference: number;
  decision: EdgeDecision;
  sampleWarning: string;
  riskRecommendation: RiskRecommendation;
};

type SetupBreakdownRow = EdgeMetrics & {
  name: string;
};

type MonteCarloResult = {
  enabled: boolean;
  message: string;
  simulations: number;
  medianSimulatedReturn: number;
  worst5Outcome: number;
  best5Outcome: number;
  averageFinal: number;
  averageMaxDrawdown: number;
  simulatedMaxDrawdown: number;
  worstMaxDrawdown: number;
  chanceEndingNegative: number;
  samplePaths: number[][];
};

type DataQualityChecklistItem = {
  label: string;
  missing: number;
  total: number;
};

type EdgeDataReadiness = {
  totalTrades: number;
  takenTrades: number;
  missingSetupType: number;
  missingResultR: number;
  missingSession: number;
  missingRegimeLabel: number;
  missingManualQuality: number;
  missingStopLoss: number;
  missingEntryExit: number;
  checklist: DataQualityChecklistItem[];
};

function finiteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asNumber(value: unknown) {
  return finiteNumber(value) ?? 0;
}

function round(value: number, decimals = 2) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values: number[], pct: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[index];
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function profitFactor(results: number[]) {
  const grossProfit = results.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(results.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  if (grossLoss === 0) return grossProfit > 0 ? null : 0;
  return grossProfit / grossLoss;
}

function sampleReliability(sampleSize: number) {
  if (sampleSize < 30) {
    return {
      label: "Not reliable",
      detail: "< 30 trades: not reliable enough for edge decisions."
    };
  }
  if (sampleSize < 100) {
    return {
      label: "Early signal",
      detail: "30-100 trades: useful signal, still vulnerable to randomness."
    };
  }
  return {
    label: "More reliable",
    detail: "100+ trades: stronger evidence, still needs regime-aware review."
  };
}

function breakevenWinRate(rewardRisk: number) {
  return rewardRisk > 0 ? 1 / (1 + rewardRisk) : 0;
}

function classifyEdge(metrics: Pick<EdgeMetrics, "sampleSize" | "expectedValue" | "profitFactor" | "averageR">): EdgeDecision {
  if (metrics.sampleSize < 30) return "Not Enough Data";
  const pf = metrics.profitFactor ?? Number.POSITIVE_INFINITY;
  if (metrics.expectedValue >= 0.25 && metrics.averageR > 0 && pf >= 1.6) return "Strong Positive Edge";
  if (metrics.expectedValue >= 0.1 && pf >= 1.25) return "Positive Edge";
  if (metrics.expectedValue > 0 && pf >= 1) return "Weak / Unclear Edge";
  return "Negative Edge";
}

function recommendRisk(metrics: Pick<EdgeMetrics, "sampleSize" | "expectedValue" | "profitFactor" | "maxDrawdown" | "decision">): RiskRecommendation {
  const pf = metrics.profitFactor ?? Number.POSITIVE_INFINITY;
  if (metrics.sampleSize < 30 || metrics.expectedValue <= 0 || metrics.decision === "Negative Edge" || metrics.decision === "Not Enough Data") {
    return "Skip";
  }
  if (metrics.decision === "Strong Positive Edge" && metrics.sampleSize >= 100 && metrics.maxDrawdown <= 5 && pf >= 1.6) {
    return "1R";
  }
  if (metrics.sampleSize >= 50 && metrics.expectedValue >= 0.15 && metrics.maxDrawdown <= 7 && pf >= 1.3) {
    return "0.5R";
  }
  return "0.25R";
}

function maxDrawdownR(results: number[]) {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const result of results) {
    equity += result;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }

  return maxDrawdown;
}

function plannedRewardRisk(trade: Trade) {
  const entry = finiteNumber(trade.entry_price);
  const stop = finiteNumber(trade.stop_loss);
  const tp1 = finiteNumber(trade.tp1_price);

  if (entry === null || stop === null || tp1 === null) return null;
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(tp1 - entry);
  return risk > 0 && reward >= 0 ? reward / risk : null;
}

function calculateMetrics(results: number[], sourceTrades: Trade[] = []): EdgeMetrics {
  const wins = results.filter((value) => value > 0);
  const losses = results.filter((value) => value < 0);
  const breakeven = results.filter((value) => value === 0);
  const total = results.length;
  const grossProfit = wins.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0));
  const averageWin = average(wins);
  const averageLoss = Math.abs(average(losses));
  const winRate = total ? wins.length / total : 0;
  const lossRate = total ? losses.length / total : 0;
  const expectedValue = winRate * averageWin - lossRate * averageLoss;
  const pf = profitFactor(results);
  const payoffRatio = averageLoss > 0 ? averageWin / averageLoss : 0;
  const plannedRatios = sourceTrades.map(plannedRewardRisk).filter((value): value is number => value !== null && Number.isFinite(value));
  const averageRewardRisk = plannedRatios.length ? average(plannedRatios) : payoffRatio;
  const requiredBreakevenWinRate = breakevenWinRate(averageRewardRisk);
  const baseMetrics = {
    sampleSize: total,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winRate,
    lossRate,
    averageWin,
    averageLoss,
    expectedValue,
    averageR: average(results),
    medianR: median(results),
    bestR: results.length ? Math.max(...results) : 0,
    worstR: results.length ? Math.min(...results) : 0,
    standardDeviationR: standardDeviation(results),
    grossProfit,
    grossLoss,
    profitFactor: pf,
    payoffRatio,
    maxDrawdown: maxDrawdownR(results),
    averageRewardRisk,
    requiredBreakevenWinRate,
    edgeDifference: winRate - requiredBreakevenWinRate,
    decision: "Not Enough Data" as EdgeDecision,
    sampleWarning: sampleReliability(total).label,
    riskRecommendation: "Skip" as RiskRecommendation
  };
  const decision = classifyEdge(baseMetrics);
  const withDecision = { ...baseMetrics, decision };
  return { ...withDecision, riskRecommendation: recommendRisk(withDecision) };
}

function chronologicalTrades(trades: Trade[]) {
  return [...trades].sort((a, b) => {
    const dateA = new Date(a.date || a.created_at).getTime();
    const dateB = new Date(b.date || b.created_at).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

function validTakenTrades(trades: Trade[]) {
  return chronologicalTrades(
    trades.filter((trade) => {
      const resultR = finiteNumber(trade.result_r);
      return (
        trade.trade_decision === "Taken" &&
        trade.data_quality === "good" &&
        !["NoTrade", "Unknown"].includes(trade.result) &&
        resultR !== null
      );
    })
  );
}

function setupTypeName(trade: Trade) {
  return trade.setup_type || UNLABELED;
}

function matchesFilter(value: string | null | undefined, selected: string) {
  if (selected === ALL) return true;
  if (selected === UNLABELED) return !value;
  return value === selected;
}

function filterTrades(trades: Trade[], filters: EdgeFilters) {
  return trades.filter((trade) => {
    const tradeDate = (trade.date || "").slice(0, 10);
    if (filters.startDate && tradeDate < filters.startDate) return false;
    if (filters.endDate && tradeDate > filters.endDate) return false;
    return (
      matchesFilter(trade.instrument, filters.instrument) &&
      matchesFilter(trade.session, filters.session) &&
      matchesFilter(trade.direction, filters.direction) &&
      matchesFilter(trade.regime_label, filters.regime_label) &&
      matchesFilter(trade.setup_type, filters.setup_type) &&
      matchesFilter(trade.manual_quality, filters.manual_quality)
    );
  });
}

function uniqueOptions(base: readonly string[], values: Array<string | null | undefined>, includeUnlabeled = false) {
  const items = new Set<string>();
  for (const item of base) {
    if (item) items.add(item);
  }
  for (const value of values) {
    if (value) items.add(value);
  }
  const output = [ALL, ...items];
  if (includeUnlabeled && values.some((value) => !value)) output.push(UNLABELED);
  return output;
}

function setupBreakdownRows(trades: Trade[]): SetupBreakdownRow[] {
  const groups = new Map<string, Trade[]>();
  for (const trade of trades) {
    const name = setupTypeName(trade);
    const rows = groups.get(name) ?? [];
    rows.push(trade);
    groups.set(name, rows);
  }

  return [...groups.entries()]
    .map(([name, rows]) => {
      const results = rows.map((trade) => asNumber(trade.result_r));
      return { name, ...calculateMetrics(results, rows) };
    })
    .sort((a, b) => b.expectedValue - a.expectedValue || b.sampleSize - a.sampleSize);
}

function seededRandom(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function runMonteCarlo(results: number[], simulations: number, riskPercent: number): MonteCarloResult {
  if (results.length < 2) {
    return {
      enabled: false,
      message: "Need at least two valid taken trades to randomize historical outcomes.",
      simulations,
      medianSimulatedReturn: 0,
      worst5Outcome: 0,
      best5Outcome: 0,
      averageFinal: 0,
      averageMaxDrawdown: 0,
      simulatedMaxDrawdown: 0,
      worstMaxDrawdown: 0,
      chanceEndingNegative: 0,
      samplePaths: []
    };
  }

  const random = seededRandom(20260604);
  const finals: number[] = [];
  const drawdowns: number[] = [];
  const samplePaths: number[][] = [];
  const risk = riskPercent / 100;

  for (let sim = 0; sim < simulations; sim += 1) {
    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    const path: number[] = [0];

    for (let index = 0; index < results.length; index += 1) {
      const picked = results[Math.floor(random() * results.length)];
      equity += picked * risk * 100;
      peak = Math.max(peak, equity);
      maxDrawdown = Math.max(maxDrawdown, peak - equity);
      if (sim < 3) path.push(round(equity, 2));
    }

    finals.push(equity);
    drawdowns.push(maxDrawdown);
    if (sim < 3) samplePaths.push(path);
  }

  return {
    enabled: true,
    message: "Historical R results are bootstrapped with replacement. This shows path risk, not a forecast.",
    simulations,
    medianSimulatedReturn: percentile(finals, 50),
    worst5Outcome: percentile(finals, 5),
    best5Outcome: percentile(finals, 95),
    averageFinal: average(finals),
    averageMaxDrawdown: average(drawdowns),
    simulatedMaxDrawdown: percentile(drawdowns, 95),
    worstMaxDrawdown: Math.max(...drawdowns),
    chanceEndingNegative: finals.filter((value) => value < 0).length / finals.length,
    samplePaths
  };
}

function formatPct(value: number) {
  return `${round(value * 100, 1)}%`;
}

function formatPercentPoints(value: number) {
  const rounded = round(value * 100, 1);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function formatR(value: number) {
  return `${round(value, 2)}R`;
}

function formatLossR(value: number) {
  return value > 0 ? `-${formatR(value)}` : "0R";
}

function formatFactor(value: number | null) {
  return value === null ? "No losses" : round(value, 2).toString();
}

function formatPercentReturn(value: number) {
  return `${round(value, 1)}%`;
}

function sortByProfitFactor(rows: SetupBreakdownRow[]) {
  return [...rows].sort((a, b) => {
    const left = a.profitFactor ?? Number.POSITIVE_INFINITY;
    const right = b.profitFactor ?? Number.POSITIVE_INFINITY;
    return right - left || b.expectedValue - a.expectedValue;
  });
}

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasResultR(trade: Trade) {
  return finiteNumber(trade.result_r) !== null;
}

function hasEntryExit(trade: Trade) {
  return finiteNumber(trade.entry_price) !== null && hasText(trade.result) && !["NoTrade", "Unknown"].includes(trade.result);
}

function calculateDataReadiness(trades: Trade[]): EdgeDataReadiness {
  const takenTrades = trades.filter((trade) => trade.trade_decision === "Taken");
  const countMissing = (predicate: (trade: Trade) => boolean) => takenTrades.filter((trade) => !predicate(trade)).length;
  const missingSetupType = countMissing((trade) => hasText(trade.setup_type));
  const missingResultR = countMissing(hasResultR);
  const missingSession = countMissing((trade) => hasText(trade.session));
  const missingRegimeLabel = countMissing((trade) => hasText(trade.regime_label));
  const missingManualQuality = countMissing((trade) => hasText(trade.manual_quality));
  const missingStopLoss = countMissing((trade) => finiteNumber(trade.stop_loss) !== null);
  const missingEntryExit = countMissing(hasEntryExit);
  const total = takenTrades.length;

  return {
    totalTrades: trades.length,
    takenTrades: total,
    missingSetupType,
    missingResultR,
    missingSession,
    missingRegimeLabel,
    missingManualQuality,
    missingStopLoss,
    missingEntryExit,
    checklist: [
      { label: "result_r filled", missing: missingResultR, total },
      { label: "setup_type filled", missing: missingSetupType, total },
      { label: "session filled", missing: missingSession, total },
      { label: "regime_label filled", missing: missingRegimeLabel, total },
      { label: "manual_quality filled", missing: missingManualQuality, total },
      { label: "stop loss filled", missing: missingStopLoss, total },
      { label: "entry/exit filled", missing: missingEntryExit, total }
    ]
  };
}

function mostImportantNextAction(readiness: EdgeDataReadiness, setupRows: SetupBreakdownRow[], selectedSetupType: string) {
  if (readiness.totalTrades < 30) {
    return `Record ${30 - readiness.totalTrades} more trades before trusting edge metrics.`;
  }

  const missingFields = [
    { label: "setup_type", count: readiness.missingSetupType },
    { label: "result_r", count: readiness.missingResultR },
    { label: "session", count: readiness.missingSession },
    { label: "regime_label", count: readiness.missingRegimeLabel },
    { label: "manual_quality", count: readiness.missingManualQuality }
  ];
  const mostMissing = [...missingFields].sort((a, b) => b.count - a.count)[0];
  if (mostMissing?.count > 0) {
    return `Fill ${mostMissing.label} on ${mostMissing.count} taken trades so Edge Lab can group and score them correctly.`;
  }

  const selectedRow = selectedSetupType !== ALL ? setupRows.find((row) => row.name === selectedSetupType) : null;
  const targetRow = selectedRow ?? [...setupRows].filter((row) => row.sampleSize > 0 && row.sampleSize < 30).sort((a, b) => b.sampleSize - a.sampleSize)[0];
  if (targetRow && targetRow.sampleSize < 30) {
    return `You need ${30 - targetRow.sampleSize} more ${targetRow.name} trades before this setup has a useful sample.`;
  }

  if (!setupRows.length) {
    return "Record taken trades with setup_type, result_r, entry, stop, session, regime_label, and manual_quality filled.";
  }

  return "Core data is ready enough for early research. Keep adding trades until each setup type has 30+ samples.";
}

export function EdgeLab() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<EdgeFilters>({
    startDate: "",
    endDate: "",
    instrument: ALL,
    session: ALL,
    direction: ALL,
    regime_label: ALL,
    setup_type: ALL,
    manual_quality: ALL
  });
  const [riskPercent, setRiskPercent] = useState(1);
  const [simulations, setSimulations] = useState("2500");

  useEffect(() => {
    let active = true;
    api
      .trades()
      .then((rows) => {
        if (!active) return;
        setTrades(rows);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load trades");
      });
    return () => {
      active = false;
    };
  }, []);

  const validTrades = useMemo(() => validTakenTrades(trades), [trades]);
  const filterOptions = useMemo(
    () => ({
      instruments: uniqueOptions(INSTRUMENTS, trades.map((trade) => trade.instrument)),
      sessions: uniqueOptions(SESSIONS, trades.map((trade) => trade.session)),
      directions: uniqueOptions(DIRECTIONS, trades.map((trade) => trade.direction)),
      regimes: uniqueOptions(REGIME_LABELS, trades.map((trade) => trade.regime_label), true),
      setupTypes: uniqueOptions(SETUP_TYPES.filter(Boolean), trades.map((trade) => trade.setup_type), true),
      manualQualities: uniqueOptions(MANUAL_QUALITIES.filter(Boolean), trades.map((trade) => trade.manual_quality), true)
    }),
    [trades]
  );
  const filteredTrades = useMemo(() => filterTrades(validTrades, filters), [filters, validTrades]);
  const results = useMemo(() => filteredTrades.map((trade) => asNumber(trade.result_r)), [filteredTrades]);
  const metrics = useMemo(() => calculateMetrics(results, filteredTrades), [filteredTrades, results]);
  const reliability = useMemo(() => sampleReliability(metrics.sampleSize), [metrics.sampleSize]);
  const setupRows = useMemo(() => setupBreakdownRows(filteredTrades), [filteredTrades]);
  const topByEv = useMemo(() => [...setupRows].sort((a, b) => b.expectedValue - a.expectedValue).slice(0, 5), [setupRows]);
  const topByProfitFactor = useMemo(() => sortByProfitFactor(setupRows).slice(0, 5), [setupRows]);
  const worstByEv = useMemo(() => [...setupRows].sort((a, b) => a.expectedValue - b.expectedValue).slice(0, 5), [setupRows]);
  const monteCarlo = useMemo(() => runMonteCarlo(results, Number(simulations), riskPercent), [results, riskPercent, simulations]);
  const dataReadiness = useMemo(() => calculateDataReadiness(trades), [trades]);
  const nextAction = useMemo(() => mostImportantNextAction(dataReadiness, setupRows, filters.setup_type), [dataReadiness, filters.setup_type, setupRows]);

  function setFilter<K extends keyof EdgeFilters>(field: K, value: EdgeFilters[K]) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-accent">Mathematical Edge Analysis</div>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Edge Lab V2</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Evaluate setup types with EV, R-multiple distribution, profit factor, break-even math, Monte Carlo path risk, and research-only risk sizing. No broker connection. No order execution.
          </p>
        </div>
        <Badge>{metrics.sampleSize} filtered valid trades</Badge>
      </section>

      {error ? <div className="rounded-lg border border-stroke bg-panel px-4 py-3 text-sm text-muted">{error}</div> : null}

      {dataReadiness.totalTrades < 30 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-ink">
          Not enough data yet. Record at least 30 trades before trusting edge metrics.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Data Quality Checklist</CardTitle>
            <Badge>{dataReadiness.takenTrades} taken trades checked</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {dataReadiness.checklist.map((item) => (
              <ChecklistRow key={item.label} item={item} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most Important Next Action</CardTitle>
            <AlertTriangle className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-lg border border-stroke bg-canvas px-4 py-3 text-sm font-medium leading-6 text-ink">{nextAction}</div>
            <div className="grid gap-2 text-sm">
              <SummaryLine label="trades missing setup_type" value={dataReadiness.missingSetupType} />
              <SummaryLine label="trades missing result_r" value={dataReadiness.missingResultR} />
              <SummaryLine label="trades missing session" value={dataReadiness.missingSession} />
              <SummaryLine label="trades missing regime_label" value={dataReadiness.missingRegimeLabel} />
              <SummaryLine label="trades missing manual_quality" value={dataReadiness.missingManualQuality} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <SlidersHorizontal className="h-4 w-4 text-accent" />
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Start Date">
            <Input type="date" value={filters.startDate} onChange={(event) => setFilter("startDate", event.target.value)} />
          </Field>
          <Field label="End Date">
            <Input type="date" value={filters.endDate} onChange={(event) => setFilter("endDate", event.target.value)} />
          </Field>
          <Field label="Symbol">
            <Select value={filters.instrument} options={filterOptions.instruments} onChange={(event) => setFilter("instrument", event.target.value)} />
          </Field>
          <Field label="Session">
            <Select value={filters.session} options={filterOptions.sessions} onChange={(event) => setFilter("session", event.target.value)} />
          </Field>
          <Field label="Direction">
            <Select value={filters.direction} options={filterOptions.directions} onChange={(event) => setFilter("direction", event.target.value)} />
          </Field>
          <Field label="Regime">
            <Select value={filters.regime_label} options={filterOptions.regimes} onChange={(event) => setFilter("regime_label", event.target.value)} />
          </Field>
          <Field label="Setup Type">
            <Select value={filters.setup_type} options={filterOptions.setupTypes} onChange={(event) => setFilter("setup_type", event.target.value)} />
          </Field>
          <Field label="Manual Quality">
            <Select value={filters.manual_quality} options={filterOptions.manualQualities} onChange={(event) => setFilter("manual_quality", event.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Calculator} label="Expected Value" value={formatR(metrics.expectedValue)} helper="EV = win rate x average win minus loss rate x average loss." />
        <MetricCard icon={BarChart3} label="Profit Factor" value={formatFactor(metrics.profitFactor)} helper="Gross profit divided by gross loss." />
        <MetricCard icon={Sigma} label="Average R" value={formatR(metrics.averageR)} helper="Mean R result from filtered valid taken trades." />
        <MetricCard icon={AlertTriangle} label="Risk Recommendation" value={metrics.riskRecommendation} helper="Research-only sizing label based on EV, drawdown, and sample size." />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Expected Value Model</CardTitle>
            <Badge>{metrics.decision}</Badge>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Formula>EV = (Win Rate x Average Win R) - (Loss Rate x Average Loss R)</Formula>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Win Rate" value={formatPct(metrics.winRate)} />
              <Metric label="Average Win" value={formatR(metrics.averageWin)} />
              <Metric label="Loss Rate" value={formatPct(metrics.lossRate)} />
              <Metric label="Average Loss" value={formatLossR(metrics.averageLoss)} />
            </div>
            <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm leading-6 text-muted">
              Breakeven trades stay in the sample as 0R. Only good data-quality Taken trades are included.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Break-even Analysis</CardTitle>
            <Badge>{reliability.label}</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Metric label="Average Reward:Risk" value={round(metrics.averageRewardRisk, 2).toString()} />
            <Metric label="Required Break-even Win Rate" value={formatPct(metrics.requiredBreakevenWinRate)} />
            <Metric label="Actual Win Rate" value={formatPct(metrics.winRate)} />
            <Metric label="Edge Difference" value={formatPercentPoints(metrics.edgeDifference)} />
            <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm leading-6 text-muted sm:col-span-2">
              {reliability.detail}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>R-Multiple Model</CardTitle>
            <Badge>Distribution</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Metric label="Average R" value={formatR(metrics.averageR)} />
            <Metric label="Median R" value={formatR(metrics.medianR)} />
            <Metric label="Best R" value={formatR(metrics.bestR)} />
            <Metric label="Worst R" value={formatR(metrics.worstR)} />
            <Metric label="Std Dev R" value={formatR(metrics.standardDeviationR)} />
            <Metric label="Max Drawdown" value={formatR(metrics.maxDrawdown)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monte Carlo V2</CardTitle>
            <Badge>{monteCarlo.enabled ? `${monteCarlo.simulations} runs` : "Disabled"}</Badge>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Simulations">
                <Select value={simulations} options={SIMULATION_OPTIONS} onChange={(event) => setSimulations(event.target.value)} />
              </Field>
              <Field label="Risk Per Trade %">
                <Input type="number" min={0.1} step={0.1} value={riskPercent} onChange={(event) => setRiskPercent(Math.max(0.1, asNumber(event.target.value)))} />
              </Field>
            </div>
            <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm leading-6 text-muted">{monteCarlo.message}</div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Metric label="Median Simulated Return" value={formatPercentReturn(monteCarlo.medianSimulatedReturn)} />
              <Metric label="Worst 5% Outcome" value={formatPercentReturn(monteCarlo.worst5Outcome)} />
              <Metric label="Best 5% Outcome" value={formatPercentReturn(monteCarlo.best5Outcome)} />
              <Metric label="Simulated Max Drawdown" value={formatPercentReturn(monteCarlo.simulatedMaxDrawdown)} />
              <Metric label="Chance Ending Negative" value={formatPct(monteCarlo.chanceEndingNegative)} />
              <Metric label="Average Final Return" value={formatPercentReturn(monteCarlo.averageFinal)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Setup Edge Breakdown</CardTitle>
          <Badge>By setup_type</Badge>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="text-xs uppercase text-muted">
                <tr className="border-b border-stroke">
                  <th className="py-3 font-medium">Setup Type</th>
                  <th className="py-3 text-right font-medium">Trades</th>
                  <th className="py-3 text-right font-medium">Win Rate</th>
                  <th className="py-3 text-right font-medium">Avg Win</th>
                  <th className="py-3 text-right font-medium">Avg Loss</th>
                  <th className="py-3 text-right font-medium">EV</th>
                  <th className="py-3 text-right font-medium">PF</th>
                  <th className="py-3 text-right font-medium">Avg R</th>
                  <th className="py-3 text-right font-medium">Max DD</th>
                  <th className="py-3 text-right font-medium">Best</th>
                  <th className="py-3 text-right font-medium">Worst</th>
                  <th className="py-3 text-right font-medium">BE Edge</th>
                  <th className="py-3 text-right font-medium">Grade</th>
                  <th className="py-3 text-right font-medium">Risk</th>
                  <th className="py-3 text-right font-medium">Sample</th>
                </tr>
              </thead>
              <tbody>
                {setupRows.map((row) => (
                  <tr key={row.name} className="border-b border-stroke/70">
                    <td className="py-3 font-medium text-ink">{row.name}</td>
                    <td className="py-3 text-right text-muted">{row.sampleSize}</td>
                    <td className="py-3 text-right text-muted">{formatPct(row.winRate)}</td>
                    <td className="py-3 text-right text-muted">{formatR(row.averageWin)}</td>
                    <td className="py-3 text-right text-muted">{formatLossR(row.averageLoss)}</td>
                    <td className="py-3 text-right font-medium text-ink">{formatR(row.expectedValue)}</td>
                    <td className="py-3 text-right text-muted">{formatFactor(row.profitFactor)}</td>
                    <td className="py-3 text-right text-muted">{formatR(row.averageR)}</td>
                    <td className="py-3 text-right text-muted">{formatR(row.maxDrawdown)}</td>
                    <td className="py-3 text-right text-muted">{formatR(row.bestR)}</td>
                    <td className="py-3 text-right text-muted">{formatR(row.worstR)}</td>
                    <td className="py-3 text-right text-muted">{formatPercentPoints(row.edgeDifference)}</td>
                    <td className="py-3 text-right text-muted">{row.decision}</td>
                    <td className="py-3 text-right text-muted">{row.riskRecommendation}</td>
                    <td className="py-3 text-right text-muted">{row.sampleWarning}</td>
                  </tr>
                ))}
                {!setupRows.length ? (
                  <tr>
                    <td colSpan={15} className="py-6 text-center text-muted">No filtered valid taken trades yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-xs leading-5 text-muted">
            Risk labels are research-only. They are based on historical EV, maximum drawdown in R, profit factor, and sample size; they are not financial advice or trade instructions.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <RankingCard title="Top 5 By EV" icon={Trophy} rows={topByEv} value={(row) => formatR(row.expectedValue)} />
        <RankingCard title="Top 5 By Profit Factor" icon={BarChart3} rows={topByProfitFactor} value={(row) => formatFactor(row.profitFactor)} />
        <RankingCard title="Worst 5 By EV" icon={AlertTriangle} rows={worstByEv} value={(row) => formatR(row.expectedValue)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monte Carlo Sample Paths</CardTitle>
          <LineChart className="h-4 w-4 text-accent" />
        </CardHeader>
        <CardContent>
          <EquityPaths paths={monteCarlo.samplePaths} />
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, helper }: { icon: LucideIcon; label: string; value: string; helper: string }) {
  return (
    <Card>
      <CardContent className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted">{label}</div>
          <Icon className="h-4 w-4 text-accent" />
        </div>
        <div className="text-2xl font-semibold text-ink">{value}</div>
        <div className="text-xs leading-5 text-muted">{helper}</div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-stroke bg-canvas px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}

function ChecklistRow({ item }: { item: DataQualityChecklistItem }) {
  const ready = item.total > 0 && item.missing === 0;
  const status = item.total === 0 ? "No taken trades" : ready ? "Complete" : `${item.missing} missing`;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm">
      <div>
        <div className="font-medium text-ink">{item.label}</div>
        <div className="text-xs text-muted">{item.total - item.missing}/{item.total} complete</div>
      </div>
      <Badge>{status}</Badge>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-stroke bg-canvas px-3 py-2">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

function Formula({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-stroke bg-canvas px-4 py-3 font-mono text-sm text-ink">{children}</div>;
}

function RankingCard({ title, icon: Icon, rows, value }: { title: string; icon: LucideIcon; rows: SetupBreakdownRow[]; value: (row: SetupBreakdownRow) => string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Icon className="h-4 w-4 text-accent" />
      </CardHeader>
      <CardContent className="grid gap-2">
        {rows.map((row) => (
          <div key={`${title}-${row.name}`} className="flex items-center justify-between gap-3 rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm">
            <div>
              <div className="font-medium text-ink">{row.name}</div>
              <div className="text-xs text-muted">{row.sampleSize} trades - {row.decision}</div>
            </div>
            <div className="text-right font-semibold text-ink">{value(row)}</div>
          </div>
        ))}
        {!rows.length ? <div className="rounded-lg border border-stroke bg-canvas p-4 text-sm text-muted">No setup data yet.</div> : null}
      </CardContent>
    </Card>
  );
}

function EquityPaths({ paths }: { paths: number[][] }) {
  if (!paths.length) {
    return <div className="rounded-lg border border-stroke bg-canvas p-5 text-sm text-muted">Monte Carlo paths need valid taken trades.</div>;
  }

  const allValues = paths.flat();
  const min = Math.min(...allValues, 0);
  const max = Math.max(...allValues, 0);
  const range = Math.max(max - min, 1);
  const colors = ["#4f46e5", "#059669", "#dc2626"];

  function pathD(path: number[]) {
    return path
      .map((value, index) => {
        const x = path.length === 1 ? 0 : (index / (path.length - 1)) * 100;
        const y = 100 - ((value - min) / range) * 100;
        return `${index === 0 ? "M" : "L"} ${round(x, 2)} ${round(y, 2)}`;
      })
      .join(" ");
  }

  return (
    <div className="rounded-lg border border-stroke bg-canvas p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-ink">Possible Equity Curve Outcomes</div>
          <div className="text-xs text-muted">Three bootstrapped sample paths in account percent, using the selected risk per trade.</div>
        </div>
        <LineChart className="h-4 w-4 text-accent" />
      </div>
      <svg viewBox="0 0 100 100" className="h-56 w-full overflow-visible">
        <line x1="0" y1={100 - ((0 - min) / range) * 100} x2="100" y2={100 - ((0 - min) / range) * 100} stroke="currentColor" className="text-stroke" strokeWidth="0.5" />
        {paths.map((path, index) => (
          <path key={index} d={pathD(path)} fill="none" stroke={colors[index] ?? "#4f46e5"} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
    </div>
  );
}
