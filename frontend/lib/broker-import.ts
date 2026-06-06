import type { Trade, TradePayload } from "@/lib/types";

export type BrokerImportSource = "Tradovate" | "NinjaTrader" | "Generic Broker CSV";

export type BrokerTargetField =
  | "account"
  | "symbol"
  | "direction"
  | "quantity"
  | "entry_time"
  | "exit_time"
  | "entry_price"
  | "exit_price"
  | "gross_pnl"
  | "commission"
  | "net_pnl"
  | "trade_id"
  | "stop_loss";

export type BrokerColumnMapping = {
  source: string;
  target: BrokerTargetField;
};

export type BrokerImportCandidate = {
  rowNumber: number;
  payload: TradePayload;
  raw: Record<string, string>;
  fingerprint: string;
  duplicate: boolean;
  duplicateReason: string | null;
  missingFields: string[];
  errors: string[];
};

export type BrokerImportPreview = {
  source: BrokerImportSource;
  columnMapping: BrokerColumnMapping[];
  missingColumns: BrokerTargetField[];
  candidates: BrokerImportCandidate[];
  summary: {
    totalRows: number;
    importableRows: number;
    duplicateRows: number;
    errorRows: number;
    missingFieldCounts: Array<{ field: string; count: number }>;
  };
};

const REQUIRED_COLUMNS: BrokerTargetField[] = ["symbol", "direction", "entry_time", "exit_time", "entry_price", "exit_price"];

const FIELD_ALIASES: Record<BrokerTargetField, string[]> = {
  account: ["account", "acct", "accountname", "accountnumber"],
  symbol: ["symbol", "instrument", "contract", "product", "market"],
  direction: ["direction", "side", "buysell", "buy/sell", "b/s", "action", "marketposition", "position"],
  quantity: ["quantity", "qty", "contracts", "size", "shares"],
  entry_time: ["entrytime", "entrydatetime", "entrydate", "opentime", "opendatetime", "opened", "filltime"],
  exit_time: ["exittime", "exitdatetime", "exitdate", "closetime", "closedatetime", "closed", "flatdate"],
  entry_price: ["entryprice", "entry", "avgentryprice", "averageentryprice", "entryavgprice", "entryfillprice"],
  exit_price: ["exitprice", "exit", "avgexitprice", "averageexitprice", "exitavgprice", "exitfillprice"],
  gross_pnl: ["grosspnl", "grossp/l", "grossprofit", "pnl", "p/l", "profit"],
  commission: ["commission", "commissions", "fees", "fee"],
  net_pnl: ["netpnl", "netp/l", "netprofit", "realizedpnl", "realizedp/l", "realizedprofit"],
  trade_id: ["tradeid", "trade#", "orderid", "executionid", "execid", "id"],
  stop_loss: ["stop", "stoploss", "stopprice", "sl"]
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === "\"" && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((item) => item.some((value) => value.trim()));
}

function detectTarget(header: string): BrokerTargetField | null {
  const normalized = normalizeHeader(header);
  for (const [target, aliases] of Object.entries(FIELD_ALIASES) as Array<[BrokerTargetField, string[]]>) {
    if (aliases.map(normalizeHeader).includes(normalized)) return target;
  }
  if (normalized.includes("entry") && normalized.includes("time")) return "entry_time";
  if (normalized.includes("exit") && normalized.includes("time")) return "exit_time";
  if (normalized.includes("entry") && normalized.includes("price")) return "entry_price";
  if (normalized.includes("exit") && normalized.includes("price")) return "exit_price";
  if (normalized.includes("net") && (normalized.includes("pnl") || normalized.includes("profit"))) return "net_pnl";
  if (normalized.includes("gross") && (normalized.includes("pnl") || normalized.includes("profit"))) return "gross_pnl";
  if (normalized.includes("trade") && normalized.includes("id")) return "trade_id";
  return null;
}

