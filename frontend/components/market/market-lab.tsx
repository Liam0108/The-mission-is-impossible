"use client";

import { ChangeEvent, Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, CheckCircle2, Database, Download, Layers, Upload, XCircle, Zap, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import { analyzeMarketCsvColumns } from "@/lib/market-engine";
import type { DetectorFeedback, DetectorFeedbackValue, MarketCsvColumnPreview, MarketLabSummary, MarketSwingMode } from "@/lib/types";

const SYMBOLS = ["NQ", "MNQ", "GC"];
const TIMEFRAMES = ["1m", "5m"];
const FREE_DATA_SYMBOLS = ["NQ=F", "MNQ=F", "GC=F"];
const FREE_DATA_RANGES_BY_TIMEFRAME: Record<string, string[]> = {
  "1m": ["1d", "5d", "8d"],
  "5m": ["5d", "1mo", "3mo"]
};
const SWING_MODES: MarketSwingMode[] = ["normal", "strict", "aggressive"];
const FEEDBACK_KEY = "fabio-market-validation-feedback-v1";
const VALIDATION_FILTERS = ["All", "Unreviewed only", "Correct", "Wrong", "Unsure"] as const;
const CALIBRATION_SESSIONS = ["All", "Asia", "London", "Pre-Market", "New York", "After-Hours"] as const;
const SWING_TYPES = ["All", "HH", "HL", "LH", "LL"] as const;
const TIMEZONE_MODES = ["UTC", "New York", "Local"] as const;
const VALIDATION_CHECKLIST = [
  "Import NQ 1m CSV",
  "Check data quality",
  "Review detected swings",
  "Review sweeps",
  "Review FVGs",
  "Review setup candidates",
  "Mark Correct/Wrong/Unsure",
  "Export feedback CSV"
];

type DetectorType = DetectorFeedback["detector_type"];
type ValidationFilter = (typeof VALIDATION_FILTERS)[number];
type CalibrationSession = (typeof CALIBRATION_SESSIONS)[number];
type SwingTypeFilter = (typeof SWING_TYPES)[number];
type TimezoneMode = (typeof TIMEZONE_MODES)[number];
type MarketSwingParams = {
  symbol: string;
  timeframe: string;
  swing_mode: MarketSwingMode;
  swing_left_candles: number;
  swing_right_candles: number;
  min_swing_distance: number;
  min_structure_node_importance: number;
  max_structure_sweep_age_minutes: number | null;
  min_structure_pierce_size: number;
};

type DetectedItem = {
  detectorType: DetectorType;
  detectedId: string;
  label: string;
  timestamp: string;
  priceLevel: number;
  reason: string;
  candlesUsed: string[];
  confidenceScore: number | null;
  importanceScore?: number | null;
  structureType?: string | null;
  structureState?: string | null;
  structureLeg?: string | null;
  protectedRole?: string | null;
  causedBos?: boolean | null;
  causedChoch?: boolean | null;
  createdDisplacement?: boolean | null;
  displacementScore?: number | null;
  sweptNodeType?: string | null;
  sweptNodePrice?: number | null;
  sweptNodeTime?: string | null;
  direction?: string | null;
  pierceDistance?: number | null;
  closeBackDistance?: number | null;
  originalCsvRowIndex?: number | null;
  originalTimestamp?: string | null;
  parsedTimestamp?: string | null;
  candleOpen?: number | null;
  candleHigh?: number | null;
  candleLow?: number | null;
  candleClose?: number | null;
  swingSourceRowIndex?: number | null;
  swingSourceTimestamp?: string | null;
  swingSourceOpen?: number | null;
  swingSourceHigh?: number | null;
  swingSourceLow?: number | null;
  swingSourceClose?: number | null;
  displayedLevel?: number | null;
  levelSource?: string | null;
};

type CalibrationSwingItem = DetectedItem & {
  session: string;
  swingType: string;
};

function formatTime(value: string | null, mode: TimezoneMode = "Local") {
  if (!value) return "--";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const timeZone = mode === "UTC" ? "UTC" : mode === "New York" ? "America/New_York" : undefined;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    ...(timeZone ? { timeZone } : {})
  });
}

function formatOhlc(open?: number | null, high?: number | null, low?: number | null, close?: number | null) {
  if (open === null || open === undefined || high === null || high === undefined || low === null || low === undefined || close === null || close === undefined) return "--";
  return `O ${open} / H ${high} / L ${low} / C ${close}`;
}

function detectionDebugFields(row: {
  original_csv_row_index?: number | null;
  original_timestamp?: string | null;
  parsed_timestamp?: string | null;
  candle_open?: number | null;
  candle_high?: number | null;
  candle_low?: number | null;
  candle_close?: number | null;
  swing_source_row_index?: number | null;
  swing_source_timestamp?: string | null;
  swing_source_open?: number | null;
  swing_source_high?: number | null;
  swing_source_low?: number | null;
  swing_source_close?: number | null;
  displayed_level?: number | null;
  level_source?: string | null;
}) {
  return {
    originalCsvRowIndex: row.original_csv_row_index ?? null,
    originalTimestamp: row.original_timestamp ?? null,
    parsedTimestamp: row.parsed_timestamp ?? null,
    candleOpen: row.candle_open ?? null,
    candleHigh: row.candle_high ?? null,
    candleLow: row.candle_low ?? null,
    candleClose: row.candle_close ?? null,
    swingSourceRowIndex: row.swing_source_row_index ?? null,
    swingSourceTimestamp: row.swing_source_timestamp ?? null,
    swingSourceOpen: row.swing_source_open ?? null,
    swingSourceHigh: row.swing_source_high ?? null,
    swingSourceLow: row.swing_source_low ?? null,
    swingSourceClose: row.swing_source_close ?? null,
    displayedLevel: row.displayed_level ?? null,
    levelSource: row.level_source ?? null
  };
}

function sessionForTimestampValue(value: string) {
  const date = new Date(value);
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= 18 * 60 || minutes < 3 * 60) return "Asia";
  if (minutes >= 3 * 60 && minutes < 8 * 60 + 30) return "London";
  if (minutes >= 8 * 60 + 30 && minutes < 9 * 60 + 30) return "Pre-Market";
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) return "New York";
  return "After-Hours";
}

function swingTypeFromLabel(label: string) {
  const first = label.split(" / ")[0];
  return ["HH", "HL", "LH", "LL"].includes(first) ? first : first;
}

function emptySummary(): MarketLabSummary {
  return {
    candle_count: 0,
    duplicate_rows: 0,
    missing_rows: 0,
    missing_timestamps: [],
    first_candle: null,
    last_candle: null,
    first_raw_timestamp: null,
    last_raw_timestamp: null,
    source_filename: null,
    detected_symbol: null,
    timeframe_consistent: false,
    expected_timeframe_minutes: null,
    session_counts: {},
    swings: [],
    swings_v2: [],
    swings_v1_count: 0,
    swings_v2_count: 0,
    structure_sequence: [],
    protected_structure: [],
    protected_structure_count: 0,
    structure_sweeps: [],
    reference_labels: [],
    label_comparison: {
      matches: [],
      missed_tradingview_labels: [],
      extra_market_lab_detections: [],
      metrics: {
        structure_match_rate: 0,
        sweep_liquidity_grab_match_rate: 0,
        bos_choch_match_rate: 0
      }
    },
    mismatch_analysis: {
      top_examples: [],
      likely_causes: [],
      recommended_detector_changes: []
    },
    structure_sweep_config: { min_node_importance: 50, max_age_minutes: null, min_pierce_size: 0 },
    swing_config: { mode: "normal", left_candles: 2, right_candles: 2, min_swing_distance: 8 },
    liquidity_events: [],
    fvgs: [],
    setup_candidates: [],
    import_summary: null,
    free_data: null
  };
}

function boundedNumber(value: string, fallback: number, min: number, max: number, integer = true) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = integer ? Math.round(parsed) : parsed;
  return Math.min(Math.max(normalized, min), max);
}

