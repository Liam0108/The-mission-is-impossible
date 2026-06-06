import type {
  FvgEvent,
  LabelComparison,
  LiquidityEvent,
  MarketCandle,
  MarketCsvColumnPreview,
  MarketImportSummary,
  MarketLabSummary,
  MismatchAnalysis,
  MarketStructureNode,
  MarketStructureSweep,
  MarketSwing,
  MarketSwingConfig,
  MarketSwingMode,
  MissingMarketRow,
  SetupCandidate,
  TradingViewReferenceLabel
} from "@/lib/types";

const SUPPORTED_TIMEFRAMES: Record<string, number> = { "1m": 1, "5m": 5 };
const REQUIRED_CANDLE_FIELDS = ["timestamp", "open", "high", "low", "close"] as const;
const TIME_COLUMN_ALIASES = ["timestamp", "time"];
const VOLUME_COLUMN_ALIASES = ["volume", "plot"];
const DEFAULT_SWING_CONFIG: MarketSwingConfig = { mode: "normal", left_candles: 2, right_candles: 2, min_swing_distance: 8 };
const SWING_MODE_THRESHOLDS: Record<MarketSwingMode, number> = {
  aggressive: 40,
  normal: 55,
  strict: 70
};
const STRUCTURE_LEVEL_TOLERANCE = 4;
const REFERENCE_LABEL_TIME_TOLERANCE_MULTIPLIER = 2;
const SOURCE_LEVEL_LABELS: Record<string, string> = {
  previous_day_high: "previous day high",
  previous_day_low: "previous day low",
  session_high: "session high",
  session_low: "session low"
};
const REFERENCE_LABEL_PATTERNS: Array<[string, string[]]> = [
  ["HH", ["HH", "HIGHER_HIGH", "HIGHER HIGH"]],
  ["HL", ["HL", "HIGHER_LOW", "HIGHER LOW"]],
  ["LH", ["LH", "LOWER_HIGH", "LOWER HIGH"]],
  ["LL", ["LL", "LOWER_LOW", "LOWER LOW"]],
  ["BOS", ["BOS", "BREAK_OF_STRUCTURE", "BREAK OF STRUCTURE"]],
  ["CHOCH", ["CHOCH", "CHANGE_OF_CHARACTER", "CHANGE OF CHARACTER"]],
  ["Liquidity Grab", ["LIQUIDITY_GRAB", "LIQUIDITY GRAB", "LIQ_GRAB", "LIQ GRAB", "SWEEP", "GRAB", "LIQUIDITY"]],
  ["FVG", ["FVG", "FAIR_VALUE_GAP", "FAIR VALUE GAP"]],
  ["Premium", ["PREMIUM"]],
  ["Equilibrium", ["EQUILIBRIUM", "EQ", "EQB"]],
  ["Discount", ["DISCOUNT"]]
];
type StructureSweepConfigInput = {
  min_node_importance?: number;
  max_age_minutes?: number | null;
  min_pierce_size?: number;
};

function headerKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseCsvRows(raw: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const next = raw[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  if (cell || row.length) {
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
  }

  return rows;
}

function normalizeTimeframe(value: string) {
  const timeframe = value.trim().toLowerCase();
  if (!(timeframe in SUPPORTED_TIMEFRAMES)) throw new Error("Only 1m and 5m candle CSV files are supported");
  return timeframe;
}

function parseNumber(value: string, field: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Invalid ${field}: ${value}`);
  return number;
}

function findHeader(headers: string[], aliases: string[]) {
  const normalized = new Map(headers.map((header) => [headerKey(header), header]));
  for (const alias of aliases) {
    const found = normalized.get(alias);
    if (found) return found;
  }
  return null;
}

function symbolFromFilename(sourceFilename?: string | null) {
  if (!sourceFilename) return null;
  const normalized = sourceFilename.toUpperCase().replace(/[.\-\s]+/g, "_");
  const tokens = new Set(normalized.split("_").filter(Boolean));
  for (const symbol of ["MNQ", "NQ", "MES", "ES", "GC"]) {
    if (tokens.has(symbol) || normalized.startsWith(symbol)) return symbol;
  }
  return null;
}

function labelTextKey(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function classifyReferenceLabel(text: string) {
  const key = labelTextKey(text);
  const spaced = key.replace(/_/g, " ");
  const tokens = new Set(key.split("_"));
  for (const [labelType, patterns] of REFERENCE_LABEL_PATTERNS) {
    for (const pattern of patterns) {
      const patternKey = labelTextKey(pattern);
      const patternSpaced = patternKey.replace(/_/g, " ");
      if (["HH", "HL", "LH", "LL", "EQ"].includes(patternKey)) {
        if (tokens.has(patternKey)) return labelType;
        continue;
      }
      if (key.includes(patternKey) || spaced.includes(patternSpaced)) return labelType;
    }
  }
  return null;
}

function detectReferenceLabelColumns(headers: string[], mappedSources: Set<string>) {
  return headers
    .filter((header) => !mappedSources.has(header))
    .map((header) => ({ source: header, label_type: classifyReferenceLabel(header) }))
    .filter((column): column is { source: string; label_type: string } => Boolean(column.label_type));
}

function isActiveReferenceValue(value: string) {
  const text = value.trim();
  return Boolean(text) && !["0", "0.0", "false", "no", "na", "n/a", "nan", "null", "none", "-"].includes(text.toLowerCase());
}

function extractReferencePrice(value: string) {
  const direct = Number(value.trim());
  if (Number.isFinite(direct) && Math.abs(direct) >= 100) return round(direct);
  for (const match of value.matchAll(/[-+]?\d+(?:\.\d+)?/g)) {
    const parsed = Number(match[0]);
    if (Number.isFinite(parsed) && Math.abs(parsed) >= 100) return round(parsed);
  }
  return null;
}

function referenceLabelValue(rawValue: string, headerLabelType: string | null, valueLabelType: string | null) {
  const text = rawValue.trim();
  if (["1", "1.0", "true", "yes"].includes(text.toLowerCase()) && headerLabelType) return headerLabelType;
  return text || valueLabelType || headerLabelType || "Label";
}

export function analyzeMarketCsvColumns(raw: string): MarketCsvColumnPreview {
  const rows = parseCsvRows(raw);
  const [headers, ...body] = rows;
  if (!headers) throw new Error("CSV file is empty");

  const mapping: MarketCsvColumnPreview["column_mapping"] = [];
  const timestamp = findHeader(headers, TIME_COLUMN_ALIASES);
  const open = findHeader(headers, ["open"]);
  const high = findHeader(headers, ["high"]);
  const low = findHeader(headers, ["low"]);
  const close = findHeader(headers, ["close"]);
  const volume = findHeader(headers, VOLUME_COLUMN_ALIASES);
  const mappedSources = new Set<string>();

  const addMapping = (source: string | null, target: MarketCsvColumnPreview["column_mapping"][number]["target"]) => {
    if (!source) return;
    mapping.push({ source, target });
    mappedSources.add(source);
  };

  addMapping(timestamp, "timestamp");
  addMapping(open, "open");
  addMapping(high, "high");
  addMapping(low, "low");
  addMapping(close, "close");
  addMapping(volume, "volume");

  const referenceLabelColumns = detectReferenceLabelColumns(headers, mappedSources);
  const referenceSources = new Set(referenceLabelColumns.map((column) => column.source));
  const missingRequired = REQUIRED_CANDLE_FIELDS.filter((field) => !mapping.some((item) => item.target === field));
  const warnings = [
    ...missingRequired.map((field) => `Missing required ${field === "timestamp" ? "time or timestamp" : field} column.`),
    ...(volume ? [] : ["Volume column missing. Import will use 0 for volume."])
  ];

  return {
    row_count: body.length,
    column_mapping: mapping,
    reference_label_columns: referenceLabelColumns,
    missing_required: missingRequired,
    warnings,
    ignored_columns: headers.filter((header) => !mappedSources.has(header) && !referenceSources.has(header)),
    can_import: missingRequired.length === 0
  };
}

function timestampMs(value: string) {
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) throw new Error(`Invalid timestamp: ${value}`);
  return ms;
}

function dayKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function sessionForTimestamp(value: string) {
  const date = new Date(value);
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= 18 * 60 || minutes < 3 * 60) return "Asia";
  if (minutes >= 3 * 60 && minutes < 8 * 60 + 30) return "London";
  if (minutes >= 8 * 60 + 30 && minutes < 9 * 60 + 30) return "Pre-Market";
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) return "New York";
  return "After-Hours";
}

function round(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function detectedId(detectorType: string, ...parts: Array<string | number>) {
  return `${detectorType}-${parts.join("-").replace(/[:+ ]/g, "_")}`;
}

function candleRef(candle: MarketCandle) {
  const source = candle.source_row_index !== null && candle.source_row_index !== undefined ? ` row:${candle.source_row_index}` : "";
  const raw = candle.raw_timestamp ? ` raw:${candle.raw_timestamp}` : "";
  return `${candle.timestamp}${source}${raw} O:${round(candle.open)} H:${round(candle.high)} L:${round(candle.low)} C:${round(candle.close)}`;
}

function detectionDebug(candle: MarketCandle, displayedLevel: number, levelSource: string) {
  const roundedLevel = round(displayedLevel);
  return {
    original_csv_row_index: candle.source_row_index ?? null,
    original_timestamp: candle.raw_timestamp ?? candle.timestamp,
    parsed_timestamp: candle.timestamp,
    candle_open: round(candle.open),
    candle_high: round(candle.high),
    candle_low: round(candle.low),
    candle_close: round(candle.close),
    displayed_level: roundedLevel,
    level_source: levelSource
  };
}

function swingDebug(candle: MarketCandle, displayedLevel: number, levelSource: string) {
  return {
    ...detectionDebug(candle, displayedLevel, levelSource),
    swing_source_row_index: candle.source_row_index ?? null,
    swing_source_timestamp: candle.raw_timestamp ?? candle.timestamp,
    swing_source_open: round(candle.open),
    swing_source_high: round(candle.high),
    swing_source_low: round(candle.low),
    swing_source_close: round(candle.close)
  };
}

function copyDetectionDebug(row: {
  original_csv_row_index?: number | null;
  original_timestamp?: string | null;
  parsed_timestamp?: string | null;
  candle_open?: number | null;
  candle_high?: number | null;
  candle_low?: number | null;
  candle_close?: number | null;
  displayed_level?: number | null;
  level_source?: string | null;
}) {
  return {
    original_csv_row_index: row.original_csv_row_index ?? null,
    original_timestamp: row.original_timestamp ?? null,
    parsed_timestamp: row.parsed_timestamp ?? null,
    candle_open: row.candle_open ?? null,
    candle_high: row.candle_high ?? null,
    candle_low: row.candle_low ?? null,
    candle_close: row.candle_close ?? null,
    displayed_level: row.displayed_level ?? null,
    level_source: row.level_source ?? null
  };
}

function referenceLabelsFromRow(
  row: string[],
  headerMap: Map<string, number>,
  candle: MarketCandle,
  referenceLabelColumns: Array<{ source: string; label_type: string }>
): TradingViewReferenceLabel[] {
  return referenceLabelColumns.flatMap((column, index) => {
    const rawValue = (row[headerMap.get(column.source) ?? -1] || "").trim();
    if (!isActiveReferenceValue(rawValue)) return [];
    const valueLabelType = classifyReferenceLabel(rawValue);
    const labelType = valueLabelType || column.label_type;
    if (!labelType) return [];
    const priceLevel = extractReferencePrice(rawValue);
    return [{
      detected_id: detectedId("tv_label", candle.symbol, candle.timeframe, candle.timestamp, column.source, labelType, index),
      timestamp: candle.timestamp,
      symbol: candle.symbol,
      timeframe: candle.timeframe,
      label_type: labelType,
      label_value: referenceLabelValue(rawValue, column.label_type, valueLabelType),
      price_level: priceLevel,
      source_column: column.source,
      raw_value: rawValue,
      original_csv_row_index: candle.source_row_index ?? null,
      original_timestamp: candle.raw_timestamp ?? null
    }];
  });
}

function copyStructureDebug(node: MarketStructureNode | null) {
  if (!node) return {};
  return {
    swept_structure_node_id: node.detected_id,
    swept_structure_node: `${node.timeframe} ${node.protected_level_role || node.structure_type} @ ${node.price}`,
    swept_timeframe: node.timeframe
  };
}

function copySwingSourceDebug(swing: MarketSwing) {
  return {
    original_csv_row_index: swing.original_csv_row_index ?? null,
    original_timestamp: swing.original_timestamp ?? null,
    parsed_timestamp: swing.parsed_timestamp ?? null,
    candle_open: swing.candle_open ?? null,
    candle_high: swing.candle_high ?? null,
    candle_low: swing.candle_low ?? null,
    candle_close: swing.candle_close ?? null,
    displayed_level: swing.displayed_level ?? null,
    level_source: swing.level_source ?? null
  };
}

function structureSide(kind: string) {
  return kind === "swing_high" ? "high" : "low";
}

function structureType(side: string, price: number, lastHigh: number | null, lastLow: number | null) {
  if (side === "high") return lastHigh === null || price > lastHigh ? "HH" : "LH";
  return lastLow === null || price > lastLow ? "HL" : "LL";
}

function structureState(lastHighType: string | null, lastLowType: string | null, highCount: number, lowCount: number) {
  if (highCount < 2 || lowCount < 2) return "Neutral";
  if (lastHighType === "HH" && lastLowType === "HL") return "Bullish";
  if (lastHighType === "LH" && lastLowType === "LL") return "Bearish";
  if (lastHighType && lastLowType) return "Transition";
  return "Neutral";
}

function legType(value: string) {
  return value === "HH" || value === "LL" ? "impulse_leg" : "pullback_leg";
}

function referenceLevelsNearNode(candles: MarketCandle[], node: MarketStructureNode) {
  if (!candles.length) return [];
  const nodeTime = new Date(node.timestamp);
  const price = node.price;
  const ordered = [...candles].sort((a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp));
  const byDay = new Map<string, MarketCandle[]>();
  for (const candle of ordered) {
    byDay.set(dayKey(candle.timestamp), [...(byDay.get(dayKey(candle.timestamp)) ?? []), candle]);
  }

  const days = [...byDay.keys()].sort();
  const currentDay = dayKey(node.timestamp);
  const previousDay = days[days.indexOf(currentDay) - 1];
  const levels: Array<[string, number]> = [];
  const previousRows = previousDay ? byDay.get(previousDay) ?? [] : [];
  if (previousRows.length) {
    levels.push(["PDH", Math.max(...previousRows.map((candle) => candle.high))]);
    levels.push(["PDL", Math.min(...previousRows.map((candle) => candle.low))]);
  }

  const session = sessionForTimestamp(node.timestamp);
  const sessionRows = ordered.filter((candle) => dayKey(candle.timestamp) === currentDay && new Date(candle.timestamp) <= nodeTime && sessionForTimestamp(candle.timestamp) === session);
  if (sessionRows.length) {
    levels.push(["session high", Math.max(...sessionRows.map((candle) => candle.high))]);
    levels.push(["session low", Math.min(...sessionRows.map((candle) => candle.low))]);
  }

  return levels.filter(([, level]) => Math.abs(price - level) <= STRUCTURE_LEVEL_TOLERANCE).map(([label]) => label);
}

function eventMatchesNode(event: LiquidityEvent, node: MarketStructureNode) {
  if (timestampMs(event.timestamp) <= timestampMs(node.timestamp)) return false;
  if (event.event_type === "sweep_above_high" && node.side !== "high") return false;
  if (event.event_type === "sweep_below_low" && node.side !== "low") return false;
  return Math.abs(event.price_level - node.price) <= STRUCTURE_LEVEL_TOLERANCE || Math.abs((event.price ?? event.price_level) - node.price) <= STRUCTURE_LEVEL_TOLERANCE;
}

function findSweptStructureNode(event: LiquidityEvent, structureNodes: MarketStructureNode[]) {
  const matches = structureNodes.filter((node) => eventMatchesNode(event, node));
  if (!matches.length) return null;
  return [...matches].sort(
    (a, b) =>
      Math.abs(event.price_level - a.price) - Math.abs(event.price_level - b.price) ||
      b.importance_score - a.importance_score ||
      timestampMs(a.timestamp) - timestampMs(b.timestamp)
  )[0];
}

function sourceLevelLabel(source: string) {
  return SOURCE_LEVEL_LABELS[source] ?? source.replace(/_/g, " ");
}

function candidateReasons(value: string[] | string) {
  return Array.isArray(value) ? value : value.split("\n").filter(Boolean);
}

function sampleMetadata(candles: MarketCandle[], missingRows: MissingMarketRow[]) {
  const rows = [...candles].sort((a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp));
  const timeframes = new Set(rows.map((candle) => candle.timeframe));
  const sourceFilenames = rows.map((candle) => candle.source_filename).filter(Boolean) as string[];
  const sourceSymbols = rows.map((candle) => candle.source_symbol).filter(Boolean) as string[];
  const importedSymbols = rows.map((candle) => candle.symbol);
  return {
    first_candle: rows[0]?.timestamp ?? null,
    last_candle: rows.at(-1)?.timestamp ?? null,
    first_raw_timestamp: rows[0]?.raw_timestamp ?? null,
    last_raw_timestamp: rows.at(-1)?.raw_timestamp ?? null,
    source_filename: sourceFilenames[0] ?? null,
    detected_symbol: sourceSymbols[0] ?? importedSymbols[0] ?? null,
    timeframe_consistent: rows.length > 0 && timeframes.size === 1 && missingRows.length === 0,
    expected_timeframe_minutes: rows.length > 0 && timeframes.size === 1 ? SUPPORTED_TIMEFRAMES[rows[0].timeframe] : null
  };
}

export function normalizeMarketSwingConfig(config?: Partial<MarketSwingConfig>): MarketSwingConfig {
  const mode = config?.mode && config.mode in SWING_MODE_THRESHOLDS ? config.mode : DEFAULT_SWING_CONFIG.mode;
  return {
    mode,
    left_candles: clamp(Math.round(config?.left_candles ?? DEFAULT_SWING_CONFIG.left_candles), 1, 20),
    right_candles: clamp(Math.round(config?.right_candles ?? DEFAULT_SWING_CONFIG.right_candles), 1, 20),
    min_swing_distance: clamp(Number(config?.min_swing_distance ?? DEFAULT_SWING_CONFIG.min_swing_distance), 0, 1000)
  };
}

export function detectMarketMissingRows(candles: MarketCandle[]): MissingMarketRow[] {
  const missing: MissingMarketRow[] = [];
  const ordered = [...candles].sort((a, b) => `${a.symbol}-${a.timeframe}-${a.timestamp}`.localeCompare(`${b.symbol}-${b.timeframe}-${b.timestamp}`));
  const groups = new Map<string, MarketCandle[]>();

  for (const candle of ordered) {
    const key = `${candle.symbol}|${candle.timeframe}`;
    groups.set(key, [...(groups.get(key) ?? []), candle]);
  }

  for (const rows of groups.values()) {
    const sorted = [...rows].sort((a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp));
    const expectedMs = SUPPORTED_TIMEFRAMES[sorted[0]?.timeframe ?? "1m"] * 60 * 1000;
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      const gap = timestampMs(current.timestamp) - timestampMs(previous.timestamp);
      if (gap <= expectedMs) continue;
      const missingCount = Math.floor(gap / expectedMs) - 1;
      for (let offset = 1; offset <= missingCount; offset += 1) {
        missing.push({
          symbol: previous.symbol,
          timeframe: previous.timeframe,
          timestamp: new Date(timestampMs(previous.timestamp) + expectedMs * offset).toISOString()
        });
      }
    }
  }

  return missing;
}

export function parseMarketCsv(raw: string, defaultSymbol = "NQ", defaultTimeframe = "1m", sourceFilename?: string | null) {
  const rows = parseCsvRows(raw);
  const [headers, ...body] = rows;
  if (!headers) throw new Error("CSV file is empty");

  const preview = analyzeMarketCsvColumns(raw);
  if (!preview.can_import) throw new Error(`Missing required candle columns: ${preview.missing_required.join(", ")}`);
  const headerMap = new Map(headers.map((header, index) => [header, index]));
  const sourceFor = (target: MarketCsvColumnPreview["column_mapping"][number]["target"]) => preview.column_mapping.find((item) => item.target === target)?.source;

  const candles: MarketCandle[] = [];
  const referenceLabels: TradingViewReferenceLabel[] = [];
  const seen = new Set<string>();
  let duplicateRows = 0;
  const filenameSymbol = symbolFromFilename(sourceFilename);

  for (let bodyIndex = 0; bodyIndex < body.length; bodyIndex += 1) {
    const row = body[bodyIndex];
    const symbolHeader = findHeader(headers, ["symbol"]);
    const timeframeHeader = findHeader(headers, ["timeframe"]);
    const csvSymbol = (row[headerMap.get(symbolHeader ?? "") ?? -1] || "").trim().toUpperCase();
    const symbol = (csvSymbol || defaultSymbol).trim().toUpperCase();
    const timeframe = normalizeTimeframe(row[headerMap.get(timeframeHeader ?? "") ?? -1] || defaultTimeframe);
    const rawTimestamp = row[headerMap.get(sourceFor("timestamp") as string) as number];
    const timestamp = new Date(rawTimestamp).toISOString();
    const volumeSource = sourceFor("volume");
    const candle: MarketCandle = {
      symbol,
      timeframe,
      timestamp,
      raw_timestamp: rawTimestamp,
      source_row_index: bodyIndex + 2,
      source_symbol: csvSymbol || filenameSymbol || symbol,
      source_filename: sourceFilename ?? null,
      open: parseNumber(row[headerMap.get(sourceFor("open") as string) as number], "open"),
      high: parseNumber(row[headerMap.get(sourceFor("high") as string) as number], "high"),
      low: parseNumber(row[headerMap.get(sourceFor("low") as string) as number], "low"),
      close: parseNumber(row[headerMap.get(sourceFor("close") as string) as number], "close"),
      volume: volumeSource ? parseNumber(row[headerMap.get(volumeSource) as number], "volume") : 0
    };
    if (candle.high < candle.low) throw new Error(`Invalid candle range at ${candle.timestamp}`);
    const key = `${candle.symbol}|${candle.timeframe}|${candle.timestamp}`;
    if (seen.has(key)) {
      duplicateRows += 1;
      continue;
    }
    seen.add(key);
    candles.push(candle);
    referenceLabels.push(...referenceLabelsFromRow(row, headerMap, candle, preview.reference_label_columns));
  }

  const missingRows = detectMarketMissingRows(candles);
  return {
    candles,
    importSummary: {
      raw_rows: body.length,
      valid_rows: candles.length,
      inserted_rows: candles.length,
      duplicate_rows: duplicateRows,
      missing_rows: missingRows.length,
      missing_timestamps: missingRows.slice(0, 50),
      column_mapping: preview.column_mapping,
      reference_label_columns: preview.reference_label_columns,
      reference_labels: referenceLabels,
      warnings: preview.warnings,
      ignored_columns: preview.ignored_columns,
      ...sampleMetadata(candles, missingRows)
    } satisfies MarketImportSummary
  };
}

export function detectMarketStructure(candles: MarketCandle[]): MarketSwing[] {
  const rows = [...candles].sort((a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp));
  const swings: MarketSwing[] = [];
  let lastSwingHigh: number | null = null;
  let lastSwingLow: number | null = null;

  for (let index = 1; index < rows.length - 1; index += 1) {
    const previous = rows[index - 1];
    const current = rows[index];
    const following = rows[index + 1];

    if (current.high > previous.high && current.high > following.high) {
      const label = lastSwingHigh === null ? "Swing High" : current.high > lastSwingHigh ? "HH" : "LH";
      lastSwingHigh = current.high;
      swings.push({
        detected_id: detectedId("swing", current.symbol, current.timeframe, current.timestamp, label),
        timestamp: current.timestamp,
        symbol: current.symbol,
        timeframe: current.timeframe,
        kind: "swing_high",
        label,
        price: round(current.high),
        price_level: round(current.high),
        reason: "Current candle high is above both the previous and next candle highs.",
        candles_used: [candleRef(previous), candleRef(current), candleRef(following)],
        confidence_score: 60,
        ...swingDebug(current, current.high, "high")
      });
    }

    if (current.low < previous.low && current.low < following.low) {
      const label = lastSwingLow === null ? "Swing Low" : current.low > lastSwingLow ? "HL" : "LL";
      lastSwingLow = current.low;
      swings.push({
        detected_id: detectedId("swing", current.symbol, current.timeframe, current.timestamp, label),
        timestamp: current.timestamp,
        symbol: current.symbol,
        timeframe: current.timeframe,
        kind: "swing_low",
        label,
        price: round(current.low),
        price_level: round(current.low),
        reason: "Current candle low is below both the previous and next candle lows.",
        candles_used: [candleRef(previous), candleRef(current), candleRef(following)],
        confidence_score: 60,
        ...swingDebug(current, current.low, "low")
      });
    }
  }

  return swings;
}

function scoreSwingV2(current: MarketCandle, windowRows: MarketCandle[], price: number, lastAcceptedPrice: number | null, minDistance: number) {
  const highs = windowRows.map((candle) => candle.high);
  const lows = windowRows.map((candle) => candle.low);
  const swingSize = Math.max(price - Math.min(...lows), Math.max(...highs) - price, 0);
  const distanceBase = Math.max(minDistance, 0.25);
  const distance = lastAcceptedPrice === null ? minDistance : Math.abs(price - lastAcceptedPrice);
  const sizeScore = clamp((swingSize / distanceBase) * 40, 0, 40);
  const candleRange = Math.max(current.high - current.low, 0.01);
  const displacementScore = clamp((Math.abs(current.close - current.open) / candleRange) * 30, 0, 30);
  const averageVolume = windowRows.reduce((total, candle) => total + candle.volume, 0) / Math.max(windowRows.length, 1);
  const volumeRatio = averageVolume > 0 ? current.volume / averageVolume : 1;
  const volumeScore = volumeRatio >= 1.5 ? 30 : volumeRatio >= 1.1 ? 20 : volumeRatio >= 0.9 ? 10 : 0;
  const score = round(sizeScore + displacementScore + volumeScore, 1);

  return {
    distance: round(distance, 2),
    sizeScore: round(sizeScore, 1),
    displacementScore: round(displacementScore, 1),
    volumeScore: round(volumeScore, 1),
    score
  };
}

function swingV2Reason(config: MarketSwingConfig, scores: ReturnType<typeof scoreSwingV2>, threshold: number) {
  return [
    `Accepted by Swing V2 ${config.mode} mode.`,
    `${config.left_candles} left / ${config.right_candles} right candles confirmed the local extreme.`,
    `Distance ${scores.distance} >= ${config.min_swing_distance} points.`,
    `Score ${scores.score} >= ${threshold} from size ${scores.sizeScore}, displacement ${scores.displacementScore}, volume ${scores.volumeScore}.`
  ].join(" ");
}

function structureImportanceV1(current: MarketCandle, contextRows: MarketCandle[], label: string, kind: string) {
  const priorRows = contextRows.slice(0, -1);
  const averageRange = priorRows.reduce((sum, candle) => sum + Math.max(candle.high - candle.low, 0.01), 0) / Math.max(priorRows.length, 1);
  const body = Math.abs(current.close - current.open);
  const displacement = Math.min(Math.round((body / Math.max(averageRange, 0.01)) * 18), 25);
  const bosPotential = label === "HH" || label === "LL" ? 20 : label === "HL" || label === "LH" ? 10 : 6;
  const chochPotential = (kind === "swing_high" && label === "LH") || (kind === "swing_low" && label === "HL") ? 12 : 4;
  const priorHigh = Math.max(...priorRows.map((candle) => candle.high));
  const priorLow = Math.min(...priorRows.map((candle) => candle.low));
  const sweptHigh = current.high > priorHigh && current.close < priorHigh;
  const sweptLow = current.low < priorLow && current.close > priorLow;
  const liquidityInteraction = sweptHigh || sweptLow ? 20 : current.high >= priorHigh || current.low <= priorLow ? 12 : 4;
  const session = sessionForTimestamp(current.timestamp);
  const sessionSignificance = session === "New York" ? 10 : session === "Pre-Market" || session === "London" ? 8 : session === "Asia" ? 5 : 3;
  const averageVolume = priorRows.reduce((sum, candle) => sum + candle.volume, 0) / Math.max(priorRows.length, 1);
  const volumeRatio = averageVolume > 0 ? current.volume / averageVolume : 1;
  const volumeExpansion = volumeRatio >= 1.5 ? 13 : volumeRatio >= 1.15 ? 9 : volumeRatio >= 0.9 ? 5 : 0;
  const score = Math.min(100, displacement + bosPotential + chochPotential + liquidityInteraction + sessionSignificance + volumeExpansion);

  return {
    score,
    reason: `Structure importance ${score}/100: displacement ${displacement}, BOS potential ${bosPotential}, CHOCH potential ${chochPotential}, liquidity ${liquidityInteraction}, session ${sessionSignificance}, volume ${volumeExpansion}.`
  };
}

export function detectMarketStructureV2(candles: MarketCandle[], config?: Partial<MarketSwingConfig>): MarketSwing[] {
  const swingConfig = normalizeMarketSwingConfig(config);
  const rows = [...candles].sort((a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp));
  const swings: MarketSwing[] = [];
  let lastSwingHigh: number | null = null;
  let lastSwingLow: number | null = null;
  const threshold = SWING_MODE_THRESHOLDS[swingConfig.mode];

  for (let index = swingConfig.left_candles; index < rows.length - swingConfig.right_candles; index += 1) {
    const current = rows[index];
    const leftRows = rows.slice(index - swingConfig.left_candles, index);
    const rightRows = rows.slice(index + 1, index + 1 + swingConfig.right_candles);
    const windowRows = [...leftRows, current, ...rightRows];
    const isSwingHigh = current.high > Math.max(...leftRows.map((candle) => candle.high)) && current.high > Math.max(...rightRows.map((candle) => candle.high));
    const isSwingLow = current.low < Math.min(...leftRows.map((candle) => candle.low)) && current.low < Math.min(...rightRows.map((candle) => candle.low));

    if (isSwingHigh) {
      const scores = scoreSwingV2(current, windowRows, current.high, lastSwingHigh, swingConfig.min_swing_distance);
      if (scores.distance >= swingConfig.min_swing_distance && scores.score >= threshold) {
        const label = lastSwingHigh === null ? "Swing High" : current.high > lastSwingHigh ? "HH" : "LH";
        const importance = structureImportanceV1(current, rows.slice(Math.max(0, index - 20), index + 1), label, "swing_high");
        lastSwingHigh = current.high;
        swings.push({
          detected_id: detectedId("swing_v2", current.symbol, current.timeframe, current.timestamp, label),
          timestamp: current.timestamp,
          symbol: current.symbol,
          timeframe: current.timeframe,
          kind: "swing_high",
          label,
          price: round(current.high),
          price_level: round(current.high),
          reason: `${swingV2Reason(swingConfig, scores, threshold)} ${importance.reason}`,
          candles_used: windowRows.map(candleRef),
          confidence_score: Math.min(Math.round(scores.score), 100),
          structure_importance_score: importance.score,
          structure_importance_reason: importance.reason,
          ...swingDebug(current, current.high, "high")
        });
      }
    }

    if (isSwingLow) {
      const scores = scoreSwingV2(current, windowRows, current.low, lastSwingLow, swingConfig.min_swing_distance);
      if (scores.distance >= swingConfig.min_swing_distance && scores.score >= threshold) {
        const label = lastSwingLow === null ? "Swing Low" : current.low > lastSwingLow ? "HL" : "LL";
        const importance = structureImportanceV1(current, rows.slice(Math.max(0, index - 20), index + 1), label, "swing_low");
        lastSwingLow = current.low;
        swings.push({
          detected_id: detectedId("swing_v2", current.symbol, current.timeframe, current.timestamp, label),
          timestamp: current.timestamp,
          symbol: current.symbol,
          timeframe: current.timeframe,
          kind: "swing_low",
          label,
          price: round(current.low),
          price_level: round(current.low),
          reason: `${swingV2Reason(swingConfig, scores, threshold)} ${importance.reason}`,
          candles_used: windowRows.map(candleRef),
          confidence_score: Math.min(Math.round(scores.score), 100),
          structure_importance_score: importance.score,
          structure_importance_reason: importance.reason,
          ...swingDebug(current, current.low, "low")
        });
      }
    }
  }

  return swings;
}

export function buildMarketStructureSequence(swings: MarketSwing[], candles: MarketCandle[] = [], liquidityEvents: LiquidityEvent[] = []): MarketStructureNode[] {
  const orderedSwings = [...swings].sort((a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp));
  const nodes: MarketStructureNode[] = [];
  let lastHigh: number | null = null;
  let lastLow: number | null = null;
  let lastHighType: string | null = null;
  let lastLowType: string | null = null;
  let highCount = 0;
  let lowCount = 0;

  for (const swing of orderedSwings) {
    const side = structureSide(swing.kind);
    const price = swing.price_level;
    const type = structureType(side, price, lastHigh, lastLow);
    if (side === "high") {
      highCount += 1;
      lastHigh = price;
      lastHighType = type;
    } else {
      lowCount += 1;
      lastLow = price;
      lastLowType = type;
    }

    const state = structureState(lastHighType, lastLowType, highCount, lowCount);
    const node: MarketStructureNode = {
      detected_id: detectedId("structure", swing.symbol, swing.timeframe, swing.timestamp, type),
      source_swing_id: swing.detected_id,
      timestamp: swing.timestamp,
      symbol: swing.symbol,
      timeframe: swing.timeframe,
      side,
      structure_type: type,
      price,
      structure_state: state,
      leg_type: legType(type),
      protected_level_role: null,
      near_reference_levels: [],
      later_swept: false,
      swept_by_event_id: null,
      importance_score: 0,
      reason: "",
      ...copySwingSourceDebug(swing)
    };
    nodes.push(node);

    if (state === "Bullish") {
      const latestHl = [...nodes].reverse().find((item) => item.structure_type === "HL");
      if (latestHl) latestHl.protected_level_role = "protected_low";
    } else if (state === "Bearish") {
      const latestLh = [...nodes].reverse().find((item) => item.structure_type === "LH");
      if (latestLh) latestLh.protected_level_role = "protected_high";
    }
  }

  return nodes.map((node) => {
    const nextNode = { ...node, near_reference_levels: referenceLevelsNearNode(candles, node) };
    const sweptBy = liquidityEvents.find((event) => eventMatchesNode(event, nextNode));
    nextNode.later_swept = Boolean(sweptBy);
    nextNode.swept_by_event_id = sweptBy?.detected_id ?? null;
    const sourceSwing = orderedSwings.find((swing) => swing.detected_id === node.source_swing_id);
    const reasons: string[] = [];
    let score = 10;

    if ((nextNode.structure_state === "Bullish" && ["HH", "HL"].includes(nextNode.structure_type)) || (nextNode.structure_state === "Bearish" && ["LH", "LL"].includes(nextNode.structure_type))) {
      score += 20;
      reasons.push(`belongs to clear ${nextNode.structure_state.toLowerCase()} sequence`);
    } else if (nextNode.structure_state === "Transition") {
      score += 10;
      reasons.push("marks a transition sequence");
    } else {
      reasons.push("not enough sequence context yet");
    }

    if (nextNode.protected_level_role) {
      score += 25;
      reasons.push(nextNode.protected_level_role.replace(/_/g, " "));
    }

    const swingImportance = sourceSwing?.structure_importance_score ?? sourceSwing?.confidence_score ?? 0;
    if (swingImportance >= 70) {
      score += 15;
      reasons.push("strong displacement swing");
    } else if (swingImportance >= 50) {
      score += 10;
      reasons.push("moderate displacement swing");
    }

    if (nextNode.near_reference_levels.length) {
      score += 15;
      reasons.push(`near ${nextNode.near_reference_levels.join(", ")}`);
    }

    if (nextNode.later_swept) {
      score += 20;
      reasons.push("later became swept liquidity");
    }

    nextNode.importance_score = Math.round(clamp(score, 0, 100));
    nextNode.reason = `${nextNode.structure_type} ${nextNode.leg_type.replace(/_/g, " ")} in ${nextNode.structure_state} state; ${reasons.join("; ")}.`;
    return nextNode;
  });
}

function candleBySwing(candles: MarketCandle[], swing: MarketSwing) {
  return candles.find((candle) => timestampMs(candle.timestamp) === timestampMs(swing.timestamp)) ?? null;
}

function displacementProfile(candles: MarketCandle[], swing: MarketSwing, lookback = 10) {
  const rows = [...candles].sort((a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp));
  const candle = candleBySwing(rows, swing);
  if (!candle) return { created: false, score: 0, reason: "No source candle available for displacement check." };

  const index = rows.indexOf(candle);
  const priorRows = rows.slice(Math.max(0, index - lookback), index);
  const averageRange = priorRows.reduce((sum, row) => sum + Math.max(row.high - row.low, 0.01), 0) / Math.max(priorRows.length, 1);
  const body = Math.abs(candle.close - candle.open);
  const candleRange = Math.max(candle.high - candle.low, 0.01);
  const bodyRatio = averageRange > 0 ? body / averageRange : 0;
  const closePosition = (candle.close - candle.low) / candleRange;
  const directionalClose = swing.kind === "swing_high" ? closePosition >= 0.7 : closePosition <= 0.3;
  const volumeRows = priorRows.length ? priorRows : [candle];
  const averageVolume = volumeRows.reduce((sum, row) => sum + row.volume, 0) / Math.max(volumeRows.length, 1);
  const volumeRatio = averageVolume > 0 ? candle.volume / averageVolume : 1;
  const score = Math.round(clamp((Math.min(bodyRatio, 2.5) / 2.5) * 55 + (directionalClose ? 20 : 8) + (volumeRatio >= 1.5 ? 25 : volumeRatio >= 1.15 ? 15 : volumeRatio >= 0.9 ? 8 : 0), 0, 100));
  return {
    created: bodyRatio >= 1.15 && directionalClose && score >= 55,
    score,
    reason: `displacement score ${score}/100 from body ${round(bodyRatio, 2)}x average range and volume ${round(volumeRatio, 2)}x`
  };
}

export function buildProtectedMarketStructureV2(swings: MarketSwing[], candles: MarketCandle[] = [], liquidityEvents: LiquidityEvent[] = []): MarketStructureNode[] {
  const orderedSwings = [...swings].sort((a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp));
  const orderedCandles = [...candles].sort((a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp));
  const rawNodes: MarketStructureNode[] = [];
  let lastHigh: number | null = null;
  let lastLow: number | null = null;
  let lastHighType: string | null = null;
  let lastLowType: string | null = null;
  let highCount = 0;
  let lowCount = 0;
  let priorState = "Neutral";

  for (const swing of orderedSwings) {
    const side = structureSide(swing.kind);
    const price = swing.price_level;
    const previousHigh = lastHigh;
    const previousLow = lastLow;
    const type = structureType(side, price, lastHigh, lastLow);
    const causedBos = (side === "high" && previousHigh !== null && price > previousHigh) || (side === "low" && previousLow !== null && price < previousLow);
    const causedChoch = (priorState === "Bearish" && side === "high" && causedBos) || (priorState === "Bullish" && side === "low" && causedBos);
    const displacement = displacementProfile(orderedCandles, swing);

    if (side === "high") {
      highCount += 1;
      lastHigh = price;
      lastHighType = type;
    } else {
      lowCount += 1;
      lastLow = price;
      lastLowType = type;
    }

    const state = structureState(lastHighType, lastLowType, highCount, lowCount);
    rawNodes.push({
      detected_id: detectedId("protected_structure_v2", swing.symbol, swing.timeframe, swing.timestamp, type),
      source_swing_id: swing.detected_id,
      timestamp: swing.timestamp,
      symbol: swing.symbol,
      timeframe: swing.timeframe,
      side,
      structure_type: type,
      price,
      structure_state: state,
      leg_type: legType(type),
      protected_level_role: null,
      near_reference_levels: [],
      later_swept: false,
      swept_by_event_id: null,
      importance_score: 0,
      reason: "",
      caused_bos: causedBos,
      caused_choch: causedChoch,
      created_displacement: displacement.created,
      displacement_score: displacement.score,
      ...copySwingSourceDebug(swing)
    });

    if (causedBos && side === "high") {
      const latestLow = [...rawNodes.slice(0, -1)].reverse().find((item) => item.side === "low");
      if (latestLow) latestLow.protected_level_role = "protected_low";
    } else if (causedBos && side === "low") {
      const latestHigh = [...rawNodes.slice(0, -1)].reverse().find((item) => item.side === "high");
      if (latestHigh) latestHigh.protected_level_role = "protected_high";
    }

    priorState = state;
  }

  return rawNodes.reduce<MarketStructureNode[]>((kept, node) => {
    const nextNode = { ...node, near_reference_levels: referenceLevelsNearNode(orderedCandles, node) };
    const sweptBy = liquidityEvents.find((event) => eventMatchesNode(event, nextNode));
    nextNode.later_swept = Boolean(sweptBy);
    nextNode.swept_by_event_id = sweptBy?.detected_id ?? null;
    const reasons: string[] = [];
    let score = 15;

    if (nextNode.caused_bos) {
      score += 25;
      reasons.push("caused BOS");
    }
    if (nextNode.caused_choch) {
      score += 25;
      reasons.push("caused CHOCH");
    }
    if (nextNode.created_displacement) {
      score += 18;
      reasons.push(`created displacement (${nextNode.displacement_score}/100)`);
    }
    if (nextNode.protected_level_role) {
      score += 28;
      reasons.push(nextNode.protected_level_role.replace(/_/g, " "));
    }
    if (!reasons.length) return kept;
    if (nextNode.near_reference_levels.length) {
      score += 10;
      reasons.push(`near ${nextNode.near_reference_levels.join(", ")}`);
    }
    if (nextNode.later_swept) {
      score += 12;
      reasons.push("later swept");
    }

    const roleLabel = nextNode.protected_level_role ? nextNode.protected_level_role.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : nextNode.structure_type;
    nextNode.importance_score = Math.round(clamp(score, 0, 100));
    nextNode.reason = `Protected Structure V2 kept ${roleLabel} at ${nextNode.price}: ${reasons.join("; ")}. State ${nextNode.structure_state}; leg ${nextNode.leg_type.replace(/_/g, " ")}.`;
    kept.push(nextNode);
    return kept;
  }, []);
}

export function enrichMarketSweepsWithStructure(liquidityEvents: LiquidityEvent[], structureNodes: MarketStructureNode[]): LiquidityEvent[] {
  return liquidityEvents.map((event) => {
    const node = findSweptStructureNode(event, structureNodes);
    const direction = event.event_type === "sweep_above_high" ? "above" : "below";
    if (node) {
      const nodeLabel = node.protected_level_role || node.structure_type;
      const score = Math.round(clamp(40 + node.importance_score * 0.5 + (node.protected_level_role ? 10 : 0), 0, 100));
      return {
        ...event,
        swept_level_type: nodeLabel,
        sweep_importance_score: score,
        sweep_importance_reason: `Sweep ${direction} ${node.timeframe} ${nodeLabel}; linked node importance ${node.importance_score}.`,
        ...copyStructureDebug(node)
      };
    }

    const sourceLabel = sourceLevelLabel(event.source);
    const sourceScore = event.source.startsWith("previous_day") ? 62 : event.source.startsWith("session") ? 54 : 35;
    return {
      ...event,
      swept_level_type: sourceLabel,
      swept_structure_node_id: null,
      swept_structure_node: null,
      swept_timeframe: event.timeframe,
      sweep_importance_score: sourceScore,
      sweep_importance_reason: `Sweep ${direction} ${sourceLabel}; no matching prior structure node within ${STRUCTURE_LEVEL_TOLERANCE} points.`
    };
  });
}

function structureSweepNodeType(node: MarketStructureNode) {
  if (node.protected_level_role === "protected_high") return "protected high";
  if (node.protected_level_role === "protected_low") return "protected low";
  return node.structure_type;
}

function structureSweepDirection(node: MarketStructureNode) {
  if (node.side === "high" && (["HH", "LH"].includes(node.structure_type) || node.protected_level_role === "protected_high")) return "above";
  if (node.side === "low" && (["LL", "HL"].includes(node.structure_type) || node.protected_level_role === "protected_low")) return "below";
  return null;
}

function structureSweepScore(node: MarketStructureNode, pierceDistance: number, closeBackDistance: number) {
  const protectedBonus = node.protected_level_role ? 12 : 0;
  const pierceScore = Math.min(pierceDistance * 4, 14);
  const closeBackScore = Math.min(closeBackDistance * 3, 10);
  return Math.round(clamp(25 + node.importance_score * 0.5 + protectedBonus + pierceScore + closeBackScore, 0, 100));
}

export function detectMarketStructureSweeps(candles: MarketCandle[], structureNodes: MarketStructureNode[], config: StructureSweepConfigInput = {}): MarketStructureSweep[] {
  const orderedCandles = [...candles].sort((a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp));
  const orderedNodes = [...structureNodes].sort((a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp));
  const minNodeImportance = Math.round(clamp(config.min_node_importance ?? 50, 0, 100));
  const maxAgeMinutes = config.max_age_minutes ?? null;
  const minPierceSize = Math.max(config.min_pierce_size ?? 0, 0);
  const events: MarketStructureSweep[] = [];
  const seen = new Set<string>();

  for (const candle of orderedCandles) {
    for (const node of orderedNodes) {
      if (timestampMs(candle.timestamp) <= timestampMs(node.timestamp)) continue;
      if (node.importance_score < minNodeImportance) continue;
      const ageMinutes = (timestampMs(candle.timestamp) - timestampMs(node.timestamp)) / 60000;
      if (maxAgeMinutes !== null && ageMinutes > maxAgeMinutes) continue;

      const direction = structureSweepDirection(node);
      let pierceDistance = 0;
      let closeBackDistance = 0;
      let swept = false;
      if (direction === "above") {
        pierceDistance = candle.high - node.price;
        closeBackDistance = node.price - candle.close;
        swept = pierceDistance > 0 && closeBackDistance > 0;
      } else if (direction === "below") {
        pierceDistance = node.price - candle.low;
        closeBackDistance = candle.close - node.price;
        swept = pierceDistance > 0 && closeBackDistance > 0;
      } else {
        continue;
      }

      if (!swept || pierceDistance < minPierceSize) continue;
      const key = `${candle.timestamp}|${node.detected_id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const nodeType = structureSweepNodeType(node);
      const score = structureSweepScore(node, pierceDistance, closeBackDistance);
      events.push({
        detected_id: detectedId("structure_sweep", candle.symbol, candle.timeframe, candle.timestamp, node.detected_id),
        timestamp: candle.timestamp,
        symbol: candle.symbol,
        timeframe: candle.timeframe,
        direction,
        event_type: direction === "above" ? "sweep_above_structure" : "sweep_below_structure",
        swept_node_id: node.detected_id,
        swept_node_time: node.timestamp,
        swept_node_type: nodeType,
        swept_structure_type: node.structure_type,
        swept_node_price: round(node.price),
        swept_node_state: node.structure_state,
        pierce_distance: round(pierceDistance),
        close_back_distance: round(closeBackDistance),
        importance_score: score,
        reason: `Price swept ${direction} ${node.timeframe} ${nodeType} at ${round(node.price)} and closed back inside by ${round(closeBackDistance)} points. Node importance ${node.importance_score}; pierce ${round(pierceDistance)}.`,
        candles_used: [candleRef(candle), `structure_node:${node.detected_id}`],
        ...detectionDebug(candle, node.price, nodeType)
      });
    }
  }

  return events.sort((a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp));
}