function detectSource(headers: string[], filename?: string): BrokerImportSource {
  const text = `${filename ?? ""} ${headers.join(" ")}`.toLowerCase();
  if (text.includes("tradovate") || text.includes("acct") || text.includes("b/s")) return "Tradovate";
  if (text.includes("ninjatrader") || text.includes("market position") || text.includes("instrument")) return "NinjaTrader";
  return "Generic Broker CSV";
}

function buildColumnMapping(headers: string[]) {
  const seen = new Set<BrokerTargetField>();
  const mapping: BrokerColumnMapping[] = [];
  for (const header of headers) {
    const target = detectTarget(header);
    if (target && !seen.has(target)) {
      mapping.push({ source: header, target });
      seen.add(target);
    }
  }
  return mapping;
}

function cell(row: Record<string, string>, mapping: BrokerColumnMapping[], target: BrokerTargetField) {
  const source = mapping.find((item) => item.target === target)?.source;
  return source ? row[source]?.trim() ?? "" : "";
}

function parseNumber(value: string) {
  if (!value.trim()) return null;
  const negative = /^\(.*\)$/.test(value.trim());
  const cleaned = value.replace(/[,$%()]/g, "").trim();
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -Math.abs(parsed) : parsed;
}

function parseTime(value: string) {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeDirection(value: string, quantity: number | null): "Long" | "Short" | null {
  const text = value.toLowerCase();
  if (text.includes("short") || text.includes("sell") || text.includes("sold")) return "Short";
  if (text.includes("long") || text.includes("buy") || text.includes("bought")) return "Long";
  if (quantity !== null && quantity < 0) return "Short";
  if (quantity !== null && quantity > 0) return "Long";
  return null;
}

function normalizeInstrument(symbol: string) {
  const upper = symbol.toUpperCase();
  if (upper.includes("MNQ")) return "MNQ";
  if (upper.includes("MES")) return "MES";
  if (upper.includes("NQ")) return "NQ";
  if (upper.includes("ES")) return "ES";
  if (upper.includes("GC")) return "GC";
  return null;
}

function sessionFromTime(time: Date | null) {
  if (!time) return "NY_AM";
  const hour = time.getHours();
  const minute = time.getMinutes();
  const minutes = hour * 60 + minute;
  if (minutes >= 9 * 60 + 30 && minutes < 13 * 60) return "NY_AM";
  if (minutes >= 13 * 60 && minutes < 16 * 60) return "NY_PM";
  if (minutes >= 2 * 60 && minutes < 9 * 60 + 30) return "London";
  return "Asian";
}

function resultFromPnl(netPnl: number | null, direction: "Long" | "Short" | null, entry: number | null, exit: number | null) {
  const pnl = netPnl ?? (direction && entry !== null && exit !== null ? (direction === "Long" ? exit - entry : entry - exit) : null);
  if (pnl === null) return "Unknown";
  if (pnl > 0) return "TP1";
  if (pnl < 0) return "SL";
  return "BE";
}

function resultRFromPrices(direction: "Long" | "Short" | null, entry: number | null, exit: number | null, stop: number | null) {
  if (!direction || entry === null || exit === null || stop === null) return 0;
  const risk = Math.abs(entry - stop);
  if (!risk) return 0;
  const reward = direction === "Long" ? exit - entry : entry - exit;
  return Number((reward / risk).toFixed(2));
}

function holdingMinutes(entry: Date | null, exit: Date | null) {
  if (!entry || !exit) return null;
  const minutes = (exit.getTime() - entry.getTime()) / 60000;
  return Number.isFinite(minutes) && minutes >= 0 ? Number(minutes.toFixed(2)) : null;
}

function baseImportedPayload(): TradePayload {
  return {
    user_id: null,
    workspace_id: null,
    date: today(),
    instrument: "NQ",
    data_type: "Live",
    session: "NY_AM",
    direction: "Long",
    bias_15m: "Neutral",
    market_state: "Balanced",
    regime_label: null,
    location: "Other",
    liquidity_sweep: "None",
    choch: "None",
    lh_hl: "None",
    fvg_reaction: "None",
    volume_state: "Normal",
    strategy_version: "Fabio_V1",
    setup_type: null,
    setup_score: null,
    manual_quality: null,
    trade_decision: "Taken",
    skip_reason: null,
    entry_price: null,
    stop_loss: null,
    tp1_price: null,
    tp2_price: null,
    risk_amount: null,
    result: "Unknown",
    result_r: 0,
    mfe: 0,
    mae: 0,
    distance_to_poc: null,
    distance_to_vah: null,
    distance_to_val: null,
    poc_risk_level: "Unknown",
    similarity_group_id: null,
    management_rule_notes: null,
    screenshot_tags: "",
    screenshot_favorite: false,
    screenshot_bookmarked: false,
    screenshot_notes: "",
    lessons_learned: "",
    followed_plan: "Yes",
    mistake_type: "None",
    discipline_score: null,
    execution_score: null,
    emotion_score: null,
    review_notes: "",
    daily_bias: "Neutral",
    weekly_bias: "Neutral",
    monthly_bias: "Neutral",
    high_impact_news: "No",
    news_type: null,
    news_timing: "No News",
    notes: "",
    screenshot_path: null,
    data_quality: "incomplete",
    account: null,
    broker_symbol: null,
    quantity: null,
    entry_time: null,
    exit_time: null,
    exit_price: null,
    gross_pnl: null,
    commission: null,
    net_pnl: null,
    broker_trade_id: null,
    import_source: null,
    holding_time_minutes: null,
    imported: true,
    review_status: "unreviewed"
  };
}

function fingerprintFromPayload(payload: TradePayload) {
  return [
    payload.account ?? "",
    payload.broker_symbol ?? payload.instrument,
    payload.entry_time ?? "",
    payload.exit_time ?? "",
    payload.entry_price ?? "",
    payload.exit_price ?? "",
    payload.quantity ?? "",
    payload.net_pnl ?? ""
  ].join("|");
}

function duplicateSets(existingTrades: Trade[]) {
  const tradeIds = new Set(existingTrades.map((trade) => trade.broker_trade_id).filter(Boolean));
  const fingerprints = new Set(existingTrades.filter((trade) => trade.imported).map((trade) => fingerprintFromPayload(trade)));
  return { tradeIds, fingerprints };
}

export function parseBrokerCsv(text: string, existingTrades: Trade[], filename?: string): BrokerImportPreview {
  const rows = parseCsv(text);
  const [headers = [], ...body] = rows;
  const columnMapping = buildColumnMapping(headers.map((header) => header.trim()));
  const mappedTargets = new Set(columnMapping.map((item) => item.target));
  const missingColumns = REQUIRED_COLUMNS.filter((field) => !mappedTargets.has(field));
  const source = detectSource(headers, filename);
  const existing = duplicateSets(existingTrades);
  const seenFingerprints = new Set<string>();
  const seenTradeIds = new Set<string>();

  const candidates = body.map((cells, index): BrokerImportCandidate => {
    const raw = Object.fromEntries(headers.map((header, cellIndex) => [header.trim(), cells[cellIndex]?.trim() ?? ""]));
    const account = cell(raw, columnMapping, "account") || null;
    const rawSymbol = cell(raw, columnMapping, "symbol");
    const quantity = parseNumber(cell(raw, columnMapping, "quantity"));
    const direction = normalizeDirection(cell(raw, columnMapping, "direction"), quantity);
    const entryTime = parseTime(cell(raw, columnMapping, "entry_time"));
    const exitTime = parseTime(cell(raw, columnMapping, "exit_time"));
    const entryPrice = parseNumber(cell(raw, columnMapping, "entry_price"));
    const exitPrice = parseNumber(cell(raw, columnMapping, "exit_price"));
    const stopLoss = parseNumber(cell(raw, columnMapping, "stop_loss"));
    const grossPnl = parseNumber(cell(raw, columnMapping, "gross_pnl"));
    const commission = parseNumber(cell(raw, columnMapping, "commission"));
    const netPnl = parseNumber(cell(raw, columnMapping, "net_pnl")) ?? (grossPnl !== null || commission !== null ? (grossPnl ?? 0) - Math.abs(commission ?? 0) : null);
    const brokerTradeId = cell(raw, columnMapping, "trade_id") || null;
    const instrument = normalizeInstrument(rawSymbol);
    const result = resultFromPnl(netPnl, direction, entryPrice, exitPrice);
    const payload: TradePayload = {
      ...baseImportedPayload(),
      date: entryTime ? entryTime.toISOString().slice(0, 10) : today(),
      instrument: instrument ?? "NQ",
      session: sessionFromTime(entryTime),
      direction: direction ?? "Long",
      entry_price: entryPrice,
      stop_loss: stopLoss,
      exit_price: exitPrice,
      result,
      result_r: resultRFromPrices(direction, entryPrice, exitPrice, stopLoss),
      account,
      broker_symbol: rawSymbol || null,
      quantity: quantity === null ? null : Math.abs(quantity),
      entry_time: entryTime?.toISOString() ?? null,
      exit_time: exitTime?.toISOString() ?? null,
      gross_pnl: grossPnl,
      commission,
      net_pnl: netPnl,
      broker_trade_id: brokerTradeId,
      import_source: source,
      holding_time_minutes: holdingMinutes(entryTime, exitTime),
      notes: "Imported from broker CSV. Review setup labels before using for research."
    };
    const missingFields = [
      ["account", account],
      ["symbol", rawSymbol],
      ["direction", direction],
      ["quantity", quantity],
      ["entry_time", entryTime],
      ["exit_time", exitTime],
      ["entry_price", entryPrice],
      ["exit_price", exitPrice],
      ["net_pnl", netPnl]
    ]
      .filter(([, value]) => value === null || value === "")
      .map(([field]) => String(field));
    const errors = [
      !instrument ? "unsupported or missing symbol" : "",
      !direction ? "missing direction" : "",
      !entryTime ? "invalid entry_time" : "",
      !exitTime ? "invalid exit_time" : "",
      entryPrice === null ? "missing entry_price" : "",
      exitPrice === null ? "missing exit_price" : ""
    ].filter(Boolean);
    const fingerprint = fingerprintFromPayload(payload);
    const tradeIdDuplicate = brokerTradeId ? existing.tradeIds.has(brokerTradeId) || seenTradeIds.has(brokerTradeId) : false;
    const fingerprintDuplicate = existing.fingerprints.has(fingerprint) || seenFingerprints.has(fingerprint);
    if (brokerTradeId) seenTradeIds.add(brokerTradeId);
    seenFingerprints.add(fingerprint);

    return {
      rowNumber: index + 2,
      payload,
      raw,
      fingerprint,
      duplicate: tradeIdDuplicate || fingerprintDuplicate,
      duplicateReason: tradeIdDuplicate ? "trade_id already imported" : fingerprintDuplicate ? "matching broker trade already imported" : null,
      missingFields,
      errors
    };
  });

  const missingFieldMap = new Map<string, number>();
  for (const candidate of candidates) {
    for (const field of candidate.missingFields) {
      missingFieldMap.set(field, (missingFieldMap.get(field) ?? 0) + 1);
    }
  }

  return {
    source,
    columnMapping,
    missingColumns,
    candidates,
    summary: {
      totalRows: candidates.length,
      importableRows: candidates.filter((candidate) => !candidate.duplicate && candidate.errors.length === 0).length,
      duplicateRows: candidates.filter((candidate) => candidate.duplicate).length,
      errorRows: candidates.filter((candidate) => candidate.errors.length > 0).length,
      missingFieldCounts: [...missingFieldMap.entries()].map(([field, count]) => ({ field, count })).sort((a, b) => b.count - a.count)
    }
  };
}