function readFeedbacks(): DetectorFeedback[] {
  try {
    const rows = JSON.parse(window.localStorage.getItem(FEEDBACK_KEY) ?? "[]") as DetectorFeedback[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function writeFeedbacks(rows: DetectorFeedback[]) {
  window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify(rows));
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function qualitySummary(items: DetectedItem[], feedbacks: DetectorFeedback[]) {
  const currentIds = new Set(items.map((item) => item.detectedId));
  const currentFeedbacks = feedbacks.filter((feedback) => currentIds.has(feedback.detected_id));
  const correct = currentFeedbacks.filter((feedback) => feedback.user_feedback === "Correct").length;
  const wrong = currentFeedbacks.filter((feedback) => feedback.user_feedback === "Wrong").length;
  const unsure = currentFeedbacks.filter((feedback) => feedback.user_feedback === "Unsure").length;
  const accuracyBase = correct + wrong;
  return {
    totalDetected: items.length,
    correct,
    wrong,
    unsure,
    estimatedAccuracy: accuracyBase ? Number(((correct / accuracyBase) * 100).toFixed(1)) : 0
  };
}

function validationProgress(items: DetectedItem[], feedbacks: DetectorFeedback[]) {
  const currentIds = new Set(items.map((item) => item.detectedId));
  const reviewed = feedbacks.filter((feedback) => currentIds.has(feedback.detected_id)).length;
  const unreviewed = Math.max(items.length - reviewed, 0);
  return {
    total: items.length,
    reviewed,
    unreviewed,
    reviewedPct: items.length ? Number(((reviewed / items.length) * 100).toFixed(1)) : 0
  };
}

function filterDetections(items: DetectedItem[], feedbacks: DetectorFeedback[], filter: ValidationFilter) {
  if (filter === "All") return items;
  return items.filter((item) => {
    const feedback = feedbacks.find((row) => row.detected_id === item.detectedId);
    if (filter === "Unreviewed only") return !feedback;
    return feedback?.user_feedback === filter;
  });
}

function shouldIgnoreShortcut(event: KeyboardEvent) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
}

export function MarketLab() {
  const [symbol, setSymbol] = useState("NQ");
  const [timeframe, setTimeframe] = useState("1m");
  const [dataMode, setDataMode] = useState<"stored" | "free">("stored");
  const [freeDataSymbol, setFreeDataSymbol] = useState("NQ=F");
  const [freeDataRange, setFreeDataRange] = useState("5d");
  const [swingMode, setSwingMode] = useState<MarketSwingMode>("normal");
  const [swingLeftCandles, setSwingLeftCandles] = useState(2);
  const [swingRightCandles, setSwingRightCandles] = useState(2);
  const [minSwingDistance, setMinSwingDistance] = useState(8);
  const [minStructureNodeImportance, setMinStructureNodeImportance] = useState(50);
  const [maxStructureSweepAgeMinutes, setMaxStructureSweepAgeMinutes] = useState<number | null>(null);
  const [minStructurePierceSize, setMinStructurePierceSize] = useState(0);
  const [summary, setSummary] = useState<MarketLabSummary>(emptySummary());
  const [feedbacks, setFeedbacks] = useState<DetectorFeedback[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [validationFilter, setValidationFilter] = useState<ValidationFilter>("All");
  const [calibrationSession, setCalibrationSession] = useState<CalibrationSession>("All");
  const [calibrationSwingType, setCalibrationSwingType] = useState<SwingTypeFilter>("All");
  const [timeMode, setTimeMode] = useState<TimezoneMode>("Local");
  const [selectedDetectedId, setSelectedDetectedId] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<{ file: File; preview: MarketCsvColumnPreview } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const swingParams = useMemo<MarketSwingParams>(
    () => ({
      symbol,
      timeframe,
      swing_mode: swingMode,
      swing_left_candles: swingLeftCandles,
      swing_right_candles: swingRightCandles,
      min_swing_distance: minSwingDistance,
      min_structure_node_importance: minStructureNodeImportance,
      max_structure_sweep_age_minutes: maxStructureSweepAgeMinutes,
      min_structure_pierce_size: minStructurePierceSize
    }),
    [maxStructureSweepAgeMinutes, minStructureNodeImportance, minStructurePierceSize, minSwingDistance, swingLeftCandles, swingMode, swingRightCandles, symbol, timeframe]
  );
  const freeDataRangeOptions = useMemo(() => FREE_DATA_RANGES_BY_TIMEFRAME[timeframe] ?? ["5d"], [timeframe]);
  const freeDataParams = useMemo(
    () => ({
      ...swingParams,
      symbol: freeDataSymbol,
      range: freeDataRange
    }),
    [freeDataRange, freeDataSymbol, swingParams]
  );
  const sessionRows = useMemo(() => Object.entries(summary.session_counts).sort(([a], [b]) => a.localeCompare(b)), [summary.session_counts]);

  const swingItems = useMemo<DetectedItem[]>(
    () => {
      const swings = summary.swings_v2 ?? summary.swings;
      return swings.map((swing) => ({
        detectorType: "swing",
        detectedId: swing.detected_id,
        label: `${swing.label} / ${swing.kind.replace("_", " ")}`,
        timestamp: swing.timestamp,
        priceLevel: swing.price_level,
        reason: swing.reason,
        candlesUsed: swing.candles_used,
        confidenceScore: swing.confidence_score,
        importanceScore: swing.structure_importance_score,
        ...detectionDebugFields(swing)
      }));
    },
    [summary.swings, summary.swings_v2]
  );

  const structureItems = useMemo<DetectedItem[]>(
    () =>
      (summary.structure_sequence ?? []).map((node) => ({
        detectorType: "structure",
        detectedId: node.detected_id,
        label: node.structure_type,
        timestamp: node.timestamp,
        priceLevel: node.price,
        reason: node.reason,
        candlesUsed: [node.source_swing_id],
        confidenceScore: null,
        importanceScore: node.importance_score,
        structureType: node.structure_type,
        structureState: node.structure_state,
        structureLeg: node.leg_type,
        protectedRole: node.protected_level_role ?? null,
        causedBos: node.caused_bos ?? null,
        causedChoch: node.caused_choch ?? null,
        createdDisplacement: node.created_displacement ?? null,
        displacementScore: node.displacement_score ?? null
      })),
    [summary.structure_sequence]
  );

  const protectedStructureItems = useMemo<DetectedItem[]>(
    () =>
      (summary.protected_structure ?? []).map((node) => ({
        detectorType: "structure",
        detectedId: node.detected_id,
        label: node.protected_level_role ? node.protected_level_role.replace(/_/g, " ") : node.structure_type,
        timestamp: node.timestamp,
        priceLevel: node.price,
        reason: node.reason,
        candlesUsed: [node.source_swing_id],
        confidenceScore: null,
        importanceScore: node.importance_score,
        structureType: node.structure_type,
        structureState: node.structure_state,
        structureLeg: node.leg_type,
        protectedRole: node.protected_level_role ?? null,
        causedBos: node.caused_bos ?? null,
        causedChoch: node.caused_choch ?? null,
        createdDisplacement: node.created_displacement ?? null,
        displacementScore: node.displacement_score ?? null
      })),
    [summary.protected_structure]
  );

  const structureSweepItems = useMemo<DetectedItem[]>(
    () =>
      (summary.structure_sweeps ?? []).map((event) => ({
        detectorType: "structure_sweep",
        detectedId: event.detected_id,
        label: `Sweep ${event.direction} ${event.swept_node_type}`,
        timestamp: event.timestamp,
        priceLevel: event.swept_node_price,
        reason: event.reason,
        candlesUsed: event.candles_used,
        confidenceScore: null,
        importanceScore: event.importance_score,
        sweptNodeType: event.swept_node_type,
        sweptNodePrice: event.swept_node_price,
        sweptNodeTime: event.swept_node_time,
        direction: event.direction,
        pierceDistance: event.pierce_distance,
        closeBackDistance: event.close_back_distance,
        ...detectionDebugFields(event)
      })),
    [summary.structure_sweeps]
  );

  const sweepItems = useMemo<DetectedItem[]>(
    () =>
      summary.liquidity_events.map((event) => ({
        detectorType: "sweep",
        detectedId: event.detected_id,
        label: `${event.event_type === "sweep_above_high" ? "Sweep above" : "Sweep below"} ${event.swept_timeframe ? `${event.swept_timeframe} ` : ""}${event.swept_level_type ?? event.source.replace(/_/g, " ")}`,
        timestamp: event.timestamp,
        priceLevel: event.price_level,
        reason: `${event.reason} ${event.sweep_importance_reason ?? ""}`,
        candlesUsed: event.candles_used,
        confidenceScore: event.confidence_score,
        importanceScore: event.sweep_importance_score ?? null,
        ...detectionDebugFields(event)
      })),
    [summary.liquidity_events]
  );

  const fvgItems = useMemo<DetectedItem[]>(
    () =>
      summary.fvgs.map((fvg) => ({
        detectorType: "fvg",
        detectedId: fvg.detected_id,
        label: `${fvg.fvg_type} FVG / ${fvg.lower_bound}-${fvg.upper_bound}${fvg.returned ? " / returned" : ""}`,
        timestamp: fvg.timestamp,
        priceLevel: fvg.price_level,
        reason: fvg.reason,
        candlesUsed: fvg.candles_used,
        confidenceScore: fvg.confidence_score,
        ...detectionDebugFields(fvg)
      })),
    [summary.fvgs]
  );

  const candidateItems = useMemo<DetectedItem[]>(
    () =>
      summary.setup_candidates.map((candidate) => ({
        detectorType: "setup_candidate",
        detectedId: candidate.detected_id,
        label: `${candidate.setup_type} / ${candidate.direction}`,
        timestamp: candidate.timestamp,
        priceLevel: candidate.price_level,
        reason: `${candidate.reason} ${Array.isArray(candidate.reasons) ? candidate.reasons.join(", ") : candidate.reasons}`,
        candlesUsed: candidate.candles_used,
        confidenceScore: candidate.confidence_score,
        ...detectionDebugFields(candidate)
      })),
    [summary.setup_candidates]
  );

  const allItems = useMemo(
    () => [...swingItems, ...structureItems, ...protectedStructureItems, ...structureSweepItems, ...sweepItems, ...fvgItems, ...candidateItems],
    [candidateItems, fvgItems, protectedStructureItems, structureItems, structureSweepItems, sweepItems, swingItems]
  );
  const quality = useMemo(() => qualitySummary(allItems, feedbacks), [allItems, feedbacks]);
  const progress = useMemo(() => validationProgress(allItems, feedbacks), [allItems, feedbacks]);
  const filteredSwingItems = useMemo(() => filterDetections(swingItems, feedbacks, validationFilter), [feedbacks, swingItems, validationFilter]);
  const filteredStructureItems = useMemo(() => filterDetections(structureItems, feedbacks, validationFilter), [feedbacks, structureItems, validationFilter]);
  const filteredProtectedStructureItems = useMemo(() => filterDetections(protectedStructureItems, feedbacks, validationFilter), [feedbacks, protectedStructureItems, validationFilter]);
  const filteredStructureSweepItems = useMemo(() => filterDetections(structureSweepItems, feedbacks, validationFilter), [feedbacks, structureSweepItems, validationFilter]);
  const filteredSweepItems = useMemo(() => filterDetections(sweepItems, feedbacks, validationFilter), [feedbacks, sweepItems, validationFilter]);
  const filteredFvgItems = useMemo(() => filterDetections(fvgItems, feedbacks, validationFilter), [feedbacks, fvgItems, validationFilter]);
  const filteredCandidateItems = useMemo(() => filterDetections(candidateItems, feedbacks, validationFilter), [candidateItems, feedbacks, validationFilter]);
  const visibleItems = useMemo(
    () => [...filteredSwingItems, ...filteredStructureItems, ...filteredProtectedStructureItems, ...filteredStructureSweepItems, ...filteredSweepItems, ...filteredFvgItems, ...filteredCandidateItems],
    [filteredCandidateItems, filteredFvgItems, filteredProtectedStructureItems, filteredStructureItems, filteredStructureSweepItems, filteredSweepItems, filteredSwingItems]
  );
  const calibrationSwingItems = useMemo<CalibrationSwingItem[]>(
    () =>
      swingItems
        .filter((item) => item.importanceScore !== null && item.importanceScore !== undefined)
        .map((item) => ({
          ...item,
          session: sessionForTimestampValue(item.timestamp),
          swingType: swingTypeFromLabel(item.label)
        }))
        .filter((item) => calibrationSession === "All" || item.session === calibrationSession)
        .filter((item) => calibrationSwingType === "All" || item.swingType === calibrationSwingType),
    [calibrationSession, calibrationSwingType, swingItems]
  );
  const highestImportanceItems = useMemo(
    () => [...calibrationSwingItems].sort((a, b) => (b.importanceScore ?? 0) - (a.importanceScore ?? 0)).slice(0, 20),
    [calibrationSwingItems]
  );
  const lowestImportanceItems = useMemo(
    () => [...calibrationSwingItems].sort((a, b) => (a.importanceScore ?? 0) - (b.importanceScore ?? 0)).slice(0, 20),
    [calibrationSwingItems]
  );

  const saveFeedback = useCallback((item: DetectedItem, value: DetectorFeedbackValue) => {
    const nextFeedback: DetectorFeedback = {
      detector_type: item.detectorType,
      detected_id: item.detectedId,
      user_feedback: value,
      notes: noteDrafts[item.detectedId] ?? feedbacks.find((feedback) => feedback.detected_id === item.detectedId)?.notes ?? "",
      timestamp: new Date().toISOString()
    };
    const next = [nextFeedback, ...feedbacks.filter((feedback) => feedback.detected_id !== item.detectedId)];
    setFeedbacks(next);
    writeFeedbacks(next);
  }, [feedbacks, noteDrafts]);

  useEffect(() => {
    setFeedbacks(readFeedbacks());
  }, []);

  useEffect(() => {
    if (!freeDataRangeOptions.includes(freeDataRange)) {
      setFreeDataRange(freeDataRangeOptions[0] ?? "5d");
    }
  }, [freeDataRange, freeDataRangeOptions]);

  useEffect(() => {
    if (!visibleItems.length) {
      if (selectedDetectedId) setSelectedDetectedId(null);
      return;
    }
    if (!selectedDetectedId || !visibleItems.some((item) => item.detectedId === selectedDetectedId)) {
      const next = visibleItems.find((item) => !feedbacks.some((feedback) => feedback.detected_id === item.detectedId)) ?? visibleItems[0];
      setSelectedDetectedId(next.detectedId);
    }
  }, [feedbacks, selectedDetectedId, visibleItems]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || shouldIgnoreShortcut(event)) return;
      const valueByKey: Record<string, DetectorFeedbackValue> = {
        c: "Correct",
        w: "Wrong",
        u: "Unsure"
      };
      const value = valueByKey[event.key.toLowerCase()];
      if (!value) return;

      const current =
        visibleItems.find((item) => item.detectedId === selectedDetectedId) ??
        visibleItems.find((item) => !feedbacks.some((feedback) => feedback.detected_id === item.detectedId)) ??
        visibleItems[0];
      if (!current) return;

      event.preventDefault();
      saveFeedback(current, value);

      const currentIndex = visibleItems.findIndex((item) => item.detectedId === current.detectedId);
      const next =
        visibleItems.slice(currentIndex + 1).find((item) => !feedbacks.some((feedback) => feedback.detected_id === item.detectedId) && item.detectedId !== current.detectedId) ??
        visibleItems.find((item) => !feedbacks.some((feedback) => feedback.detected_id === item.detectedId) && item.detectedId !== current.detectedId) ??
        current;
      setSelectedDetectedId(next.detectedId);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [feedbacks, saveFeedback, selectedDetectedId, visibleItems]);

  useEffect(() => {
    if (dataMode !== "stored") return;
    let active = true;
    setBusy(true);
    api
      .marketDataSummary(swingParams)
      .then((data) => {
        if (!active) return;
        setSummary(data);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load market data");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [dataMode, swingParams]);

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const preview = analyzeMarketCsvColumns(await file.text());
      setPendingImport({ file, preview });
      setError(null);
    } catch (err) {
      setPendingImport(null);
      setError(err instanceof Error ? err.message : "Unable to read CSV columns");
    } finally {
      event.target.value = "";
    }
  }

  async function importFile(file: File, params: MarketSwingParams) {
    setDataMode("stored");
    setBusy(true);
    try {
      const data = await api.importMarketDataCsv(file, params);
      setSummary(data);
      setPendingImport(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to import candle CSV");
    } finally {
      setBusy(false);
    }
  }

  async function loadSample() {
    setDataMode("stored");
    setSymbol("NQ");
    setTimeframe("1m");
    setBusy(true);
    try {
      const response = await fetch("/samples/nq-1m-sample.csv");
      if (!response.ok) throw new Error("Unable to load sample CSV");
      const blob = await response.blob();
      await importFile(new File([blob], "nq-1m-sample.csv", { type: "text/csv" }), { ...swingParams, symbol: "NQ", timeframe: "1m" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load sample CSV");
      setBusy(false);
    }
  }

  async function loadFreeData(forceRefresh = false) {
    setDataMode("free");
    setBusy(true);
    try {
      const data = await api.freeMarketData({ ...freeDataParams, force_refresh: forceRefresh });
      setSummary(data);
      setPendingImport(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Yahoo Finance data");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPendingImport() {
    if (!pendingImport || !pendingImport.preview.can_import) return;
    await importFile(pendingImport.file, swingParams);
  }

  function exportFeedbackCsv() {
    const headers = ["detector_type", "detected_id", "user_feedback", "notes", "timestamp"];
    const body = feedbacks.map((feedback) => headers.map((header) => csvCell(feedback[header as keyof DetectorFeedback])).join(","));
    const blob = new Blob([[headers.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "market-detector-validation-feedback.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportCalibrationFeedbackCsv() {
    const rows = [
      ...highestImportanceItems.map((item) => ({ group: "Highest", item })),
      ...lowestImportanceItems.map((item) => ({ group: "Lowest", item }))
    ];
    const headers = [
      "group",
      "detected_id",
      "timestamp",
      "session",
      "swing_type",
      "price_level",
      "importance_score",
      "confidence_score",
      "user_feedback",
      "notes",
      "feedback_timestamp",
      "reason"
    ];
    const body = rows.map(({ group, item }) => {
      const feedback = feedbacks.find((row) => row.detected_id === item.detectedId);
      const values: Record<string, string | number> = {
        group,
        detected_id: item.detectedId,
        timestamp: item.timestamp,
        session: item.session,
        swing_type: item.swingType,
        price_level: item.priceLevel,
        importance_score: item.importanceScore ?? "",
        confidence_score: item.confidenceScore ?? "",
        user_feedback: feedback?.user_feedback ?? "",
        notes: noteDrafts[item.detectedId] ?? feedback?.notes ?? "",
        feedback_timestamp: feedback?.timestamp ?? "",
        reason: item.reason
      };
      return headers.map((header) => csvCell(values[header] ?? "")).join(",");
    });
    const blob = new Blob([[headers.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "structure-importance-calibration-feedback.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-accent">Data Validation Only</div>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Market Lab</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Import NQ 1m or 5m candles, inspect detector reasoning, and mark outputs as correct, wrong, or unsure. No broker connection. No order execution.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Symbol">
            <Select
              value={symbol}
              options={SYMBOLS}
              onChange={(event) => {
                setDataMode("stored");
                setSymbol(event.target.value);
              }}
            />
          </Field>
          <Field label="Timeframe">
            <Select
              value={timeframe}
              options={TIMEFRAMES}
              onChange={(event) => {
                setDataMode("stored");
                setTimeframe(event.target.value);
              }}
            />
          </Field>
          <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
          <Button type="button" variant="secondary" onClick={loadSample} disabled={busy}>
            <Database className="h-4 w-4" />
            Load NQ Sample
          </Button>
          <Button type="button" variant="primary" onClick={() => fileInput.current?.click()} disabled={busy}>
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button type="button" variant="secondary" onClick={exportFeedbackCsv} disabled={!feedbacks.length}>
            <Download className="h-4 w-4" />
            Export Feedback
          </Button>
        </div>
      </section>

      {error ? <div className="rounded-lg border border-stroke bg-panel px-4 py-3 text-sm text-muted">{error}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>Free Data Research Mode</CardTitle>
          <Badge>{dataMode === "free" ? "Yahoo Finance active" : "Optional data source"}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Yahoo Symbol">
              <Select value={freeDataSymbol} options={FREE_DATA_SYMBOLS} onChange={(event) => setFreeDataSymbol(event.target.value)} />
            </Field>
            <Field label="Range">
              <Select value={freeDataRange} options={freeDataRangeOptions} onChange={(event) => setFreeDataRange(event.target.value)} />
            </Field>
            <Button type="button" variant="primary" onClick={() => loadFreeData(false)} disabled={busy}>
              <Download className="h-4 w-4" />
              Download & Run
            </Button>
            <Button type="button" variant="secondary" onClick={() => loadFreeData(true)} disabled={busy}>
              <Database className="h-4 w-4" />
              Refresh Cache
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Info label="Data Source" value={summary.free_data?.provider ?? (dataMode === "free" ? "Yahoo Finance" : "--")} />
            <Info label="Source Symbol" value={summary.free_data?.source_symbol ?? "--"} />
            <Info label="Cache" value={summary.free_data ? (summary.free_data.cached ? "Local cache" : "Fresh download") : "--"} />
            <Info label="Last Yahoo Candle" value={formatTime(summary.free_data?.last_candle ?? null, timeMode)} />
            {summary.free_data ? (
              <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-xs leading-5 text-muted md:col-span-2">
                {summary.free_data.delay_warning}
              </div>
            ) : (
              <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-xs leading-5 text-muted md:col-span-2">
                Downloads free delayed futures data into a local cache, then runs the existing Structure Engine and Structure Sweep Detector.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {pendingImport ? (
        <Card>
          <CardHeader>
            <CardTitle>Detected TradingView Column Mapping</CardTitle>
            <Badge>{pendingImport.preview.can_import ? "Ready to import" : "Needs columns"}</Badge>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div className="grid gap-2">
              <div className="text-sm text-muted">{pendingImport.file.name} / {pendingImport.preview.row_count} rows</div>
              <div className="grid gap-2">
                {pendingImport.preview.column_mapping.map((item) => (
                  <div key={`${item.source}-${item.target}`} className="flex items-center justify-between rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm">
                    <span className="font-medium text-ink">{item.source}</span>
                    <span className="text-muted">-&gt; {item.target}</span>
                  </div>
                ))}
              </div>
              {pendingImport.preview.ignored_columns.length ? (
                <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-xs leading-5 text-muted">
                  Ignoring unrelated columns: {pendingImport.preview.ignored_columns.slice(0, 8).join(", ")}
                  {pendingImport.preview.ignored_columns.length > 8 ? "..." : ""}
                </div>
              ) : null}
            </div>
            <div className="grid gap-3">
              <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm text-muted">
                Reference label columns detected:{" "}
                {pendingImport.preview.reference_label_columns.length
                  ? pendingImport.preview.reference_label_columns.map((column) => `${column.source} -> ${column.label_type}`).join(", ")
                  : "none"}
              </div>
              {pendingImport.preview.warnings.length ? (
                <div className="grid gap-2">
                  {pendingImport.preview.warnings.map((warning) => (
                    <div key={warning} className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm text-muted">
                      {warning}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm text-muted">No column warnings.</div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="primary" onClick={confirmPendingImport} disabled={!pendingImport.preview.can_import || busy}>
                  Confirm Import
                </Button>
                <Button type="button" variant="secondary" onClick={() => setPendingImport(null)} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Validation Checklist</CardTitle>
            <Badge>NQ 1m workflow</Badge>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {VALIDATION_CHECKLIST.map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm text-muted">
                <CheckCircle2 className="h-4 w-4 text-accent" />
                {item}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Validation Progress</CardTitle>
            <Badge>{progress.reviewedPct}% reviewed</Badge>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="Total" value={progress.total} />
              <Metric label="Reviewed" value={progress.reviewed} />
              <Metric label="Unreviewed" value={progress.unreviewed} />
              <Metric label="Reviewed %" value={progress.reviewedPct} suffix="%" />
            </div>
            <Field label="Review Filter">
              <Select value={validationFilter} options={VALIDATION_FILTERS} onChange={(event) => setValidationFilter(event.target.value as ValidationFilter)} />
            </Field>
            <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-xs leading-5 text-muted">
              Select a detection row, then press C for Correct, W for Wrong, or U for Unsure.
            </div>
          </CardContent>
        </Card>
      </div>

      {quality.totalDetected === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No detections yet</CardTitle>
            <Badge>Import candles first</Badge>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-stroke bg-canvas px-4 py-3 text-sm text-muted">
              No detections yet. Import real NQ 1m or 5m candle CSV data first.
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Market Data Import Guide</CardTitle>
          <Badge>CSV format</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="grid gap-3">
            <div className="text-sm text-muted">Required columns:</div>
            <pre className="overflow-x-auto rounded-lg border border-stroke bg-canvas p-4 text-sm text-ink">timestamp,open,high,low,close,volume</pre>
            <div className="text-sm text-muted">Accepted timeframe: 1m or 5m.</div>
          </div>
          <div className="grid gap-2">
            <div className="text-sm font-medium text-ink">Troubleshooting</div>
            {[
              "Did you import CSV?",
              "Does it have enough candles?",
              "Are timestamps valid?",
              "Are OHLCV columns present?",
              "Is the timeframe consistent?"
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm text-muted">
                <CheckCircle2 className="h-4 w-4 text-accent" />
                {item}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Time & Symbol Debug</CardTitle>
          <Badge>{timeMode}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Timezone Display">
            <Select value={timeMode} options={TIMEZONE_MODES} onChange={(event) => setTimeMode(event.target.value as TimezoneMode)} />
          </Field>
          <Info label="Data Mode" value={dataMode === "free" ? "Yahoo Finance" : "Stored / CSV"} />
          <Info label="Source File" value={summary.free_data?.provider ?? summary.import_summary?.source_filename ?? summary.source_filename ?? "--"} />
          <Info label="Imported Symbol" value={summary.free_data?.source_symbol ?? summary.import_summary?.detected_symbol ?? summary.detected_symbol ?? "--"} />
          <Info label="Selected Market Lab Symbol" value={symbol} />
          <Info label="Original First CSV Timestamp" value={summary.import_summary?.first_raw_timestamp ?? summary.first_raw_timestamp ?? "--"} />
          <Info label="Original Last CSV Timestamp" value={summary.import_summary?.last_raw_timestamp ?? summary.last_raw_timestamp ?? "--"} />
          <Info label="First Parsed UTC" value={formatTime(summary.first_candle, "UTC")} />
          <Info label="First New York Time" value={formatTime(summary.first_candle, "New York")} />
          <Info label="First Local Browser Time" value={formatTime(summary.first_candle, "Local")} />
          <Info label="Last Parsed UTC" value={formatTime(summary.last_candle, "UTC")} />
          <Info label="Last New York Time" value={formatTime(summary.last_candle, "New York")} />
          <Info label="Last Local Browser Time" value={formatTime(summary.last_candle, "Local")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>TradingView Reference Label Importer</CardTitle>
          <Badge>{summary.reference_labels.length} labels</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Structure Match" value={summary.label_comparison.metrics.structure_match_rate} suffix="%" />
            <Metric label="Sweep Match" value={summary.label_comparison.metrics.sweep_liquidity_grab_match_rate} suffix="%" />
            <Metric label="BOS/CHOCH Match" value={summary.label_comparison.metrics.bos_choch_match_rate} suffix="%" />
          </div>
          <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-xs leading-5 text-muted">
            TradingView indicator columns are imported as reference labels only. Market Lab detector rules are unchanged; this view is for calibration against your indicator.
          </div>
        </CardContent>
      </Card>

      <ReferenceLabelsTable labels={summary.reference_labels} timeMode={timeMode} />

      <LabelComparisonTable comparison={summary.label_comparison} timeMode={timeMode} />

      <MismatchAnalysisCard analysis={summary.mismatch_analysis} timeMode={timeMode} />

      <Card>
        <CardHeader>
          <CardTitle>Swing Detector V2</CardTitle>
          <Badge>{summary.swings_v2_count} accepted</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Mode">
              <Select value={swingMode} options={SWING_MODES} onChange={(event) => setSwingMode(event.target.value as MarketSwingMode)} />
            </Field>
            <Field label="Left Candles">
              <Input
                type="number"
                min={1}
                max={20}
                value={swingLeftCandles}
                onChange={(event) => setSwingLeftCandles((current) => boundedNumber(event.target.value, current, 1, 20))}
              />
            </Field>
            <Field label="Right Candles">
              <Input
                type="number"
                min={1}
                max={20}
                value={swingRightCandles}
                onChange={(event) => setSwingRightCandles((current) => boundedNumber(event.target.value, current, 1, 20))}
              />
            </Field>
            <Field label="Min Distance">
              <Input
                type="number"
                min={0}
                step={0.25}
                value={minSwingDistance}
                onChange={(event) => setMinSwingDistance((current) => boundedNumber(event.target.value, current, 0, 1000, false))}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="V1 Swings" value={summary.swings_v1_count} />
            <Metric label="V2 Swings" value={summary.swings_v2_count} />
            <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-xs leading-5 text-muted sm:col-span-2">
              Market Structure review uses V2. Sweeps, FVGs, and setup candidates stay on the existing detector rules.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Raw Swings vs Protected Structure</CardTitle>
          <Badge>{summary.protected_structure_count ?? 0} protected</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Raw Swings" value={summary.swings_v2_count} />
            <Metric label="Raw Structure" value={summary.structure_sequence?.length ?? 0} />
            <Metric label="Protected Structure" value={summary.protected_structure_count ?? 0} />
          </div>
          <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-xs leading-5 text-muted">
            Protected Structure V2 keeps only nodes connected to BOS, CHOCH, displacement, or protected highs/lows. This is a research overlay only; setup candidate trading logic is unchanged.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Structure Sweep Detector</CardTitle>
          <Badge>{summary.structure_sweeps?.length ?? 0} sweeps</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Min Node Importance">
              <Input
                type="number"
                min={0}
                max={100}
                value={minStructureNodeImportance}
                onChange={(event) => setMinStructureNodeImportance((current) => boundedNumber(event.target.value, current, 0, 100))}
              />
            </Field>
            <Field label="Max Age Minutes">
              <Input
                type="number"
                min={0}
                value={maxStructureSweepAgeMinutes ?? ""}
                placeholder="No limit"
                onChange={(event) => {
                  const value = event.target.value.trim();
                  setMaxStructureSweepAgeMinutes(value ? boundedNumber(value, maxStructureSweepAgeMinutes ?? 0, 0, 100000, false) : null);
                }}
              />
            </Field>
            <Field label="Min Pierce Size">
              <Input
                type="number"
                min={0}
                step={0.25}
                value={minStructurePierceSize}
                onChange={(event) => setMinStructurePierceSize((current) => boundedNumber(event.target.value, current, 0, 1000, false))}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Protected Nodes" value={summary.protected_structure_count ?? 0} />
            <Metric label="Structure Sweeps" value={summary.structure_sweeps?.length ?? 0} />
            <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-xs leading-5 text-muted sm:col-span-2">
              This detector marks sweeps of Protected Structure V2 nodes. Setup candidates still use the existing trading logic.
            </div>
          </div>
        </CardContent>
      </Card>

      <StructureSequenceTable
        title="Raw Structure Sequence"
        badge={`${filteredStructureItems.length}/${structureItems.length} nodes`}
        items={filteredStructureItems}
        feedbacks={feedbacks}
        noteDrafts={noteDrafts}
        selectedDetectedId={selectedDetectedId}
        timeMode={timeMode}
        setNoteDrafts={setNoteDrafts}
        onFeedback={saveFeedback}
        onSelect={setSelectedDetectedId}
      />

      <StructureSequenceTable
        title="Protected Structure V2"
        badge={`${filteredProtectedStructureItems.length}/${protectedStructureItems.length} nodes`}
        items={filteredProtectedStructureItems}
        feedbacks={feedbacks}
        noteDrafts={noteDrafts}
        selectedDetectedId={selectedDetectedId}
        timeMode={timeMode}
        setNoteDrafts={setNoteDrafts}
        onFeedback={saveFeedback}
        onSelect={setSelectedDetectedId}
      />

      <StructureSweepTable
        title="Structure Sweeps"
        badge={`${filteredStructureSweepItems.length}/${structureSweepItems.length} sweeps`}
        items={filteredStructureSweepItems}
        feedbacks={feedbacks}
        noteDrafts={noteDrafts}
        selectedDetectedId={selectedDetectedId}
        timeMode={timeMode}
        setNoteDrafts={setNoteDrafts}
        onFeedback={saveFeedback}
        onSelect={setSelectedDetectedId}
      />

      <Card>
        <CardHeader>
          <CardTitle>Structure Importance Calibration</CardTitle>
          <Badge>{calibrationSwingItems.length} swings</Badge>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Session">
                <Select value={calibrationSession} options={CALIBRATION_SESSIONS} onChange={(event) => setCalibrationSession(event.target.value as CalibrationSession)} />
              </Field>
              <Field label="Swing Type">
                <Select value={calibrationSwingType} options={SWING_TYPES} onChange={(event) => setCalibrationSwingType(event.target.value as SwingTypeFilter)} />
              </Field>
            </div>
            <Button type="button" variant="secondary" onClick={exportCalibrationFeedbackCsv} disabled={!highestImportanceItems.length && !lowestImportanceItems.length}>
              <Download className="h-4 w-4" />
              Export Calibration CSV
            </Button>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <CalibrationTable
              title="Top 20 Highest Importance"
              items={highestImportanceItems}
              feedbacks={feedbacks}
              noteDrafts={noteDrafts}
              selectedDetectedId={selectedDetectedId}
              timeMode={timeMode}
              setNoteDrafts={setNoteDrafts}
              onFeedback={saveFeedback}
              onSelect={setSelectedDetectedId}
            />
            <CalibrationTable
              title="Bottom 20 Lowest Importance"
              items={lowestImportanceItems}
              feedbacks={feedbacks}
              noteDrafts={noteDrafts}
              selectedDetectedId={selectedDetectedId}
              timeMode={timeMode}
              setNoteDrafts={setNoteDrafts}
              onFeedback={saveFeedback}
              onSelect={setSelectedDetectedId}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Database} label="Total Rows" value={summary.candle_count} />
        <MetricCard icon={Layers} label="Missing Rows" value={summary.missing_rows} />
        <MetricCard icon={Activity} label="Duplicate Rows" value={summary.duplicate_rows} />
        <MetricCard icon={Zap} label="Total Detected" value={quality.totalDetected} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Sample Data Workflow</CardTitle>
            <Badge>{summary.timeframe_consistent ? "Consistent" : "Needs Review"}</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Info label="First Candle" value={formatTime(summary.first_candle, timeMode)} />
            <Info label="Last Candle" value={formatTime(summary.last_candle, timeMode)} />
            <Info label="Total Rows" value={summary.candle_count.toString()} />
            <Info label="Timeframe" value={summary.expected_timeframe_minutes ? `${summary.expected_timeframe_minutes} minute` : "--"} />
            <Info label="Missing Rows" value={summary.missing_rows.toString()} />
            <Info label="Duplicate Rows" value={summary.duplicate_rows.toString()} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detector Quality</CardTitle>
            <Badge>{quality.estimatedAccuracy}% estimated</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            <Metric label="Correct" value={quality.correct} />
            <Metric label="Wrong" value={quality.wrong} />
            <Metric label="Unsure" value={quality.unsure} />
            <Metric label="Accuracy" value={quality.estimatedAccuracy} suffix="%" />
          </CardContent>
        </Card>
      </div>

      {summary.import_summary ? (
        <Card>
          <CardHeader>
            <CardTitle>Last Import Summary</CardTitle>
            <Badge>{summary.import_summary.inserted_rows} inserted</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-5">
            <Metric label="Raw Rows" value={summary.import_summary.raw_rows} />
            <Metric label="Valid Rows" value={summary.import_summary.valid_rows} />
            <Metric label="Inserted" value={summary.import_summary.inserted_rows} />
            <Metric label="Duplicates" value={summary.import_summary.duplicate_rows} />
            <Metric label="Missing" value={summary.import_summary.missing_rows} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Session Detector</CardTitle>
            <Badge>{sessionRows.length} sessions</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {sessionRows.map(([name, count]) => (
                <div key={name} className="flex items-center justify-between rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm">
                  <span className="text-muted">{name}</span>
                  <span className="font-medium text-ink">{count}</span>
                </div>
              ))}
              {!sessionRows.length ? <div className="rounded-lg border border-stroke bg-canvas p-4 text-sm text-muted">No candles imported</div> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Missing Rows</CardTitle>
            <Badge>{summary.missing_rows} gaps</Badge>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {summary.missing_timestamps.slice(0, 10).map((row) => (
              <div key={`${row.symbol}-${row.timeframe}-${row.timestamp}`} className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm text-muted">
                {row.symbol} {row.timeframe} / {formatTime(row.timestamp, timeMode)}
              </div>
            ))}
            {!summary.missing_timestamps.length ? <div className="rounded-lg border border-stroke bg-canvas p-4 text-sm text-muted">No missing rows detected</div> : null}
          </CardContent>
        </Card>
      </div>

      <DetectionReviewTable
        title="Market Structure V2"
        badge={`${filteredSwingItems.length}/${swingItems.length} V2 swings`}
        items={filteredSwingItems}
        feedbacks={feedbacks}
        noteDrafts={noteDrafts}
        selectedDetectedId={selectedDetectedId}
        timeMode={timeMode}
        setNoteDrafts={setNoteDrafts}
        onFeedback={saveFeedback}
        onSelect={setSelectedDetectedId}
      />
      <DetectionReviewTable
        title="Liquidity Sweeps"
        badge={`${filteredSweepItems.length}/${sweepItems.length} sweeps`}
        items={filteredSweepItems}
        feedbacks={feedbacks}
        noteDrafts={noteDrafts}
        selectedDetectedId={selectedDetectedId}
        timeMode={timeMode}
        setNoteDrafts={setNoteDrafts}
        onFeedback={saveFeedback}
        onSelect={setSelectedDetectedId}
      />
      <DetectionReviewTable
        title="Fair Value Gaps"
        badge={`${filteredFvgItems.length}/${fvgItems.length} FVGs`}
        items={filteredFvgItems}
        feedbacks={feedbacks}
        noteDrafts={noteDrafts}
        selectedDetectedId={selectedDetectedId}
        timeMode={timeMode}
        setNoteDrafts={setNoteDrafts}
        onFeedback={saveFeedback}
        onSelect={setSelectedDetectedId}
      />
      <DetectionReviewTable
        title="Setup Candidate Log"
        badge={`${filteredCandidateItems.length}/${candidateItems.length} candidates`}
        items={filteredCandidateItems}
        feedbacks={feedbacks}
        noteDrafts={noteDrafts}
        selectedDetectedId={selectedDetectedId}
        timeMode={timeMode}
        setNoteDrafts={setNoteDrafts}
        onFeedback={saveFeedback}
        onSelect={setSelectedDetectedId}
      />
    </div>
  );
}

function ReferenceLabelsTable({ labels, timeMode }: { labels: MarketLabSummary["reference_labels"]; timeMode: TimezoneMode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reference Labels</CardTitle>
        <Badge>{labels.length} TradingView labels</Badge>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs uppercase tracking-normal text-muted">
              <tr className="border-b border-stroke">
                <th className="py-3 font-medium">Timestamp</th>
                <th className="py-3 font-medium">Label Type</th>
                <th className="py-3 font-medium">Label Value</th>
                <th className="py-3 font-medium">Price Level</th>
                <th className="py-3 font-medium">Source Column</th>
              </tr>
            </thead>
            <tbody>
              {labels.slice(0, 80).map((label) => (
                <tr key={label.detected_id} className="border-b border-stroke last:border-0">
                  <td className="py-3 text-muted">{formatTime(label.timestamp, timeMode)}</td>
                  <td className="py-3 font-medium text-ink">{label.label_type}</td>
                  <td className="py-3 text-muted">{label.label_value}</td>
                  <td className="py-3 text-muted">{label.price_level ?? "--"}</td>
                  <td className="py-3 text-muted">{label.source_column}</td>
                </tr>
              ))}
              {!labels.length ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-muted">
                    No TradingView reference label columns found in the last import
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function LabelComparisonTable({ comparison, timeMode }: { comparison: MarketLabSummary["label_comparison"]; timeMode: TimezoneMode }) {
  const rows = [
    ...comparison.matches.map((item) => ({
      key: `match-${item.reference_label_id}-${item.market_detection_id}`,
      status: "Matched",
      labelType: item.label_type,
      referenceTime: item.reference_timestamp,
      marketTime: item.market_timestamp,
      referenceValue: item.reference_value,
      marketValue: item.market_value,
      referencePrice: item.reference_price_level,
      marketPrice: item.market_price_level,
      timeDiff: item.timestamp_difference_seconds,
      priceDiff: item.price_difference,
      source: `${item.source_column} / ${item.market_source}`
    })),
    ...comparison.missed_tradingview_labels.map((item) => ({
      key: `missed-${item.reference_label_id}`,
      status: "Missed TV Label",
      labelType: item.label_type,
      referenceTime: item.timestamp,
      marketTime: null,
      referenceValue: item.label_value,
      marketValue: "--",
      referencePrice: item.price_level,
      marketPrice: null,
      timeDiff: null,
      priceDiff: null,
      source: item.source_column
    })),
    ...comparison.extra_market_lab_detections.map((item) => ({
      key: `extra-${item.market_detection_id}`,
      status: "Extra Market Lab",
      labelType: item.label_type,
      referenceTime: null,
      marketTime: item.timestamp,
      referenceValue: "--",
      marketValue: item.label_value,
      referencePrice: null,
      marketPrice: item.price_level,
      timeDiff: null,
      priceDiff: null,
      source: item.market_source
    }))
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Lab Detection vs TradingView Indicator Label</CardTitle>
        <Badge>{comparison.matches.length} matched</Badge>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Metric label="Missed TV Labels" value={comparison.missed_tradingview_labels.length} />
          <Metric label="Extra Market Lab" value={comparison.extra_market_lab_detections.length} />
          <Metric label="Matched" value={comparison.matches.length} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px] text-left text-sm">
            <thead className="text-xs uppercase tracking-normal text-muted">
              <tr className="border-b border-stroke">
                <th className="py-3 font-medium">Status</th>
                <th className="py-3 font-medium">Label Type</th>
                <th className="py-3 font-medium">TradingView Time</th>
                <th className="py-3 font-medium">Market Lab Time</th>
                <th className="py-3 font-medium">TradingView Value</th>
                <th className="py-3 font-medium">Market Lab Value</th>
                <th className="py-3 font-medium">Time Diff</th>
                <th className="py-3 font-medium">Price Diff</th>
                <th className="py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 120).map((row) => (
                <tr key={row.key} className="border-b border-stroke last:border-0">
                  <td className="py-3 font-medium text-ink">{row.status}</td>
                  <td className="py-3 text-muted">{row.labelType}</td>
                  <td className="py-3 text-muted">{formatTime(row.referenceTime, timeMode)}</td>
                  <td className="py-3 text-muted">{formatTime(row.marketTime, timeMode)}</td>
                  <td className="py-3 text-muted">
                    {row.referenceValue}
                    {row.referencePrice !== null && row.referencePrice !== undefined ? ` @ ${row.referencePrice}` : ""}
                  </td>
                  <td className="py-3 text-muted">
                    {row.marketValue}
                    {row.marketPrice !== null && row.marketPrice !== undefined ? ` @ ${row.marketPrice}` : ""}
                  </td>
                  <td className="py-3 text-muted">{row.timeDiff === null ? "--" : `${row.timeDiff}s`}</td>
                  <td className="py-3 text-muted">{row.priceDiff ?? "--"}</td>
                  <td className="py-3 text-muted">{row.source}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-muted">
                    Import a TradingView CSV with indicator label columns to compare detections
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function MismatchAnalysisCard({ analysis, timeMode }: { analysis: MarketLabSummary["mismatch_analysis"]; timeMode: TimezoneMode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reference Mismatch Analysis</CardTitle>
        <Badge>{analysis.top_examples.length} examples</Badge>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-lg border border-stroke bg-canvas p-4">
            <div className="text-sm font-medium text-ink">Likely Causes</div>
            <div className="mt-3 grid gap-2">
              {analysis.likely_causes.map((item) => (
                <div key={item.cause} className="flex items-center justify-between gap-3 rounded-lg border border-stroke bg-panel px-3 py-2 text-sm">
                  <span className="text-muted">{item.evidence}</span>
                  <span className="font-medium text-ink">{item.count}</span>
                </div>
              ))}
              {!analysis.likely_causes.length ? <div className="text-sm text-muted">No mismatch causes yet.</div> : null}
            </div>
          </div>
          <div className="rounded-lg border border-stroke bg-canvas p-4">
            <div className="text-sm font-medium text-ink">Recommended Detector Changes</div>
            <div className="mt-3 grid gap-2">
              {analysis.recommended_detector_changes.map((item) => (
                <div key={item} className="rounded-lg border border-stroke bg-panel px-3 py-2 text-sm text-muted">
                  {item}
                </div>
              ))}
              {!analysis.recommended_detector_changes.length ? <div className="text-sm text-muted">Import labeled TradingView CSV data to generate recommendations.</div> : null}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] text-left text-sm">
            <thead className="text-xs uppercase tracking-normal text-muted">
              <tr className="border-b border-stroke">
                <th className="py-3 font-medium">Status</th>
                <th className="py-3 font-medium">Type</th>
                <th className="py-3 font-medium">TV Time</th>
                <th className="py-3 font-medium">Market Time</th>
                <th className="py-3 font-medium">TV Price</th>
                <th className="py-3 font-medium">Market Price</th>
                <th className="py-3 font-medium">Time Diff</th>
                <th className="py-3 font-medium">Price Diff</th>
                <th className="py-3 font-medium">Likely Cause</th>
                <th className="py-3 font-medium">Evidence</th>
                <th className="py-3 font-medium">Recommended Change</th>
              </tr>
            </thead>
            <tbody>
              {analysis.top_examples.map((item, index) => (
                <tr key={`${item.status}-${item.label_type}-${index}`} className="border-b border-stroke align-top last:border-0">
                  <td className="py-3 font-medium text-ink">{item.status.replace(/_/g, " ")}</td>
                  <td className="py-3 text-muted">{item.label_type}</td>
                  <td className="py-3 text-muted">{formatTime(item.reference_timestamp ?? null, timeMode)}</td>
                  <td className="py-3 text-muted">{formatTime(item.market_timestamp ?? null, timeMode)}</td>
                  <td className="py-3 text-muted">{item.reference_price_level ?? "--"}</td>
                  <td className="py-3 text-muted">{item.market_price_level ?? "--"}</td>
                  <td className="py-3 text-muted">{item.timestamp_difference_seconds === null || item.timestamp_difference_seconds === undefined ? "--" : `${item.timestamp_difference_seconds}s`}</td>
                  <td className="py-3 text-muted">{item.price_difference ?? "--"}</td>
                  <td className="py-3 text-muted">{item.likely_cause.replace(/_/g, " ")}</td>
                  <td className="max-w-[280px] py-3 text-muted">{item.evidence}</td>
                  <td className="max-w-[300px] py-3 text-muted">{item.recommended_change}</td>
                </tr>
              ))}
              {!analysis.top_examples.length ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-muted">
                    No mismatch examples yet
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-stroke bg-canvas p-4">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-2 text-sm font-medium text-ink">{value}</div>
    </div>
  );
}

function Metric({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-lg border border-stroke bg-canvas p-4">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-ink">
        {value}
        {suffix}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-stroke bg-canvas text-accent">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm text-muted">{label}</div>
          <div className="mt-1 text-3xl font-semibold text-ink">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function StructureSequenceTable({
  title,
  badge,
  items,
  feedbacks,
  noteDrafts,
  selectedDetectedId,
  timeMode,
  setNoteDrafts,
  onFeedback,
  onSelect
}: {
  title: string;
  badge: string;
  items: DetectedItem[];
  feedbacks: DetectorFeedback[];
  noteDrafts: Record<string, string>;
  selectedDetectedId: string | null;
  timeMode: TimezoneMode;
  setNoteDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  onFeedback: (item: DetectedItem, value: DetectorFeedbackValue) => void;
  onSelect: (detectedId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Badge>{badge}</Badge>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="text-xs uppercase tracking-normal text-muted">
              <tr className="border-b border-stroke">
                <th className="py-3 font-medium">Time</th>
                <th className="py-3 font-medium">Type</th>
                <th className="py-3 font-medium">Price</th>
                <th className="py-3 font-medium">Structure State</th>
                <th className="py-3 font-medium">Importance Score</th>
                <th className="py-3 font-medium">Reason</th>
                <th className="py-3 font-medium">Validation</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const feedback = feedbacks.find((row) => row.detected_id === item.detectedId);
                const noteValue = noteDrafts[item.detectedId] ?? feedback?.notes ?? "";
                return (
                  <tr
                    key={item.detectedId}
                    className={`cursor-pointer border-b border-stroke align-top transition last:border-0 ${selectedDetectedId === item.detectedId ? "bg-accent/10" : "hover:bg-canvas"}`}
                    onClick={() => onSelect(item.detectedId)}
                  >
                    <td className="py-3 text-muted">{formatTime(item.timestamp, timeMode)}</td>
                    <td className="py-3 font-medium text-ink">
                      {item.structureType ?? item.label}
                      {item.protectedRole ? <span className="ml-2 text-xs text-muted">{item.protectedRole.replace(/_/g, " ")}</span> : null}
                    </td>
                    <td className="py-3 text-muted">{item.priceLevel}</td>
                    <td className="py-3 text-muted">{item.structureState ?? "--"}</td>
                    <td className="py-3 font-semibold text-ink">{item.importanceScore ?? "--"}</td>
                    <td className="max-w-[360px] py-3 text-muted">{item.reason}</td>
                    <td className="py-3">
                      <div className="grid gap-2">
                        <div className="flex flex-wrap gap-2">
                          <FeedbackButton active={feedback?.user_feedback === "Correct"} value="Correct" icon={CheckCircle2} item={item} onFeedback={onFeedback} />
                          <FeedbackButton active={feedback?.user_feedback === "Wrong"} value="Wrong" icon={XCircle} item={item} onFeedback={onFeedback} />
                          <FeedbackButton active={feedback?.user_feedback === "Unsure"} value="Unsure" item={item} onFeedback={onFeedback} />
                        </div>
                        <Input
                          value={noteValue}
                          placeholder="Structure notes"
                          onChange={(event) => setNoteDrafts((current) => ({ ...current, [item.detectedId]: event.target.value }))}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!items.length ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted">
                    No structure nodes
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function StructureSweepTable({
  title,
  badge,
  items,
  feedbacks,
  noteDrafts,
  selectedDetectedId,
  timeMode,
  setNoteDrafts,
  onFeedback,
  onSelect
}: {
  title: string;
  badge: string;
  items: DetectedItem[];
  feedbacks: DetectorFeedback[];
  noteDrafts: Record<string, string>;
  selectedDetectedId: string | null;
  timeMode: TimezoneMode;
  setNoteDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  onFeedback: (item: DetectedItem, value: DetectorFeedbackValue) => void;
  onSelect: (detectedId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Badge>{badge}</Badge>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1260px] text-left text-sm">
            <thead className="text-xs uppercase tracking-normal text-muted">
              <tr className="border-b border-stroke">
                <th className="py-3 font-medium">Sweep Time</th>
                <th className="py-3 font-medium">Swept Node Type</th>
                <th className="py-3 font-medium">Swept Node Price</th>
                <th className="py-3 font-medium">Swept Node Time</th>
                <th className="py-3 font-medium">Direction</th>
                <th className="py-3 font-medium">Pierce Distance</th>
                <th className="py-3 font-medium">Close-Back Distance</th>
                <th className="py-3 font-medium">Importance Score</th>
                <th className="py-3 font-medium">Reason</th>
                <th className="py-3 font-medium">Validation</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const feedback = feedbacks.find((row) => row.detected_id === item.detectedId);
                const noteValue = noteDrafts[item.detectedId] ?? feedback?.notes ?? "";
                return (
                  <tr
                    key={item.detectedId}
                    className={`cursor-pointer border-b border-stroke align-top transition last:border-0 ${selectedDetectedId === item.detectedId ? "bg-accent/10" : "hover:bg-canvas"}`}
                    onClick={() => onSelect(item.detectedId)}
                  >
                    <td className="py-3 text-muted">{formatTime(item.timestamp, timeMode)}</td>
                    <td className="py-3 font-medium text-ink">{item.sweptNodeType ?? item.label}</td>
                    <td className="py-3 text-muted">{item.sweptNodePrice ?? item.priceLevel}</td>
                    <td className="py-3 text-muted">{formatTime(item.sweptNodeTime ?? null, timeMode)}</td>
                    <td className="py-3 text-muted">{item.direction ?? "--"}</td>
                    <td className="py-3 text-muted">{item.pierceDistance ?? "--"}</td>
                    <td className="py-3 text-muted">{item.closeBackDistance ?? "--"}</td>
                    <td className="py-3 font-semibold text-ink">{item.importanceScore ?? "--"}</td>
                    <td className="max-w-[340px] py-3 text-muted">{item.reason}</td>
                    <td className="py-3">
                      <div className="grid gap-2">
                        <div className="flex flex-wrap gap-2">
                          <FeedbackButton active={feedback?.user_feedback === "Correct"} value="Correct" icon={CheckCircle2} item={item} onFeedback={onFeedback} />
                          <FeedbackButton active={feedback?.user_feedback === "Wrong"} value="Wrong" icon={XCircle} item={item} onFeedback={onFeedback} />
                          <FeedbackButton active={feedback?.user_feedback === "Unsure"} value="Unsure" item={item} onFeedback={onFeedback} />
                        </div>
                        <Input
                          value={noteValue}
                          placeholder="Structure sweep notes"
                          onChange={(event) => setNoteDrafts((current) => ({ ...current, [item.detectedId]: event.target.value }))}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!items.length ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-muted">
                    No structure sweeps
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function CalibrationTable({
  title,
  items,
  feedbacks,
  noteDrafts,
  selectedDetectedId,
  timeMode,
  setNoteDrafts,
  onFeedback,
  onSelect
}: {
  title: string;
  items: CalibrationSwingItem[];
  feedbacks: DetectorFeedback[];
  noteDrafts: Record<string, string>;
  selectedDetectedId: string | null;
  timeMode: TimezoneMode;
  setNoteDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  onFeedback: (item: DetectedItem, value: DetectorFeedbackValue) => void;
  onSelect: (detectedId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-stroke bg-canvas">
      <div className="flex items-center justify-between border-b border-stroke px-4 py-3">
        <div className="text-sm font-medium text-ink">{title}</div>
        <Badge>{items.length}</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase tracking-normal text-muted">
            <tr className="border-b border-stroke">
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Session</th>
              <th className="px-4 py-3 font-medium">Level</th>
              <th className="px-4 py-3 font-medium">Importance</th>
              <th className="px-4 py-3 font-medium">Validation</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const feedback = feedbacks.find((row) => row.detected_id === item.detectedId);
              const noteValue = noteDrafts[item.detectedId] ?? feedback?.notes ?? "";
              return (
                <tr
                  key={`${title}-${item.detectedId}`}
                  className={`cursor-pointer border-b border-stroke align-top transition last:border-0 ${selectedDetectedId === item.detectedId ? "bg-accent/10" : "hover:bg-panel"}`}
                  onClick={() => onSelect(item.detectedId)}
                >
                  <td className="px-4 py-3 text-muted">{formatTime(item.timestamp, timeMode)}</td>
                  <td className="px-4 py-3 font-medium text-ink">{item.swingType}</td>
                  <td className="px-4 py-3 text-muted">{item.session}</td>
                  <td className="px-4 py-3 text-muted">{item.priceLevel}</td>
                  <td className="px-4 py-3 font-semibold text-ink">{item.importanceScore ?? "--"}</td>
                  <td className="px-4 py-3">
                    <div className="grid gap-2">
                      <div className="flex flex-wrap gap-2">
                        <FeedbackButton active={feedback?.user_feedback === "Correct"} value="Correct" icon={CheckCircle2} item={item} onFeedback={onFeedback} />
                        <FeedbackButton active={feedback?.user_feedback === "Wrong"} value="Wrong" icon={XCircle} item={item} onFeedback={onFeedback} />
                        <FeedbackButton active={feedback?.user_feedback === "Unsure"} value="Unsure" item={item} onFeedback={onFeedback} />
                      </div>
                      <Input
                        value={noteValue}
                        placeholder="Calibration notes"
                        onChange={(event) => setNoteDrafts((current) => ({ ...current, [item.detectedId]: event.target.value }))}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {!items.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No swings match the current filters
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetectionReviewTable({
  title,
  badge,
  items,
  feedbacks,
  noteDrafts,
  selectedDetectedId,
  timeMode,
  setNoteDrafts,
  onFeedback,
  onSelect
}: {
  title: string;
  badge: string;
  items: DetectedItem[];
  feedbacks: DetectorFeedback[];
  noteDrafts: Record<string, string>;
  selectedDetectedId: string | null;
  timeMode: TimezoneMode;
  setNoteDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  onFeedback: (item: DetectedItem, value: DetectorFeedbackValue) => void;
  onSelect: (detectedId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Badge>{badge}</Badge>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1480px] text-left text-sm">
            <thead className="text-xs uppercase tracking-normal text-muted">
              <tr className="border-b border-stroke">
                <th className="py-3 font-medium">Time</th>
                <th className="py-3 font-medium">CSV Source</th>
                <th className="py-3 font-medium">Source OHLC</th>
                <th className="py-3 font-medium">Detection</th>
                <th className="py-3 font-medium">Level</th>
                <th className="py-3 font-medium">Level Source</th>
                <th className="py-3 font-medium">Confidence</th>
                <th className="py-3 font-medium">Importance</th>
                <th className="py-3 font-medium">Reason</th>
                <th className="py-3 font-medium">Candles Used</th>
                <th className="py-3 font-medium">Validation</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const feedback = feedbacks.find((row) => row.detected_id === item.detectedId);
                const noteValue = noteDrafts[item.detectedId] ?? feedback?.notes ?? "";
                return (
                  <tr
                    key={item.detectedId}
                    className={`cursor-pointer border-b border-stroke align-top transition last:border-0 ${selectedDetectedId === item.detectedId ? "bg-accent/10" : "hover:bg-canvas"}`}
                    onClick={() => onSelect(item.detectedId)}
                  >
                    <td className="py-3 text-muted">{formatTime(item.timestamp, timeMode)}</td>
                    <td className="max-w-[260px] py-3 text-xs leading-5 text-muted">
                      <div>CSV row: {item.originalCsvRowIndex ?? "--"}</div>
                      <div>Original: {item.originalTimestamp ?? "--"}</div>
                      <div>Parsed: {formatTime(item.parsedTimestamp ?? item.timestamp, timeMode)}</div>
                      {item.detectorType === "swing" ? (
                        <>
                          <div>Swing row: {item.swingSourceRowIndex ?? "--"}</div>
                          <div>Source time: {item.swingSourceTimestamp ?? "--"}</div>
                        </>
                      ) : null}
                    </td>
                    <td className="max-w-[220px] py-3 text-xs leading-5 text-muted">
                      <div>{formatOhlc(item.candleOpen, item.candleHigh, item.candleLow, item.candleClose)}</div>
                      {item.detectorType === "swing" ? (
                        <div className="mt-1">{formatOhlc(item.swingSourceOpen, item.swingSourceHigh, item.swingSourceLow, item.swingSourceClose)}</div>
                      ) : null}
                    </td>
                    <td className="py-3 font-medium text-ink">{item.label}</td>
                    <td className="py-3 text-muted">{item.displayedLevel ?? item.priceLevel}</td>
                    <td className="py-3 text-muted">{item.levelSource ?? "--"}</td>
                    <td className="py-3 text-muted">{item.confidenceScore ?? "--"}</td>
                    <td className="py-3 text-muted">{item.importanceScore ?? "--"}</td>
                    <td className="max-w-[260px] py-3 text-muted">{item.reason}</td>
                    <td className="max-w-[320px] py-3 text-xs leading-5 text-muted">{item.candlesUsed.join(" | ")}</td>
                    <td className="py-3">
                      <div className="grid gap-2">
                        <div className="flex flex-wrap gap-2">
                          <FeedbackButton active={feedback?.user_feedback === "Correct"} value="Correct" icon={CheckCircle2} item={item} onFeedback={onFeedback} />
                          <FeedbackButton active={feedback?.user_feedback === "Wrong"} value="Wrong" icon={XCircle} item={item} onFeedback={onFeedback} />
                          <FeedbackButton active={feedback?.user_feedback === "Unsure"} value="Unsure" item={item} onFeedback={onFeedback} />
                        </div>
                        <Input
                          value={noteValue}
                          placeholder="Validation notes"
                          onChange={(event) => setNoteDrafts((current) => ({ ...current, [item.detectedId]: event.target.value }))}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!items.length ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-muted">
                    No detections
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function FeedbackButton({
  active,
  value,
  icon: Icon,
  item,
  onFeedback
}: {
  active: boolean;
  value: DetectorFeedbackValue;
  icon?: LucideIcon;
  item: DetectedItem;
  onFeedback: (item: DetectedItem, value: DetectorFeedbackValue) => void;
}) {
  return (
    <Button type="button" size="sm" variant={active ? "primary" : "secondary"} onClick={() => onFeedback(item, value)}>
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {value}
    </Button>
  );
}