function markStructureNodesSweptByStructureSweeps(structureNodes: MarketStructureNode[], structureSweeps: MarketStructureSweep[]) {
  const firstSweepByNode = new Map(structureSweeps.map((event) => [event.swept_node_id, event]));
  return structureNodes.map((node) => {
    const event = firstSweepByNode.get(node.detected_id);
    if (!event) return node;
    const alreadySwept = node.later_swept;
    return {
      ...node,
      later_swept: true,
      swept_by_event_id: event.detected_id,
      importance_score: alreadySwept ? node.importance_score : Math.round(clamp(node.importance_score + 20, 0, 100)),
      reason: alreadySwept ? node.reason : `${node.reason} Later swept by structure sweep.`
    };
  });
}

export function detectMarketLiquidity(candles: MarketCandle[]): LiquidityEvent[] {
  const rows = [...candles].sort((a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp));
  const byDay = new Map<string, MarketCandle[]>();
  const events: LiquidityEvent[] = [];
  const sessionLevels = new Map<string, { high: number; low: number }>();

  for (const candle of rows) {
    const key = dayKey(candle.timestamp);
    byDay.set(key, [...(byDay.get(key) ?? []), candle]);
  }

  const days = [...byDay.keys()].sort();
  const dayLevels = new Map(days.map((day) => {
    const dayRows = byDay.get(day) ?? [];
    return [day, { high: Math.max(...dayRows.map((candle) => candle.high)), low: Math.min(...dayRows.map((candle) => candle.low)) }];
  }));

  for (const candle of rows) {
    const session = sessionForTimestamp(candle.timestamp);
    const currentDay = dayKey(candle.timestamp);
    const previousDay = days[days.indexOf(currentDay) - 1];
    const previousLevels = previousDay ? dayLevels.get(previousDay) : null;

    if (previousLevels?.high && candle.high > previousLevels.high && candle.close < previousLevels.high) {
      events.push({
        detected_id: detectedId("sweep", candle.symbol, candle.timeframe, candle.timestamp, "pdh"),
        timestamp: candle.timestamp,
        symbol: candle.symbol,
        timeframe: candle.timeframe,
        session,
        event_type: "sweep_above_high",
        source: "previous_day_high",
        level: round(previousLevels.high),
        price: round(candle.high),
        price_level: round(previousLevels.high),
        reason: "Candle traded above previous day high and closed back below that level.",
        candles_used: [candleRef(candle), `previous_day_high:${round(previousLevels.high)}`],
        confidence_score: 72,
        ...detectionDebug(candle, previousLevels.high, "previous_day_high")
      });
    }
    if (previousLevels?.low && candle.low < previousLevels.low && candle.close > previousLevels.low) {
      events.push({
        detected_id: detectedId("sweep", candle.symbol, candle.timeframe, candle.timestamp, "pdl"),
        timestamp: candle.timestamp,
        symbol: candle.symbol,
        timeframe: candle.timeframe,
        session,
        event_type: "sweep_below_low",
        source: "previous_day_low",
        level: round(previousLevels.low),
        price: round(candle.low),
        price_level: round(previousLevels.low),
        reason: "Candle traded below previous day low and closed back above that level.",
        candles_used: [candleRef(candle), `previous_day_low:${round(previousLevels.low)}`],
        confidence_score: 72,
        ...detectionDebug(candle, previousLevels.low, "previous_day_low")
      });
    }

    const sessionKey = `${currentDay}|${session}`;
    const levels = sessionLevels.get(sessionKey);
    if (levels) {
      if (candle.high > levels.high && candle.close < levels.high) {
        events.push({
          detected_id: detectedId("sweep", candle.symbol, candle.timeframe, candle.timestamp, "session_high"),
          timestamp: candle.timestamp,
          symbol: candle.symbol,
          timeframe: candle.timeframe,
          session,
          event_type: "sweep_above_high",
          source: "session_high",
          level: round(levels.high),
          price: round(candle.high),
          price_level: round(levels.high),
          reason: "Candle traded above the active session high and closed back below that level.",
          candles_used: [candleRef(candle), `session_high:${round(levels.high)}`],
          confidence_score: 64,
          ...detectionDebug(candle, levels.high, "session_high")
        });
      }
      if (candle.low < levels.low && candle.close > levels.low) {
        events.push({
          detected_id: detectedId("sweep", candle.symbol, candle.timeframe, candle.timestamp, "session_low"),
          timestamp: candle.timestamp,
          symbol: candle.symbol,
          timeframe: candle.timeframe,
          session,
          event_type: "sweep_below_low",
          source: "session_low",
          level: round(levels.low),
          price: round(candle.low),
          price_level: round(levels.low),
          reason: "Candle traded below the active session low and closed back above that level.",
          candles_used: [candleRef(candle), `session_low:${round(levels.low)}`],
          confidence_score: 64,
          ...detectionDebug(candle, levels.low, "session_low")
        });
      }
      levels.high = Math.max(levels.high, candle.high);
      levels.low = Math.min(levels.low, candle.low);
    } else {
      sessionLevels.set(sessionKey, { high: candle.high, low: candle.low });
    }
  }

  return events;
}

export function detectMarketFvgs(candles: MarketCandle[]): FvgEvent[] {
  const rows = [...candles].sort((a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp));
  const fvgs: FvgEvent[] = [];

  for (let index = 2; index < rows.length; index += 1) {
    const first = rows[index - 2];
    const current = rows[index];

    if (first.high < current.low) {
      const lower = first.high;
      const upper = current.low;
      const returned = rows.slice(index + 1).some((later) => later.low <= upper && later.high >= lower);
      fvgs.push({
        detected_id: detectedId("fvg", current.symbol, current.timeframe, current.timestamp, "bullish"),
        timestamp: current.timestamp,
        symbol: current.symbol,
        timeframe: current.timeframe,
        fvg_type: "bullish",
        lower_bound: round(lower),
        upper_bound: round(upper),
        gap_size: round(upper - lower),
        returned,
        price_level: round((lower + upper) / 2),
        reason: "Bullish three-candle FVG: candle 1 high is below candle 3 low.",
        candles_used: [candleRef(first), candleRef(rows[index - 1]), candleRef(current)],
        confidence_score: returned ? 68 : 62,
        ...detectionDebug(current, (lower + upper) / 2, "fvg_midpoint")
      });
    }

    if (first.low > current.high) {
      const lower = current.high;
      const upper = first.low;
      const returned = rows.slice(index + 1).some((later) => later.high >= lower && later.low <= upper);
      fvgs.push({
        detected_id: detectedId("fvg", current.symbol, current.timeframe, current.timestamp, "bearish"),
        timestamp: current.timestamp,
        symbol: current.symbol,
        timeframe: current.timeframe,
        fvg_type: "bearish",
        lower_bound: round(lower),
        upper_bound: round(upper),
        gap_size: round(upper - lower),
        returned,
        price_level: round((lower + upper) / 2),
        reason: "Bearish three-candle FVG: candle 1 low is above candle 3 high.",
        candles_used: [candleRef(first), candleRef(rows[index - 1]), candleRef(current)],
        confidence_score: returned ? 68 : 62,
        ...detectionDebug(current, (lower + upper) / 2, "fvg_midpoint")
      });
    }
  }

  return fvgs;
}

export function generateMarketCandidates(candles: MarketCandle[], liquidity: LiquidityEvent[], fvgs: FvgEvent[], swings: MarketSwing[]): SetupCandidate[] {
  const rows = [...candles].sort((a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp));
  const indexByTimestamp = new Map(rows.map((candle, index) => [candle.timestamp, index]));
  const swingByTimestamp = new Map(swings.map((swing) => [swing.timestamp, swing.label]));
  const candidates: SetupCandidate[] = [];
  const keys = new Set<string>();

  for (const event of liquidity) {
    const direction = event.event_type === "sweep_above_high" ? "Short" : "Long";
    const key = `${event.timestamp}|Sweep Reversal|${direction}|${event.symbol}`;
    if (keys.has(key)) continue;
    keys.add(key);
    candidates.push({
      detected_id: detectedId("candidate", event.symbol, event.timeframe, event.timestamp, "sweep_reversal", direction),
      timestamp: event.timestamp,
      symbol: event.symbol,
      timeframe: event.timeframe,
      direction,
      setup_type: "Sweep Reversal",
      confidence_score: event.source.startsWith("previous_day") ? 68 : 60,
      reasons: [`${event.source} ${event.event_type.replace(/_/g, " ")}`],
      price_level: event.price_level,
      reason: `Candidate created from ${event.source} ${event.event_type.replace(/_/g, " ")}.`,
      candles_used: event.candles_used,
      ...copyDetectionDebug(event)
    });
  }

  for (const fvg of fvgs) {
    const fvgIndex = indexByTimestamp.get(fvg.timestamp);
    if (fvgIndex === undefined) continue;
    const recentEvents = liquidity.filter((event) => {
      const eventIndex = indexByTimestamp.get(event.timestamp);
      return event.symbol === fvg.symbol && event.timeframe === fvg.timeframe && eventIndex !== undefined && fvgIndex - eventIndex >= 0 && fvgIndex - eventIndex <= 10;
    });
    const recentSwing = swingByTimestamp.get(fvg.timestamp);

    if (fvg.fvg_type === "bullish" && recentEvents.some((event) => event.event_type === "sweep_below_low")) {
      const key = `${fvg.timestamp}|Fabio Long candidate|Long|${fvg.symbol}`;
      if (!keys.has(key)) {
        keys.add(key);
        candidates.push({
          detected_id: detectedId("candidate", fvg.symbol, fvg.timeframe, fvg.timestamp, "fabio_long"),
          timestamp: fvg.timestamp,
          symbol: fvg.symbol,
          timeframe: fvg.timeframe,
          direction: "Long",
          setup_type: "Fabio Long candidate",
          confidence_score: Math.min(74 + (fvg.gap_size >= 2 ? 5 : 0) + (recentSwing === "HL" || recentSwing === "HH" ? 4 : 0), 95),
          reasons: ["Recent sweep below low", "Bullish FVG", recentSwing ? "Structure support present" : "Structure not confirmed"],
          price_level: fvg.price_level,
          reason: "Recent sweep below low followed by bullish FVG within the lookback window.",
          candles_used: [...fvg.candles_used, ...recentEvents.map((event) => event.detected_id)],
          ...copyDetectionDebug(fvg)
        });
      }
    }

    if (fvg.fvg_type === "bearish" && recentEvents.some((event) => event.event_type === "sweep_above_high")) {
      const key = `${fvg.timestamp}|Fabio Short candidate|Short|${fvg.symbol}`;
      if (!keys.has(key)) {
        keys.add(key);
        candidates.push({
          detected_id: detectedId("candidate", fvg.symbol, fvg.timeframe, fvg.timestamp, "fabio_short"),
          timestamp: fvg.timestamp,
          symbol: fvg.symbol,
          timeframe: fvg.timeframe,
          direction: "Short",
          setup_type: "Fabio Short candidate",
          confidence_score: Math.min(74 + (fvg.gap_size >= 2 ? 5 : 0) + (recentSwing === "LH" || recentSwing === "LL" ? 4 : 0), 95),
          reasons: ["Recent sweep above high", "Bearish FVG", recentSwing ? "Structure support present" : "Structure not confirmed"],
          price_level: fvg.price_level,
          reason: "Recent sweep above high followed by bearish FVG within the lookback window.",
          candles_used: [...fvg.candles_used, ...recentEvents.map((event) => event.detected_id)],
          ...copyDetectionDebug(fvg)
        });
      }
    }
  }

  return candidates.sort((a, b) => timestampMs(b.timestamp) - timestampMs(a.timestamp));
}

function labelGroup(labelType: string) {
  if (["HH", "HL", "LH", "LL"].includes(labelType)) return "structure";
  if (["BOS", "CHOCH"].includes(labelType)) return "bos_choch";
  if (labelType === "Liquidity Grab") return "sweep_liquidity";
  if (labelType === "FVG") return "fvg";
  return "zone";
}

function comparisonDetectionEntries(
  protectedStructure: MarketStructureNode[],
  structureSweeps: MarketStructureSweep[],
  liquidity: LiquidityEvent[],
  fvgs: FvgEvent[]
) {
  const entries: Array<{ detected_id: string; timestamp: string; label_type: string; label_value: string; price_level: number | null; source: string; original_csv_row_index?: number | null }> = [];

  for (const node of protectedStructure) {
    if (["HH", "HL", "LH", "LL"].includes(node.structure_type)) {
      entries.push({
        detected_id: node.detected_id,
        timestamp: node.timestamp,
        label_type: node.structure_type,
        label_value: node.protected_level_role || node.structure_type,
        price_level: round(node.price),
        source: "Protected Structure V2",
        original_csv_row_index: node.original_csv_row_index ?? null
      });
    }
    if (node.caused_bos) {
      entries.push({
        detected_id: `${node.detected_id}-bos`,
        timestamp: node.timestamp,
        label_type: "BOS",
        label_value: node.structure_type,
        price_level: round(node.price),
        source: "Protected Structure V2",
        original_csv_row_index: node.original_csv_row_index ?? null
      });
    }
    if (node.caused_choch) {
      entries.push({
        detected_id: `${node.detected_id}-choch`,
        timestamp: node.timestamp,
        label_type: "CHOCH",
        label_value: node.structure_type,
        price_level: round(node.price),
        source: "Protected Structure V2",
        original_csv_row_index: node.original_csv_row_index ?? null
      });
    }
  }

  for (const event of structureSweeps) {
    entries.push({
      detected_id: event.detected_id,
      timestamp: event.timestamp,
      label_type: "Liquidity Grab",
      label_value: event.swept_node_type,
      price_level: round(event.swept_node_price),
      source: "Structure Sweep",
      original_csv_row_index: event.original_csv_row_index ?? null
    });
  }

  for (const event of liquidity) {
    entries.push({
      detected_id: event.detected_id,
      timestamp: event.timestamp,
      label_type: "Liquidity Grab",
      label_value: event.swept_level_type || event.source,
      price_level: round(event.price_level),
      source: "Liquidity Sweep",
      original_csv_row_index: event.original_csv_row_index ?? null
    });
  }

  for (const fvg of fvgs) {
    entries.push({
      detected_id: fvg.detected_id,
      timestamp: fvg.timestamp,
      label_type: "FVG",
      label_value: fvg.fvg_type,
      price_level: round(fvg.price_level),
      source: "FVG Detector",
      original_csv_row_index: fvg.original_csv_row_index ?? null
    });
  }

  return entries;
}

function metricForGroup(referenceLabels: TradingViewReferenceLabel[], matches: LabelComparison["matches"], group: string) {
  const total = referenceLabels.filter((label) => labelGroup(label.label_type) === group).length;
  if (!total) return 0;
  const matched = matches.filter((match) => labelGroup(match.label_type) === group).length;
  return round((matched / total) * 100, 1);
}

function compareReferenceLabels(
  referenceLabels: TradingViewReferenceLabel[],
  protectedStructure: MarketStructureNode[],
  structureSweeps: MarketStructureSweep[],
  liquidity: LiquidityEvent[],
  fvgs: FvgEvent[],
  timeframe: string | null
): LabelComparison {
  const detectionEntries = comparisonDetectionEntries(protectedStructure, structureSweeps, liquidity, fvgs);
  const timeframeMinutes = SUPPORTED_TIMEFRAMES[timeframe || "1m"] ?? 1;
  const timeToleranceSeconds = timeframeMinutes * 60 * REFERENCE_LABEL_TIME_TOLERANCE_MULTIPLIER;
  const matchedDetectionIds = new Set<string>();
  const matches: LabelComparison["matches"] = [];
  const missed: LabelComparison["missed_tradingview_labels"] = [];

  for (const label of [...referenceLabels].sort((a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp))) {
    const labelMs = timestampMs(label.timestamp);
    const candidates = detectionEntries
      .filter((detection) => detection.label_type === label.label_type && !matchedDetectionIds.has(detection.detected_id))
      .map((detection) => {
        const timeDiff = Math.abs(timestampMs(detection.timestamp) - labelMs) / 1000;
        const priceDiff = label.price_level !== null && label.price_level !== undefined && detection.price_level !== null ? Math.abs(detection.price_level - label.price_level) : null;
        return { detection, timeDiff, priceDiff };
      })
      .filter((item) => item.timeDiff <= timeToleranceSeconds)
      .filter((item) => item.priceDiff === null || item.priceDiff <= STRUCTURE_LEVEL_TOLERANCE)
      .sort((a, b) => a.timeDiff - b.timeDiff || (a.priceDiff ?? 0) - (b.priceDiff ?? 0));

    const best = candidates[0];
    if (!best) {
      missed.push({
        reference_label_id: label.detected_id,
        timestamp: label.timestamp,
        label_type: label.label_type,
        label_value: label.label_value,
        price_level: label.price_level ?? null,
        source_column: label.source_column,
        status: "missed_tradingview_label"
      });
      continue;
    }

    matchedDetectionIds.add(best.detection.detected_id);
    matches.push({
      reference_label_id: label.detected_id,
      market_detection_id: best.detection.detected_id,
      label_type: label.label_type,
      reference_timestamp: label.timestamp,
      market_timestamp: best.detection.timestamp,
      reference_value: label.label_value,
      market_value: best.detection.label_value,
      reference_price_level: label.price_level ?? null,
      market_price_level: best.detection.price_level,
      source_column: label.source_column,
      market_source: best.detection.source,
      timestamp_difference_seconds: round(best.timeDiff, 2),
      price_difference: best.priceDiff === null ? null : round(best.priceDiff),
      status: "matched"
    });
  }

  const extra = detectionEntries
    .filter((detection) => !matchedDetectionIds.has(detection.detected_id))
    .map((detection) => ({
      market_detection_id: detection.detected_id,
      timestamp: detection.timestamp,
      label_type: detection.label_type,
      label_value: detection.label_value,
      price_level: detection.price_level,
      market_source: detection.source,
      status: "extra_market_lab_detection"
    }));

  return {
    matches,
    missed_tradingview_labels: missed,
    extra_market_lab_detections: extra,
    metrics: {
      structure_match_rate: metricForGroup(referenceLabels, matches, "structure"),
      sweep_liquidity_grab_match_rate: metricForGroup(referenceLabels, matches, "sweep_liquidity"),
      bos_choch_match_rate: metricForGroup(referenceLabels, matches, "bos_choch")
    }
  };
}

type ComparisonDetectionEntry = ReturnType<typeof comparisonDetectionEntries>[number];

function secondsBetween(left: string, right: string) {
  return Math.abs(timestampMs(left) - timestampMs(right)) / 1000;
}

function priceDifference(left?: number | null, right?: number | null) {
  if (left === null || left === undefined || right === null || right === undefined) return null;
  return round(Math.abs(left - right));
}

function nearestReferenceLabel(detection: ComparisonDetectionEntry, referenceLabels: TradingViewReferenceLabel[], sameType = true) {
  const candidates = referenceLabels.filter((label) => (sameType ? label.label_type === detection.label_type : labelGroup(label.label_type) === labelGroup(detection.label_type)));
  return candidates.sort((a, b) => secondsBetween(a.timestamp, detection.timestamp) - secondsBetween(b.timestamp, detection.timestamp) || (priceDifference(a.price_level, detection.price_level) ?? 0) - (priceDifference(b.price_level, detection.price_level) ?? 0))[0] ?? null;
}

function nearestDetectionEntry(label: TradingViewReferenceLabel, detectionEntries: ComparisonDetectionEntry[], sameType = true) {
  const candidates = detectionEntries.filter((detection) => (sameType ? detection.label_type === label.label_type : labelGroup(detection.label_type) === labelGroup(label.label_type)));
  return candidates.sort((a, b) => secondsBetween(label.timestamp, a.timestamp) - secondsBetween(label.timestamp, b.timestamp) || (priceDifference(label.price_level, a.price_level) ?? 0) - (priceDifference(label.price_level, b.price_level) ?? 0))[0] ?? null;
}

function mismatchCauseForPair(timeDiff: number | null, priceDiff: number | null, timeToleranceSeconds: number, sameTypeFound: boolean, groupNeighborFound: boolean) {
  if (sameTypeFound && timeDiff !== null && priceDiff !== null && timeDiff > timeToleranceSeconds && priceDiff <= STRUCTURE_LEVEL_TOLERANCE) return "timezone_or_source_row_alignment";
  if (sameTypeFound && timeDiff !== null && priceDiff !== null && timeDiff <= timeToleranceSeconds && priceDiff > STRUCTURE_LEVEL_TOLERANCE) return "price_level_difference";
  if (sameTypeFound && timeDiff !== null && timeDiff > timeToleranceSeconds) return "timestamp_difference";
  if (groupNeighborFound) return "structure_sequencing";
  return "swing_filtering";
}

function causeLabel(cause: string) {
  return {
    timezone_or_source_row_alignment: "Possible timezone or source-row alignment issue",
    timestamp_difference: "Timestamp difference outside tolerance",
    price_level_difference: "Price level differs from TradingView label",
    structure_sequencing: "Structure sequencing differs from TradingView",
    swing_filtering: "Swing filtering likely removed or added the structure point",
    unrecognized_reference_column: "TradingView label column may be missing or unrecognized",
    matched_with_drift: "Matched, but timestamp or price has drift"
  }[cause] ?? cause.replace(/_/g, " ");
}

function recommendationForCause(cause: string) {
  return {
    timezone_or_source_row_alignment: "Add a timezone/source-row calibration check before changing swing thresholds.",
    timestamp_difference: "Compare confirmation candle time vs source swing candle time; consider exposing both in matcher settings.",
    price_level_difference: "Check whether TradingView labels use wick, close, midpoint, or confirmation candle level.",
    structure_sequencing: "Review HH/HL/LH/LL sequencing rules and protected-level state transitions against the indicator.",
    swing_filtering: "Calibrate Swing V2 left/right candles, minimum distance, and displacement threshold using labeled samples.",
    unrecognized_reference_column: "Confirm the TradingView export includes the expected indicator label columns and non-empty values.",
    matched_with_drift: "Keep current rule for now; inspect recurring drift before changing tolerance."
  }[cause] ?? "Collect more labeled examples before changing detector rules.";
}

function mismatchExample(params: {
  status: string;
  labelType: string;
  cause: string;
  referenceTimestamp?: string | null;
  marketTimestamp?: string | null;
  referencePriceLevel?: number | null;
  marketPriceLevel?: number | null;
  sourceColumn?: string | null;
  marketSource?: string | null;
  referenceRow?: number | null;
  marketRow?: number | null;
  referenceValue?: string | null;
  marketValue?: string | null;
}): MismatchAnalysis["top_examples"][number] {
  const timeDiff = params.referenceTimestamp && params.marketTimestamp ? secondsBetween(params.referenceTimestamp, params.marketTimestamp) : null;
  const priceDiff = priceDifference(params.referencePriceLevel, params.marketPriceLevel);
  const evidenceParts = [
    causeLabel(params.cause),
    params.referenceValue ? `TV ${params.referenceValue}` : "",
    params.marketValue ? `Market ${params.marketValue}` : "",
    timeDiff !== null ? `time diff ${round(timeDiff, 2)}s` : "",
    priceDiff !== null ? `price diff ${priceDiff}` : "",
    params.referenceRow !== null && params.referenceRow !== undefined ? `TV row ${params.referenceRow}` : "",
    params.marketRow !== null && params.marketRow !== undefined ? `Market row ${params.marketRow}` : ""
  ].filter(Boolean);
  let severity = 50;
  if (params.status === "missed_tradingview_label") severity += 35;
  else if (params.status === "extra_market_lab_detection") severity += 25;
  if (["HH", "HL", "LH", "LL", "BOS", "CHOCH"].includes(params.labelType)) severity += 15;
  if (timeDiff !== null) severity += Math.min(Math.floor(timeDiff / 60), 20);
  if (priceDiff !== null) severity += Math.min(Math.floor(priceDiff), 20);

  return {
    status: params.status,
    label_type: params.labelType,
    reference_timestamp: params.referenceTimestamp ?? null,
    market_timestamp: params.marketTimestamp ?? null,
    reference_price_level: params.referencePriceLevel ?? null,
    market_price_level: params.marketPriceLevel ?? null,
    timestamp_difference_seconds: timeDiff === null ? null : round(timeDiff, 2),
    price_difference: priceDiff,
    source_column: params.sourceColumn ?? null,
    market_source: params.marketSource ?? null,
    reference_row: params.referenceRow ?? null,
    market_row: params.marketRow ?? null,
    likely_cause: params.cause,
    evidence: evidenceParts.join("; "),
    recommended_change: recommendationForCause(params.cause),
    severity_score: Math.min(severity, 100)
  };
}

function analyzeReferenceLabelMismatches(
  referenceLabels: TradingViewReferenceLabel[],
  protectedStructure: MarketStructureNode[],
  structureSweeps: MarketStructureSweep[],
  liquidity: LiquidityEvent[],
  fvgs: FvgEvent[],
  labelComparison: LabelComparison,
  timeframe: string | null
): MismatchAnalysis {
  const detectionEntries = comparisonDetectionEntries(protectedStructure, structureSweeps, liquidity, fvgs);
  const detectionById = new Map(detectionEntries.map((entry) => [entry.detected_id, entry]));
  const referenceById = new Map(referenceLabels.map((label) => [label.detected_id, label]));
  const timeframeMinutes = SUPPORTED_TIMEFRAMES[timeframe || "1m"] ?? 1;
  const timeToleranceSeconds = timeframeMinutes * 60 * REFERENCE_LABEL_TIME_TOLERANCE_MULTIPLIER;
  const examples: MismatchAnalysis["top_examples"] = [];

  for (const missed of labelComparison.missed_tradingview_labels) {
    if (!["HH", "HL", "LH", "LL", "BOS", "CHOCH", "Liquidity Grab"].includes(missed.label_type)) continue;
    const label = referenceById.get(missed.reference_label_id) ?? {
      detected_id: missed.reference_label_id,
      timestamp: missed.timestamp,
      symbol: "",
      timeframe: timeframe || "1m",
      label_type: missed.label_type,
      label_value: missed.label_value,
      price_level: missed.price_level,
      source_column: missed.source_column,
      raw_value: missed.label_value
    };
    const nearestSameType = nearestDetectionEntry(label, detectionEntries, true);
    const nearestSameGroup = nearestDetectionEntry(label, detectionEntries, false);
    const nearest = nearestSameType ?? nearestSameGroup;
    const timeDiff = nearest ? secondsBetween(label.timestamp, nearest.timestamp) : null;
    const priceDiff = nearest ? priceDifference(label.price_level, nearest.price_level) : null;
    const cause = mismatchCauseForPair(timeDiff, priceDiff, timeToleranceSeconds, Boolean(nearestSameType), Boolean(nearestSameGroup));
    examples.push(mismatchExample({
      status: "missed_tradingview_label",
      labelType: label.label_type,
      cause,
      referenceTimestamp: label.timestamp,
      marketTimestamp: nearest?.timestamp ?? null,
      referencePriceLevel: label.price_level ?? null,
      marketPriceLevel: nearest?.price_level ?? null,
      sourceColumn: label.source_column,
      marketSource: nearest?.source ?? null,
      referenceRow: label.original_csv_row_index ?? null,
      marketRow: nearest?.original_csv_row_index ?? null,
      referenceValue: label.label_value,
      marketValue: nearest?.label_value ?? null
    }));
  }

  for (const extra of labelComparison.extra_market_lab_detections) {
    if (!["HH", "HL", "LH", "LL", "BOS", "CHOCH", "Liquidity Grab"].includes(extra.label_type)) continue;
    const detection = detectionById.get(extra.market_detection_id) ?? {
      detected_id: extra.market_detection_id,
      timestamp: extra.timestamp,
      label_type: extra.label_type,
      label_value: extra.label_value,
      price_level: extra.price_level ?? null,
      source: extra.market_source
    };
    const nearestSameType = nearestReferenceLabel(detection, referenceLabels, true);
    const nearestSameGroup = nearestReferenceLabel(detection, referenceLabels, false);
    const nearest = nearestSameType ?? nearestSameGroup;
    const timeDiff = nearest ? secondsBetween(nearest.timestamp, detection.timestamp) : null;
    const priceDiff = nearest ? priceDifference(nearest.price_level, detection.price_level) : null;
    const cause = nearest ? mismatchCauseForPair(timeDiff, priceDiff, timeToleranceSeconds, Boolean(nearestSameType), Boolean(nearestSameGroup)) : "unrecognized_reference_column";
    examples.push(mismatchExample({
      status: "extra_market_lab_detection",
      labelType: detection.label_type,
      cause,
      referenceTimestamp: nearest?.timestamp ?? null,
      marketTimestamp: detection.timestamp,
      referencePriceLevel: nearest?.price_level ?? null,
      marketPriceLevel: detection.price_level,
      sourceColumn: nearest?.source_column ?? null,
      marketSource: detection.source,
      referenceRow: nearest?.original_csv_row_index ?? null,
      marketRow: detection.original_csv_row_index ?? null,
      referenceValue: nearest?.label_value ?? null,
      marketValue: detection.label_value
    }));
  }

  for (const match of labelComparison.matches) {
    if (!["HH", "HL", "LH", "LL", "BOS", "CHOCH", "Liquidity Grab"].includes(match.label_type)) continue;
    if (!match.timestamp_difference_seconds && !match.price_difference) continue;
    const label = referenceById.get(match.reference_label_id);
    const detection = detectionById.get(match.market_detection_id);
    examples.push(mismatchExample({
      status: "matched_with_difference",
      labelType: match.label_type,
      cause: "matched_with_drift",
      referenceTimestamp: match.reference_timestamp,
      marketTimestamp: match.market_timestamp,
      referencePriceLevel: match.reference_price_level,
      marketPriceLevel: match.market_price_level,
      sourceColumn: match.source_column,
      marketSource: match.market_source,
      referenceRow: label?.original_csv_row_index ?? null,
      marketRow: detection?.original_csv_row_index ?? null,
      referenceValue: match.reference_value,
      marketValue: match.market_value
    }));
  }

  const topExamples = examples.sort((a, b) => b.severity_score - a.severity_score).slice(0, 10);
  const causeCounts = examples.reduce<Record<string, number>>((current, example) => {
    current[example.likely_cause] = (current[example.likely_cause] ?? 0) + 1;
    return current;
  }, {});
  const likelyCauses = Object.entries(causeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([cause, count]) => ({ cause, count, evidence: causeLabel(cause) }));
  const recommended = Array.from(new Set(likelyCauses.map((item) => recommendationForCause(item.cause))));
  return { top_examples: topExamples, likely_causes: likelyCauses, recommended_detector_changes: recommended };
}

export function analyzeMarketCandles(
  candles: MarketCandle[],
  duplicateRows = 0,
  importSummary: MarketImportSummary | null = null,
  swingConfigInput?: Partial<MarketSwingConfig>,
  structureSweepConfigInput?: StructureSweepConfigInput
): MarketLabSummary {
  const rows = [...candles].sort((a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp));
  const swingConfig = normalizeMarketSwingConfig(swingConfigInput);
  const structureSweepConfig = {
    min_node_importance: Math.round(clamp(structureSweepConfigInput?.min_node_importance ?? 50, 0, 100)),
    max_age_minutes: structureSweepConfigInput?.max_age_minutes ?? null,
    min_pierce_size: Math.max(structureSweepConfigInput?.min_pierce_size ?? 0, 0)
  };
  const missing = detectMarketMissingRows(rows);
  const swings = detectMarketStructure(rows);
  const swingsV2 = detectMarketStructureV2(rows, swingConfig);
  const rawLiquidity = detectMarketLiquidity(rows);
  const rawStructureSequence = buildMarketStructureSequence(swingsV2, rows, rawLiquidity);
  let protectedStructure = buildProtectedMarketStructureV2(swingsV2, rows, rawLiquidity);
  const structureSweeps = detectMarketStructureSweeps(rows, protectedStructure, structureSweepConfig);
  protectedStructure = markStructureNodesSweptByStructureSweeps(protectedStructure, structureSweeps);
  const liquidity = enrichMarketSweepsWithStructure(rawLiquidity, protectedStructure);
  const fvgs = detectMarketFvgs(rows);
  const setupCandidates = generateMarketCandidates(rows, liquidity, fvgs, swings);
  const referenceLabels = importSummary?.reference_labels ?? [];
  const labelComparison = compareReferenceLabels(referenceLabels, protectedStructure, structureSweeps, liquidity, fvgs, rows[0]?.timeframe ?? null);
  const mismatchAnalysis = analyzeReferenceLabelMismatches(referenceLabels, protectedStructure, structureSweeps, liquidity, fvgs, labelComparison, rows[0]?.timeframe ?? null);
  const sessionCounts: Record<string, number> = {};

  for (const candle of rows) {
    const session = sessionForTimestamp(candle.timestamp);
    sessionCounts[session] = (sessionCounts[session] ?? 0) + 1;
  }

  return {
    candle_count: rows.length,
    duplicate_rows: duplicateRows,
    missing_rows: missing.length,
    missing_timestamps: missing.slice(0, 50),
    ...sampleMetadata(rows, missing),
    session_counts: sessionCounts,
    swings: swings.slice(-100),
    swings_v2: swingsV2.slice(-100),
    swings_v1_count: swings.length,
    swings_v2_count: swingsV2.length,
    structure_sequence: rawStructureSequence.slice(-100),
    protected_structure: protectedStructure.slice(-100),
    protected_structure_count: protectedStructure.length,
    structure_sweeps: structureSweeps.slice(-100),
    reference_labels: referenceLabels.slice(-500),
    label_comparison: {
      matches: labelComparison.matches.slice(0, 200),
      missed_tradingview_labels: labelComparison.missed_tradingview_labels.slice(0, 200),
      extra_market_lab_detections: labelComparison.extra_market_lab_detections.slice(0, 200),
      metrics: labelComparison.metrics
    },
    mismatch_analysis: mismatchAnalysis,
    structure_sweep_config: structureSweepConfig,
    swing_config: swingConfig,
    liquidity_events: liquidity.slice(-100),
    fvgs: fvgs.slice(-100),
    setup_candidates: setupCandidates.slice(0, 100).map((candidate) => ({ ...candidate, reasons: candidateReasons(candidate.reasons) })),
    import_summary: importSummary,
    free_data: null
  };
}
