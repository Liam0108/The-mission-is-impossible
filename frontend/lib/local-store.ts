import { emptyDashboard } from "@/lib/demo-data";
import type {
  AnalyzerRequest,
  AnalyzerResponse,
  Dashboard,
  DataQualityDashboard,
  EdgeCondition,
  EdgeDiscoveryResponse,
  ManagementResponse,
  MarketCandle,
  MarketLabSummary,
  MarketSwingConfig,
  MonteCarloResponse,
  MlStatus,
  PerformanceGroup,
  ResearchSummary,
  ScreenshotItem,
  Trade,
  TradePayload
} from "@/lib/types";
import { analyzeMarketCandles, parseMarketCsv } from "@/lib/market-engine";

const TRADES_KEY = "fabio-local-trades-v1";
const MARKET_CANDLES_KEY = "fabio-market-candles-v1";
const POC_HIGH_DISTANCE = 5;
const POC_MEDIUM_DISTANCE = 12;

type MarketSwingParams = {
  symbol: string;
  timeframe: string;
  swing_mode?: MarketSwingConfig["mode"];
  swing_left_candles?: number;
  swing_right_candles?: number;
  min_swing_distance?: number;
  min_structure_node_importance?: number;
  max_structure_sweep_age_minutes?: number | null;
  min_structure_pierce_size?: number;
};

function swingConfigFromParams(params: MarketSwingParams): Partial<MarketSwingConfig> {
  return {
    mode: params.swing_mode,
    left_candles: params.swing_left_candles,
    right_candles: params.swing_right_candles,
    min_swing_distance: params.min_swing_distance
  };
}

function structureSweepConfigFromParams(params: MarketSwingParams) {
  return {
    min_node_importance: params.min_structure_node_importance,
    max_age_minutes: params.max_structure_sweep_age_minutes ?? null,
    min_pierce_size: params.min_structure_pierce_size
  };
}

const SIMILARITY_WEIGHTS: Record<keyof Pick<
  Trade,
  | "session"
  | "direction"
  | "bias_15m"
  | "market_state"
  | "regime_label"
  | "location"
  | "liquidity_sweep"
  | "choch"
  | "lh_hl"
  | "fvg_reaction"
  | "volume_state"
  | "trade_decision"
>, number> = {
  session: 15,
  direction: 10,
  bias_15m: 15,
  market_state: 10,
  regime_label: 10,
  location: 20,
  liquidity_sweep: 15,
  choch: 15,
  lh_hl: 10,
  fvg_reaction: 15,
  volume_state: 5,
  trade_decision: 5
};

const TRADE_FIELDS: Array<keyof Trade> = [
  "id",
  "user_id",
  "workspace_id",
  "date",
  "instrument",
  "data_type",
  "session",
  "direction",
  "bias_15m",
  "market_state",
  "regime_label",
  "location",
  "liquidity_sweep",
  "choch",
  "lh_hl",
  "fvg_reaction",
  "volume_state",
  "strategy_version",
  "setup_type",
  "setup_score",
  "manual_quality",
  "trade_decision",
  "skip_reason",
  "entry_price",
  "stop_loss",
  "tp1_price",
  "tp2_price",
  "risk_amount",
  "result",
  "result_r",
  "mfe",
  "mae",
  "distance_to_poc",
  "distance_to_vah",
  "distance_to_val",
  "poc_risk_level",
  "similarity_group_id",
  "management_rule_notes",
  "screenshot_tags",
  "screenshot_favorite",
  "screenshot_bookmarked",
  "screenshot_notes",
  "lessons_learned",
  "followed_plan",
  "mistake_type",
  "discipline_score",
  "execution_score",
  "emotion_score",
  "review_notes",
  "daily_bias",
  "weekly_bias",
  "monthly_bias",
  "high_impact_news",
  "news_type",
  "news_timing",
  "notes",
  "screenshot_path",
  "data_quality",
  "account",
  "broker_symbol",
  "buy_price",
  "sell_price",
  "bought_time",
  "sold_time",
  "quantity",
  "entry_time",
  "exit_time",
  "exit_price",
  "gross_pnl",
  "commission",
  "net_pnl",
  "broker_trade_id",
  "import_source",
  "holding_time_minutes",
  "holding_time_text",
  "imported",
  "review_status",
  "created_at",
  "updated_at"
];

const NUMBER_FIELDS = new Set<keyof Trade>([
  "setup_score",
  "entry_price",
  "stop_loss",
  "tp1_price",
  "tp2_price",
  "risk_amount",
  "result_r",
  "mfe",
  "mae",
  "distance_to_poc",
  "distance_to_vah",
  "distance_to_val",
  "discipline_score",
  "execution_score",
  "emotion_score",
  "buy_price",
  "sell_price",
  "quantity",
  "exit_price",
  "gross_pnl",
  "commission",
  "net_pnl",
  "holding_time_minutes"
]);

const BOOLEAN_FIELDS = new Set<keyof Trade>(["screenshot_favorite", "screenshot_bookmarked", "imported"]);

function hasStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function asNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function pct(count: number, total: number) {
  return total ? Number(((count / total) * 100).toFixed(1)) : 0;
}

function avg(values: number[], digits = 2) {
  return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(digits)) : 0;
}

function profitFactor(results: number[]) {
  const grossProfit = results.reduce((sum, value) => sum + Math.max(value, 0), 0);
  const grossLoss = Math.abs(results.reduce((sum, value) => sum + Math.min(value, 0), 0));
  if (!grossLoss) return Number(grossProfit.toFixed(2));
  return Number((grossProfit / grossLoss).toFixed(2));
}

function maxStreak(results: number[], winning: boolean) {
  let streak = 0;
  let best = 0;
  for (const result of results) {
    const qualifies = winning ? result > 0 : result < 0;
    if (qualifies) {
      streak += 1;
      best = Math.max(best, streak);
    } else {
      streak = 0;
    }
  }
  return best;
}

function maxDrawdown(results: number[]) {
  let equity = 0;
  let peak = 0;
  let drawdown = 0;
  for (const result of results) {
    equity += result;
    peak = Math.max(peak, equity);
    drawdown = Math.min(drawdown, equity - peak);
  }
  return Number(drawdown.toFixed(2));
}

function id() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultPayload(): TradePayload {
  return {
    user_id: null,
    workspace_id: null,
    date: today(),
    instrument: "NQ",
    data_type: "Backtest",
    session: "NY_AM",
    direction: "Long",
    bias_15m: "Long",
    market_state: "Imbalanced",
    regime_label: null,
    location: "VAH",
    liquidity_sweep: "None",
    choch: "None",
    lh_hl: "None",
    fvg_reaction: "Strong",
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
    result: "NoTrade",
    result_r: 0,
    mfe: 0,
    mae: 0,
    distance_to_poc: null,
    distance_to_vah: null,
    distance_to_val: null,
    poc_risk_level: "Medium",
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
    buy_price: null,
    sell_price: null,
    bought_time: null,
    sold_time: null,
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
    holding_time_text: null,
    imported: false,
    review_status: "reviewed"
  };
}

function readTrades(): Trade[] {
  if (!hasStorage()) return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(TRADES_KEY) ?? "[]") as Trade[];
    return Array.isArray(rows)
      ? rows.map((trade) => ({
        ...trade,
        regime_label: trade.regime_label ?? null,
        setup_type: trade.setup_type ?? null,
        manual_quality: trade.manual_quality ?? null,
        data_quality: trade.data_quality ?? classifyDataQuality(trade),
        account: trade.account ?? null,
        broker_symbol: trade.broker_symbol ?? null,
        buy_price: trade.buy_price ?? null,
        sell_price: trade.sell_price ?? null,
        bought_time: trade.bought_time ?? null,
        sold_time: trade.sold_time ?? null,
        quantity: trade.quantity ?? null,
        entry_time: trade.entry_time ?? null,
        exit_time: trade.exit_time ?? null,
        exit_price: trade.exit_price ?? null,
        gross_pnl: trade.gross_pnl ?? null,
        commission: trade.commission ?? null,
        net_pnl: trade.net_pnl ?? null,
        broker_trade_id: trade.broker_trade_id ?? null,
        import_source: trade.import_source ?? null,
        holding_time_minutes: trade.holding_time_minutes ?? null,
        holding_time_text: trade.holding_time_text ?? null,
        imported: trade.imported ?? false,
        review_status: trade.review_status ?? "reviewed"
      }))
      : [];
  } catch {
    return [];
  }
}

function writeTrades(trades: Trade[]) {
  if (!hasStorage()) return;
  window.localStorage.setItem(TRADES_KEY, JSON.stringify(trades));
}

function readMarketCandles(): MarketCandle[] {
  if (!hasStorage()) return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(MARKET_CANDLES_KEY) ?? "[]") as MarketCandle[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function writeMarketCandles(candles: MarketCandle[]) {
  if (!hasStorage()) return;
  window.localStorage.setItem(MARKET_CANDLES_KEY, JSON.stringify(candles));
}

function filterByRegime(trades: Trade[], params?: { regime_label?: string | null }) {
  return params?.regime_label ? trades.filter((trade) => trade.regime_label === params.regime_label) : trades;
}

function normalizePayload(payload: Partial<TradePayload>): TradePayload {
  const merged = { ...defaultPayload(), ...payload };
  const risk = calculatePocRisk(merged);
  if (!merged.poc_risk_level || merged.poc_risk_level === "Unknown") {
    merged.poc_risk_level = risk.poc_risk_level;
  }
  return {
    ...merged,
    result_r: merged.result_r === null || merged.result_r === undefined
      ? null
      : asNumber(merged.result_r),
    mfe: asNumber(merged.mfe),
    mae: asNumber(merged.mae),
    imported: Boolean(merged.imported),
    review_status: merged.review_status ?? "reviewed",
    data_quality: classifyDataQuality(merged),
    setup_score: calculateSetupScore({ ...merged, planned_rr: plannedRr(merged) }).setup_score
  };
}

function toTrade(payload: Partial<TradePayload>, existing?: Trade): Trade {
  const timestamp = nowIso();
  return {
    ...normalizePayload(payload),
    id: existing?.id ?? id(),
    created_at: existing?.created_at ?? timestamp,
    updated_at: timestamp
  };
}

function plannedRr(payload: Pick<TradePayload, "entry_price" | "stop_loss" | "tp1_price">) {
  if (payload.entry_price === null || payload.stop_loss === null || payload.tp1_price === null) return null;
  const risk = Math.abs(payload.entry_price - payload.stop_loss);
  return risk ? Math.abs(payload.tp1_price - payload.entry_price) / risk : null;
}

function calculatePocRisk(setup: Pick<TradePayload, "location" | "market_state" | "distance_to_poc" | "poc_risk_level">) {
  const distance = setup.distance_to_poc;
  let level = setup.poc_risk_level || "Unknown";
  if (setup.location === "POC") level = "High";
  else if (distance !== null && distance <= POC_HIGH_DISTANCE) level = "High";
  else if (setup.market_state === "Balanced" && setup.location === "Other") level = "Medium";
  else if (setup.location === "VAH" || setup.location === "VAL") {
    level = distance !== null && distance <= POC_MEDIUM_DISTANCE ? "Medium" : "Low";
  }
  if (setup.market_state === "Balanced" && setup.location === "POC") level = "High";
  return { poc_risk_level: level, poc_risk_message: `POC Risk: ${level}` };
}

const REQUIRED_TAKEN_FIELDS: Array<[keyof TradePayload, string]> = [
  ["entry_price", "entry"],
  ["stop_loss", "stop"],
  ["result", "result"],
  ["result_r", "result_r"],
  ["direction", "direction"],
  ["session", "session"],
  ["location", "location"],
  ["bias_15m", "15m_bias"],
  ["liquidity_sweep", "sweep"],
  ["choch", "choch"],
  ["fvg_reaction", "fvg"]
];

function missingRequiredFields(trade: Partial<TradePayload>) {
  if (trade.trade_decision !== "Taken") return [];
  const required = trade.imported
    ? [
      ...REQUIRED_TAKEN_FIELDS,
      ["setup_type", "setup_type"],
      ["manual_quality", "manual_quality"]
    ] as Array<[keyof TradePayload, string]>
    : REQUIRED_TAKEN_FIELDS;
  return required.filter(([field]) => {
    const value = trade[field];
    return value === null || value === undefined || String(value).trim() === "";
  }).map(([, label]) => label);
}

function classifyDataQuality(trade: Partial<TradePayload>): "good" | "incomplete" | "bad" {
  if (trade.trade_decision !== "Taken") return "incomplete";
  const missing = missingRequiredFields(trade);
  if (missing.length) return "incomplete";
  if (!["TP1", "BE", "SL"].includes(String(trade.result))) return "bad";
  if (trade.entry_price !== null && trade.stop_loss !== null && Number(trade.entry_price) === Number(trade.stop_loss)) return "bad";
  if (trade.result === "SL" && asNumber(trade.result_r) >= 0) return "bad";
  if (trade.result === "TP1" && asNumber(trade.result_r) <= 0) return "bad";
  return "good";
}

function validTakenTrades(trades: Trade[]) {
  return trades.filter((trade) => trade.trade_decision === "Taken" && classifyDataQuality(trade) === "good");
}

function dataQualityDashboard(trades: Trade[]): DataQualityDashboard {
  const counts = { good: 0, incomplete: 0, bad: 0 };
  const missing = new Map<string, number>();
  const tradeWarnings: DataQualityDashboard["trade_warnings"] = [];

  for (const trade of trades) {
    const quality = classifyDataQuality(trade);
    counts[quality] += 1;
    for (const field of missingRequiredFields(trade)) {
      missing.set(field, (missing.get(field) ?? 0) + 1);
    }
    if (quality === "bad") {
      tradeWarnings.push({ trade_id: trade.id, date: trade.date, warnings: ["Invalid taken trade values"] });
    }
  }

  return {
    total_records: trades.length,
    taken_records: trades.filter((trade) => trade.trade_decision === "Taken").length,
    valid_taken_trades: validTakenTrades(trades).length,
    ...counts,
    missing_field_warnings: [...missing.entries()]
      .map(([field, count]) => ({ field, count }))
      .sort((a, b) => b.count - a.count),
    trade_warnings: tradeWarnings.slice(0, 20)
  };
}

function gradeForScore(score: number) {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "Avoid";
}

function calculateSetupScore(
  setup: AnalyzerRequest | (TradePayload & { planned_rr?: number | null }),
  probability?: Pick<AnalyzerResponse, "tp1_probability" | "sl_probability" | "sample_size" | "historical">
) {
  let score = 50;
  const components: AnalyzerResponse["score_components"] = [
    { label: "Base quality", points: 50, reason: "Neutral starting score before setup evidence." }
  ];

  if (setup.bias_15m.toLowerCase() === setup.direction.toLowerCase()) {
    score += 15;
    components.push({ label: "15m bias alignment", points: 15, reason: "Setup direction matches trader bias." });
  } else if (["neutral", "mixed"].includes(setup.bias_15m.toLowerCase())) {
    components.push({ label: "15m bias alignment", points: 0, reason: "Bias is neutral or mixed." });
  } else {
    score -= 10;
    components.push({ label: "15m bias conflict", points: -10, reason: "Setup direction conflicts with trader bias." });
  }

  const structurePresent = (value: string | null | undefined) => Boolean(value && !["None", "No", "Unknown"].includes(value));

  if (structurePresent(setup.liquidity_sweep)) {
    score += 15;
    components.push({ label: "Liquidity sweep", points: 15, reason: `Liquidity sweep is present on ${setup.liquidity_sweep}.` });
  }
  if (structurePresent(setup.choch)) {
    score += 10;
    components.push({ label: "CHOCH", points: 10, reason: `Change of character is present on ${setup.choch}.` });
  }
  if (setup.lh_hl === "Yes" || (setup.direction === "Long" && setup.lh_hl === "HL for Long") || (setup.direction === "Short" && setup.lh_hl === "LH for Short")) {
    score += 10;
    components.push({ label: "Entry pullback structure", points: 10, reason: `${setup.lh_hl} supports the entry direction.` });
  } else if (setup.lh_hl === "Failed HL" || setup.lh_hl === "Failed LH") {
    score -= 10;
    components.push({ label: "Entry pullback structure", points: -10, reason: `${setup.lh_hl} weakens entry structure.` });
  }

  const fvgPoints = { Strong: 10, Medium: 5, Weak: 0, None: -5 }[setup.fvg_reaction] ?? 0;
  score += fvgPoints;
  components.push({ label: "FVG reaction", points: fvgPoints, reason: `${setup.fvg_reaction || "Unknown"} FVG reaction.` });

  const volumePoints = { High: 5, Normal: 2, Low: -3 }[setup.volume_state] ?? 0;
  score += volumePoints;
  components.push({ label: "Volume state", points: volumePoints, reason: `${setup.volume_state || "Unknown"} volume context.` });

  if (setup.location === "VAH" || setup.location === "VAL") {
    score += 10;
    components.push({ label: "Value area edge", points: 10, reason: "Setup is at VAH/VAL." });
  } else if (setup.location === "POC") {
    score -= 20;
    components.push({ label: "Inside POC zone", points: -20, reason: "POC can reduce location quality." });
  } else if (["PDH", "PDL", "EQH", "EQL"].includes(setup.location)) {
    score += 5;
    components.push({ label: "External liquidity", points: 5, reason: "Setup is near prior or equal highs/lows." });
  }

  if (setup.market_state === "Balanced") {
    score -= 10;
    components.push({ label: "Balanced market", points: -10, reason: "Balanced markets can reduce directional follow-through." });
  }
  if (setup.planned_rr !== null && setup.planned_rr !== undefined && setup.planned_rr < 1.5) {
    score -= 15;
    components.push({ label: "Poor RR", points: -15, reason: "Planned reward/risk is below 1.5R." });
  }

  const baseScore = Math.max(0, Math.min(100, Math.round(score)));
  const historicalEdgeScore =
    probability && probability.tp1_probability >= 65 && probability.historical.average_rr > 0.75
      ? 12
      : probability && probability.tp1_probability >= 55 && probability.historical.average_rr > 0.25
        ? 7
        : probability && (probability.sl_probability >= 45 || probability.historical.average_rr < 0)
          ? -12
          : 0;
  const marketRegimeScore =
    (setup.regime_label === "Trend Up" && setup.direction === "Long") || (setup.regime_label === "Trend Down" && setup.direction === "Short")
      ? 8
      : setup.regime_label === "Expansion"
        ? 6
        : setup.regime_label === "POC Chop"
          ? -14
          : setup.regime_label === "News Driven"
            ? -10
            : setup.regime_label === "Balanced" || setup.regime_label === "Choppy"
              ? -8
              : 0;
  const pocRiskPenalty =
    setup.location === "POC" || setup.poc_risk_level === "High"
      ? -18
      : setup.distance_to_poc !== null && setup.distance_to_poc <= POC_HIGH_DISTANCE
        ? -12
        : setup.poc_risk_level === "Medium"
          ? -6
          : 0;
  const newsRiskPenalty =
    setup.high_impact_news === "Yes"
      ? -12
      : setup.news_timing === "During News"
        ? -15
        : setup.news_timing === "Before News" || setup.news_timing === "After News"
          ? -6
          : 0;
  const dataConfidenceAdjustment = probability ? (probability.sample_size >= 30 ? 5 : probability.sample_size >= 10 ? 0 : -8) : 0;

  [
    ["Historical edge", historicalEdgeScore, "Similar historical outcomes adjusted this setup."],
    ["Market regime", marketRegimeScore, "Manual regime label adjusted directional quality."],
    ["POC risk", pocRiskPenalty, "POC proximity and risk level adjusted quality."],
    ["News risk", newsRiskPenalty, "High-impact news timing adjusted quality."],
    ["Data confidence", dataConfidenceAdjustment, "Historical sample size adjusted confidence."]
  ].forEach(([label, points, reason]) => {
    if (typeof points === "number" && points !== 0) components.push({ label: String(label), points, reason: String(reason) });
  });

  const setupScore = Math.max(
    0,
    Math.min(100, Math.round(baseScore + historicalEdgeScore + marketRegimeScore + pocRiskPenalty + newsRiskPenalty + dataConfidenceAdjustment))
  );
  const recommendedRiskLevel =
    setupScore < 60 || (probability?.sl_probability ?? 0) >= 45 || pocRiskPenalty <= -18 || newsRiskPenalty <= -12
      ? "no trade"
      : setupScore < 75 || (probability?.sl_probability ?? 0) >= 30 || pocRiskPenalty < 0 || newsRiskPenalty < 0
        ? "half risk"
        : "full risk";

  return {
    setup_score: setupScore,
    trade_grade: gradeForScore(setupScore),
    base_score: baseScore,
    historical_edge_score: historicalEdgeScore,
    market_regime_score: marketRegimeScore,
    poc_risk_penalty: pocRiskPenalty,
    news_risk_penalty: newsRiskPenalty,
    data_confidence_adjustment: dataConfidenceAdjustment,
    score_components: components,
    average_r: probability?.historical.average_rr ?? 0,
    recommended_risk_level: recommendedRiskLevel,
    explanation_notes: [
      `Base rule score: ${baseScore}.`,
      `Historical edge adjustment: ${historicalEdgeScore}.`,
      `Market regime adjustment: ${marketRegimeScore}.`,
      `POC/news adjustment: ${pocRiskPenalty + newsRiskPenalty}.`,
      `Recommended risk level: ${recommendedRiskLevel}.`
    ]
  };
}

function groupPerformance(trades: Trade[], field: keyof Trade | "month"): PerformanceGroup[] {
  const groups = new Map<string, Trade[]>();
  for (const trade of trades) {
    const key = field === "month" ? trade.date.slice(0, 7) : String(trade[field] || "Unknown");
    groups.set(key, [...(groups.get(key) ?? []), trade]);
  }
  return [...groups.entries()]
    .map(([name, group]) => {
      const results = group.map((trade) => asNumber(trade.result_r));
      return {
        name,
        trades: group.length,
        win_rate: pct(group.filter((trade) => trade.result === "TP1").length, group.length),
        tp1_rate: pct(group.filter((trade) => trade.result === "TP1").length, group.length),
        sl_rate: pct(group.filter((trade) => trade.result === "SL").length, group.length),
        expectancy: avg(results),
        result_r: Number(results.reduce((sum, value) => sum + value, 0).toFixed(2))
      };
    })
    .sort((a, b) => b.result_r - a.result_r);
}

function tradeSummaryRows(trades: Trade[], reverse: boolean): PerformanceGroup[] {
  return [...trades]
    .sort((a, b) => reverse ? asNumber(b.result_r) - asNumber(a.result_r) : asNumber(a.result_r) - asNumber(b.result_r))
    .slice(0, 5)
    .map((trade) => ({
      name: `${trade.date} ${trade.session} ${trade.location}`,
      trades: 1,
      win_rate: trade.result === "TP1" ? 100 : 0,
      tp1_rate: trade.result === "TP1" ? 100 : 0,
      sl_rate: trade.result === "SL" ? 100 : 0,
      expectancy: asNumber(trade.result_r),
      result_r: asNumber(trade.result_r)
    }));
}

function mistakeRows(trades: Trade[]) {
  const groups = new Map<string, Trade[]>();
  for (const trade of trades) {
    const key = trade.mistake_type || "None";
    groups.set(key, [...(groups.get(key) ?? []), trade]);
  }
  return [...groups.entries()].map(([mistake_type, group]) => {
    const losses = group.filter((trade) => asNumber(trade.result_r) < 0);
    return {
      mistake_type,
      count: group.length,
      frequency: pct(group.length, trades.length),
      loss_r: Number(losses.reduce((sum, trade) => sum + asNumber(trade.result_r), 0).toFixed(2)),
      win_rate: pct(group.filter((trade) => trade.result === "TP1").length, group.length)
    };
  });
}

function calculateDashboard(trades: Trade[]): Dashboard {
  if (!trades.length) return emptyDashboard;
  const ordered = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  const results = ordered.map((trade) => asNumber(trade.result_r));
  let equity = 0;
  const curve = ordered.map((trade) => {
    equity += asNumber(trade.result_r);
    return { date: trade.date, equity: Number(equity.toFixed(2)) };
  });
  const skipped = trades.filter((trade) => trade.trade_decision === "Skipped");
  const taken = trades.filter((trade) => trade.trade_decision === "Taken");
  const mistakes = mistakeRows(trades);

  return {
    total_trades: trades.length,
    win_rate: pct(trades.filter((trade) => trade.result === "TP1").length, trades.length),
    tp1_rate: pct(trades.filter((trade) => trade.result === "TP1").length, trades.length),
    be_rate: pct(trades.filter((trade) => trade.result === "BE").length, trades.length),
    sl_rate: pct(trades.filter((trade) => trade.result === "SL").length, trades.length),
    average_rr: avg(results),
    profit_factor: profitFactor(results),
    expectancy: avg(results),
    max_winning_streak: maxStreak(results, true),
    max_losing_streak: maxStreak(results, false),
    average_mfe: avg(trades.map((trade) => asNumber(trade.mfe))),
    average_mae: avg(trades.map((trade) => asNumber(trade.mae))),
    taken_count: taken.length,
    skipped_count: skipped.length,
    watched_count: trades.filter((trade) => trade.trade_decision === "Watched").length,
    invalidated_count: trades.filter((trade) => trade.trade_decision === "Invalidated").length,
    skipped_tp1_rate: pct(skipped.filter((trade) => trade.result === "TP1").length, skipped.length),
    skipped_sl_rate: pct(skipped.filter((trade) => trade.result === "SL").length, skipped.length),
    best_skipped_opportunities: tradeSummaryRows(skipped, true),
    worst_taken_trades: tradeSummaryRows(taken, false),
    top_mistakes: mistakes.sort((a, b) => b.count - a.count).slice(0, 5),
    losses_by_mistake_type: mistakes.sort((a, b) => a.loss_r - b.loss_r).slice(0, 5),
    performance_curve: curve,
    monthly_performance: groupPerformance(trades, "month"),
    session_performance: groupPerformance(trades, "session"),
    location_performance: groupPerformance(trades, "location"),
    poc_performance: groupPerformance(trades.filter((trade) => ["POC", "VAH", "VAL", "Other"].includes(trade.location)), "location"),
    strategy_performance: groupPerformance(trades.filter((trade) => trade.strategy_version), "strategy_version"),
    news_timing_performance: groupPerformance(trades, "news_timing"),
    detailed_session_performance: groupPerformance(trades, "session")
  };
}

function similarityScore(setup: AnalyzerRequest, trade: Trade) {
  const max = Object.values(SIMILARITY_WEIGHTS).reduce((sum, value) => sum + value, 0);
  const raw = Object.entries(SIMILARITY_WEIGHTS).reduce((sum, [field, weight]) => {
    return setup[field as keyof AnalyzerRequest] === trade[field as keyof Trade] ? sum + weight : sum;
  }, 0);
  return Math.round((raw / max) * 100);
}

function maxLosingStreak(trades: Trade[]) {
  return maxStreak(
    [...trades]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((trade) => trade.result === "SL" ? -1 : asNumber(trade.result_r)),
    false
  );
}

function historicalPocSlRate(trades: Trade[]) {
  const nearPoc = trades.filter((trade) => {
    const distance = trade.distance_to_poc;
    return trade.location === "POC" || trade.poc_risk_level === "High" || (distance !== null && distance <= POC_HIGH_DISTANCE);
  });
  return pct(nearPoc.filter((trade) => trade.result === "SL").length, nearPoc.length);
}

function evaluateSetup(setup: AnalyzerRequest): AnalyzerResponse {
  const trades = validTakenTrades(readTrades()).filter((trade) => !setup.regime_label || trade.regime_label === setup.regime_label);
  const selected = trades
    .map((trade) => ({ trade, similarity_score: similarityScore(setup, trade) }))
    .filter((item) => item.similarity_score >= 50)
    .sort((a, b) => b.similarity_score - a.similarity_score);
  const decisive = selected.map((item) => item.trade).filter((trade) => ["TP1", "BE", "SL"].includes(trade.result));
  const results = decisive.map((trade) => asNumber(trade.result_r));
  const poc = calculatePocRisk(setup);
  const historical = {
    historical_win_rate: pct(decisive.filter((trade) => trade.result === "TP1").length, decisive.length),
    historical_tp1_rate: pct(decisive.filter((trade) => trade.result === "TP1").length, decisive.length),
    historical_be_rate: pct(decisive.filter((trade) => trade.result === "BE").length, decisive.length),
    historical_sl_rate: pct(decisive.filter((trade) => trade.result === "SL").length, decisive.length),
    average_rr: avg(results),
    average_mfe: avg(selected.map((item) => asNumber(item.trade.mfe))),
    average_mae: avg(selected.map((item) => asNumber(item.trade.mae))),
    max_losing_streak: maxLosingStreak(decisive),
    sample_size: selected.length
  };
  const probability = {
    historical,
    tp1_probability: historical.historical_tp1_rate,
    be_probability: historical.historical_be_rate,
    sl_probability: historical.historical_sl_rate,
    confidence_level: selected.length >= 30 ? "High" : selected.length >= 10 ? "Medium" : "Low",
    sample_size: selected.length
  };
  const score = calculateSetupScore(setup, probability);
  const management = compareManagementStyles({ partial_exit_percent: 50, be_after_tp1: true, tp2_enabled: true, tp2_price: null });

  return {
    ...score,
    ...probability,
    most_similar_trades: selected.slice(0, 20).map(({ trade, similarity_score }) => ({
      id: trade.id,
      date: trade.date,
      session: trade.session,
      direction: trade.direction,
      location: trade.location,
      trade_decision: trade.trade_decision,
      result: trade.result,
      result_r: asNumber(trade.result_r),
      mfe: asNumber(trade.mfe),
      mae: asNumber(trade.mae),
      similarity_score
    })),
    ...poc,
    historical_poc_sl_rate: historicalPocSlRate(trades),
    best_management_rule: management.best_management_style
  };
}

function tpR(trade: Trade, field: "tp1_price" | "tp2_price") {
  if (trade.entry_price === null || trade.stop_loss === null || trade[field] === null) return null;
  const risk = Math.abs(trade.entry_price - trade.stop_loss);
  return risk ? Number((Math.abs(Number(trade[field]) - trade.entry_price) / risk).toFixed(2)) : null;
}

function compareManagementStyles(params: {
  partial_exit_percent: number;
  be_after_tp1: boolean;
  tp2_enabled: boolean;
  tp2_price: number | null;
  regime_label?: string | null;
}): ManagementResponse {
  const trades = validTakenTrades(filterByRegime(readTrades(), params));
  const candidates = trades.filter(
    (trade) => trade.trade_decision === "Taken" && trade.entry_price !== null && trade.stop_loss !== null && trade.tp1_price !== null
  );
  const eligible = candidates.filter((trade) => (trade.mfe !== 0 || trade.mae !== 0));
  const warning = eligible.length < candidates.length || !eligible.length ? "Not enough MFE/MAE or TP2 data to evaluate this rule." : null;
  const partial = Math.max(0, Math.min(1, params.partial_exit_percent / 100));
  const runner = 1 - partial;
  const buckets: Record<string, number[]> = {
    "TP1 then move stop to BE": [],
    "TP1 then keep original SL": [],
    "TP1 then trail using MFE threshold": [],
    "TP1 partial exit then hold TP2": [],
    "Exit full position at TP1": []
  };

  for (const trade of eligible) {
    const tp1 = tpR(trade, "tp1_price") ?? 1;
    let tp2 = tpR(trade, "tp2_price");
    if (tp2 === null && params.tp2_price !== null && trade.entry_price !== null && trade.stop_loss !== null) {
      const risk = Math.abs(trade.entry_price - trade.stop_loss);
      tp2 = risk ? Number((Math.abs(params.tp2_price - trade.entry_price) / risk).toFixed(2)) : null;
    }
    const reachedTp1 = trade.result === "TP1" || asNumber(trade.mfe) >= tp1;
    if (!reachedTp1) {
      const fallback = trade.result === "SL" ? -1 : asNumber(trade.result_r);
      Object.values(buckets).forEach((rows) => rows.push(fallback));
      continue;
    }

    buckets["TP1 then move stop to BE"].push(Number((partial * tp1).toFixed(2)));
    buckets["TP1 then keep original SL"].push(Number((partial * tp1 + runner * (asNumber(trade.mae) <= -1 ? -1 : Math.min(asNumber(trade.mfe), tp1))).toFixed(2)));
    buckets["TP1 then trail using MFE threshold"].push(Number((partial * tp1 + runner * (asNumber(trade.mfe) >= Math.max(tp1 * 1.5, tp1 + 0.5) ? 0.5 : 0)).toFixed(2)));
    buckets["TP1 partial exit then hold TP2"].push(Number((partial * tp1 + runner * (params.tp2_enabled && tp2 !== null && asNumber(trade.mfe) >= tp2 ? tp2 : asNumber(trade.mae) <= -1 ? -1 : 0)).toFixed(2)));
    buckets["Exit full position at TP1"].push(Number(tp1.toFixed(2)));
  }

  const strategies = Object.entries(buckets).map(([name, results]) => ({
    name,
    total_r: Number(results.reduce((sum, value) => sum + value, 0).toFixed(2)),
    average_r: avg(results),
    win_rate: pct(results.filter((value) => value > 0).length, results.length),
    max_drawdown: maxDrawdown(results),
    max_losing_streak: maxStreak(results, false),
    profit_factor: profitFactor(results),
    sample_size: results.length,
    warning: warning || (name === "TP1 partial exit then hold TP2" && params.tp2_price === null && !eligible.some((trade) => tpR(trade, "tp2_price")) ? warning : null)
  }));

  return {
    enabled: true,
    assumptions: params,
    baseline: { trades: trades.length, eligible_trades: eligible.length },
    best_management_style: strategies.length ? [...strategies].sort((a, b) => b.total_r - a.total_r)[0].name : null,
    strategies,
    regime_comparison: compareManagementByRegime(trades, params)
  };
}

function compareManagementByRegime(
  trades: Trade[],
  params: { partial_exit_percent: number; be_after_tp1: boolean; tp2_enabled: boolean; tp2_price: number | null }
) {
  const groupFields: Array<keyof Trade> = ["market_state", "session", "location", "poc_risk_level", "news_timing", "strategy_version"];
  const candidates = trades.filter(
    (trade) =>
      trade.entry_price !== null &&
      trade.stop_loss !== null &&
      trade.tp1_price !== null &&
      (asNumber(trade.mfe) !== 0 || asNumber(trade.mae) !== 0)
  );

  return groupFields.flatMap((field) => {
    const groups = new Map<string, Trade[]>();
    for (const trade of candidates) {
      const key = String(trade[field] || "Unknown");
      groups.set(key, [...(groups.get(key) ?? []), trade]);
    }

    return [...groups.entries()].map(([groupValue, group]) => {
      const result = compareManagementGroup(group, params);
      const best = [...result].sort((a, b) => b.total_r - a.total_r)[0] ?? null;
      return {
        group_field: field,
        group_value: groupValue,
        sample_size: group.length,
        best_rule: best?.name ?? null,
        best_total_r: best?.total_r ?? 0,
        best_average_r: best?.average_r ?? 0,
        best_profit_factor: best?.profit_factor ?? 0,
        strategies: result
      };
    });
  }).sort((a, b) => a.group_field.localeCompare(b.group_field) || b.sample_size - a.sample_size || b.best_total_r - a.best_total_r);
}

function compareManagementGroup(
  trades: Trade[],
  params: { partial_exit_percent: number; be_after_tp1: boolean; tp2_enabled: boolean; tp2_price: number | null }
): ManagementResponse["strategies"] {
  const partial = Math.max(0, Math.min(1, params.partial_exit_percent / 100));
  const runner = 1 - partial;
  const buckets: Record<string, number[]> = {
    "TP1 then move stop to BE": [],
    "TP1 then keep original SL": [],
    "TP1 then trail using MFE threshold": [],
    "TP1 partial exit then hold TP2": [],
    "Exit full position at TP1": []
  };

  for (const trade of trades) {
    const tp1 = tpR(trade, "tp1_price") ?? 1;
    let tp2 = tpR(trade, "tp2_price");
    if (tp2 === null && params.tp2_price !== null && trade.entry_price !== null && trade.stop_loss !== null) {
      const risk = Math.abs(trade.entry_price - trade.stop_loss);
      tp2 = risk ? Number((Math.abs(params.tp2_price - trade.entry_price) / risk).toFixed(2)) : null;
    }
    const reachedTp1 = trade.result === "TP1" || asNumber(trade.mfe) >= tp1;
    if (!reachedTp1) {
      const fallback = trade.result === "SL" ? -1 : asNumber(trade.result_r);
      Object.values(buckets).forEach((rows) => rows.push(fallback));
      continue;
    }

    buckets["TP1 then move stop to BE"].push(Number((partial * tp1).toFixed(2)));
    buckets["TP1 then keep original SL"].push(Number((partial * tp1 + runner * (asNumber(trade.mae) <= -1 ? -1 : Math.min(asNumber(trade.mfe), tp1))).toFixed(2)));
    buckets["TP1 then trail using MFE threshold"].push(Number((partial * tp1 + runner * (asNumber(trade.mfe) >= Math.max(tp1 * 1.5, tp1 + 0.5) ? 0.5 : 0)).toFixed(2)));
    buckets["TP1 partial exit then hold TP2"].push(Number((partial * tp1 + runner * (params.tp2_enabled && tp2 !== null && asNumber(trade.mfe) >= tp2 ? tp2 : asNumber(trade.mae) <= -1 ? -1 : 0)).toFixed(2)));
    buckets["Exit full position at TP1"].push(Number(tp1.toFixed(2)));
  }

  return Object.entries(buckets).map(([name, results]) => ({
    name,
    total_r: Number(results.reduce((sum, value) => sum + value, 0).toFixed(2)),
    average_r: avg(results),
    win_rate: pct(results.filter((value) => value > 0).length, results.length),
    max_drawdown: maxDrawdown(results),
    max_losing_streak: maxStreak(results, false),
    profit_factor: profitFactor(results),
    sample_size: results.length,
    warning: null
  }));
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const index = Math.min(ordered.length - 1, Math.max(0, Math.round((percentileValue / 100) * (ordered.length - 1))));
  return Number(ordered[index].toFixed(2));
}

function seededRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function maxDollarDrawdown(results: number[]) {
  let equity = 0;
  let peak = 0;
  let drawdown = 0;
  for (const result of results) {
    equity += result;
    peak = Math.max(peak, equity);
    drawdown = Math.min(drawdown, equity - peak);
  }
  return Math.abs(Number(drawdown.toFixed(2)));
}

function dailyLimitHit(results: number[], tradesPerDay: number, dailyLossLimit: number) {
  const chunk = Math.max(1, tradesPerDay);
  for (let index = 0; index < results.length; index += chunk) {
    const day = results.slice(index, index + chunk).reduce((sum, value) => sum + value, 0);
    if (day <= -Math.abs(dailyLossLimit)) return true;
  }
  return false;
}

function runMonteCarlo(params: {
  simulations: number;
  account_size: number;
  risk_per_trade: number;
  risk_mode: string;
  daily_loss_limit: number | null;
  account_drawdown_limit_percent: number;
  trades_per_day: number;
  regime_label?: string | null;
}): MonteCarloResponse {
  const trades = validTakenTrades(filterByRegime(readTrades(), params));
  const resultRs = trades.map((trade) => asNumber(trade.result_r));
  const simulations = Math.max(1000, Math.min(10000, Math.round(params.simulations)));
  const riskAmount = params.risk_mode === "dollars" ? params.risk_per_trade : params.account_size * (params.risk_per_trade / 100);
  const riskPercent = params.account_size ? Number(((riskAmount / params.account_size) * 100).toFixed(3)) : 0;
  const dailyLossLimit = params.daily_loss_limit ?? params.account_size * 0.02;
  const accountDrawdownLimit = params.account_size * (params.account_drawdown_limit_percent / 100);

  if (!resultRs.length) {
    return {
      enabled: false,
      message: "Not enough valid taken trades for Monte Carlo.",
      sample_size: 0,
      simulations,
      account_size: params.account_size,
      risk_per_trade: params.risk_per_trade,
      risk_mode: params.risk_mode,
      risk_amount: Number(riskAmount.toFixed(2)),
      risk_percent: riskPercent,
      daily_loss_limit: Number(dailyLossLimit.toFixed(2)),
      account_drawdown_limit: Number(accountDrawdownLimit.toFixed(2)),
      max_drawdown: 0,
      average_drawdown: 0,
      worst_drawdown: 0,
      drawdown_p95: 0,
      longest_losing_streak: 0,
      probability_daily_loss_limit: 0,
      probability_account_drawdown_limit: 0,
      risk_level: "dangerous"
    };
  }

  const random = seededRandom(42);
  const drawdowns: number[] = [];
  const losingStreaks: number[] = [];
  let dailyHits = 0;
  let accountHits = 0;

  for (let simulation = 0; simulation < simulations; simulation += 1) {
    const sampledR = Array.from({ length: resultRs.length }, () => resultRs[Math.floor(random() * resultRs.length)]);
    const sampledDollars = sampledR.map((value) => value * riskAmount);
    const drawdown = maxDollarDrawdown(sampledDollars);
    drawdowns.push(drawdown);
    losingStreaks.push(maxStreak(sampledR, false));
    if (dailyLimitHit(sampledDollars, params.trades_per_day, dailyLossLimit)) dailyHits += 1;
    if (drawdown >= accountDrawdownLimit) accountHits += 1;
  }

  const probabilityDaily = pct(dailyHits, simulations);
  const probabilityAccount = pct(accountHits, simulations);
  const riskLevel =
    riskPercent <= 0.5 && probabilityDaily < 10 && probabilityAccount < 10
      ? "safe"
      : riskPercent <= 1 && probabilityDaily < 25 && probabilityAccount < 25
        ? "caution"
        : "dangerous";

  return {
    enabled: true,
    message: "Monte Carlo uses only valid taken trades.",
    sample_size: resultRs.length,
    simulations,
    account_size: params.account_size,
    risk_per_trade: params.risk_per_trade,
    risk_mode: params.risk_mode,
    risk_amount: Number(riskAmount.toFixed(2)),
    risk_percent: riskPercent,
    daily_loss_limit: Number(dailyLossLimit.toFixed(2)),
    account_drawdown_limit: Number(accountDrawdownLimit.toFixed(2)),
    max_drawdown: Math.max(...drawdowns),
    average_drawdown: avg(drawdowns),
    worst_drawdown: Math.max(...drawdowns),
    drawdown_p95: percentile(drawdowns, 95),
    longest_losing_streak: Math.max(...losingStreaks),
    probability_daily_loss_limit: probabilityDaily,
    probability_account_drawdown_limit: probabilityAccount,
    risk_level: riskLevel
  };
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function exportCsv() {
  const rows = [TRADE_FIELDS.join(","), ...readTrades().map((trade) => TRADE_FIELDS.map((field) => csvEscape(trade[field])).join(","))];
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "fabio-edge-trades.csv";
  link.click();
  URL.revokeObjectURL(url);
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
  return rows.filter((item) => item.some(Boolean));
}

function parseValue(field: keyof Trade, value: string) {
  if (value === "") return null;
  if (NUMBER_FIELDS.has(field)) return Number(value);
  if (BOOLEAN_FIELDS.has(field)) return value === "true" || value === "Yes";
  return value;
}

function screenshotItems(query = ""): ScreenshotItem[] {
  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  return readTrades()
    .filter((trade) => trade.screenshot_path)
    .filter((trade) => {
      for (const [key, value] of params.entries()) {
        if (key === "tag") {
          if (!trade.screenshot_tags?.toLowerCase().includes(value.toLowerCase())) return false;
        } else if (key === "score_min") {
          if (asNumber(trade.setup_score) < Number(value)) return false;
        } else if (key === "score_max") {
          if (asNumber(trade.setup_score) > Number(value)) return false;
        } else if (key === "start_date") {
          if (trade.date < value) return false;
        } else if (key === "end_date") {
          if (trade.date > value) return false;
        } else if (String(trade[key as keyof Trade] ?? "") !== value) {
          return false;
        }
      }
      return true;
    })
    .map((trade) => ({
      id: `shot-${trade.id}`,
      trade_id: trade.id,
      date: trade.date,
      session: trade.session,
      direction: trade.direction,
      location: trade.location,
      result: trade.result,
      setup_score: trade.setup_score ?? 0,
      strategy_version: trade.strategy_version ?? "",
      market_state: trade.market_state,
      regime_label: trade.regime_label ?? "",
      choch: trade.choch,
      liquidity_sweep: trade.liquidity_sweep,
      fvg_reaction: trade.fvg_reaction,
      trade_decision: trade.trade_decision,
      screenshot_path: trade.screenshot_path ?? "",
      screenshot_tags: trade.screenshot_tags ?? "",
      screenshot_favorite: trade.screenshot_favorite,
      screenshot_bookmarked: trade.screenshot_bookmarked,
      screenshot_notes: trade.screenshot_notes ?? "",
      lessons_learned: trade.lessons_learned ?? "",
      result_r: asNumber(trade.result_r)
    }));
}

function reviewAnalytics(source?: Trade[]): ResearchSummary["review"] {
  const rows = mistakeRows(validTakenTrades(source ?? readTrades()));
  return {
    top_mistakes: [...rows].sort((a, b) => b.count - a.count).slice(0, 8),
    most_expensive_mistakes: [...rows].sort((a, b) => a.loss_r - b.loss_r).slice(0, 5)
  };
}

function tradingScores(source?: Trade[]): ResearchSummary["scores"] {
  const trades = validTakenTrades(source ?? readTrades());
  const summary = (name: string, group: Trade[]) => {
    const discipline = avg(group.filter((trade) => trade.discipline_score !== null).map((trade) => asNumber(trade.discipline_score) * 10), 1);
    const execution = avg(group.filter((trade) => trade.execution_score !== null).map((trade) => asNumber(trade.execution_score) * 10), 1);
    const emotional = avg(group.filter((trade) => trade.emotion_score !== null).map((trade) => asNumber(trade.emotion_score) * 10), 1);
    const risk = group.length ? Math.max(0, 100 - group.filter((trade) => ["No Stop", "Moved Stop", "Ignored Risk", "Overtrading"].includes(trade.mistake_type)).length * 18) : 0;
    const consistency = group.length > 1 ? Math.max(0, 100 - Math.min(avg(group.map((trade) => Math.abs(asNumber(trade.result_r))), 1) * 20, 100)) : group.length ? 100 : 0;
    return {
      period: name,
      trades: group.length,
      discipline,
      execution,
      risk_control: risk,
      consistency,
      emotional_control: emotional,
      overall_score: avg([discipline, execution, risk, consistency, emotional].filter((value) => value > 0), 1)
    };
  };
  const groupBy = (key: (trade: Trade) => string) => {
    const groups = new Map<string, Trade[]>();
    for (const trade of trades) groups.set(key(trade), [...(groups.get(key(trade)) ?? []), trade]);
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, group]) => summary(name, group));
  };
  return {
    daily: groupBy((trade) => trade.date),
    weekly: groupBy((trade) => `${new Date(trade.date).getFullYear()}-W${Math.ceil((new Date(trade.date).getDate()) / 7).toString().padStart(2, "0")}`),
    monthly: groupBy((trade) => trade.date.slice(0, 7))
  };
}

function performanceRow(name: string, trades: Trade[]): PerformanceGroup & { profit_factor: number } {
  const results = trades.map((trade) => asNumber(trade.result_r));
  return {
    name,
    trades: trades.length,
    win_rate: pct(trades.filter((trade) => trade.result === "TP1").length, trades.length),
    tp1_rate: pct(trades.filter((trade) => trade.result === "TP1").length, trades.length),
    sl_rate: pct(trades.filter((trade) => trade.result === "SL").length, trades.length),
    expectancy: avg(results),
    result_r: Number(results.reduce((sum, value) => sum + value, 0).toFixed(2)),
    profit_factor: profitFactor(results)
  };
}

function biasAlignment(field: "daily_bias" | "weekly_bias" | "monthly_bias", params?: { regime_label?: string | null }) {
  const groups = new Map<string, Trade[]>();
  for (const trade of validTakenTrades(filterByRegime(readTrades(), params))) {
    const bias = trade[field];
    const key = bias === "Neutral" ? "Neutral" : (trade.direction === "Long" && bias === "Bullish") || (trade.direction === "Short" && bias === "Bearish") ? "With Bias" : "Against Bias";
    groups.set(key, [...(groups.get(key) ?? []), trade]);
  }
  return [...groups.entries()].map(([name, rows]) => performanceRow(name, rows));
}

function newsAnalytics(source?: Trade[]) {
  const trades = validTakenTrades(source ?? readTrades());
  const byType = groupPerformance(trades.filter((trade) => trade.news_type), "news_type");
  const during = trades.filter((trade) => trade.news_timing === "During News");
  return {
    tp1_rate_during_news: pct(during.filter((trade) => trade.result === "TP1").length, during.length),
    sl_rate_during_news: pct(during.filter((trade) => trade.result === "SL").length, during.length),
    performance_before_news: performanceRow("Before News", trades.filter((trade) => trade.news_timing === "Before News")),
    performance_after_news: performanceRow("After News", trades.filter((trade) => trade.news_timing === "After News")),
    performance_by_news_type: byType,
    highest_risk_news_events: [...byType].sort((a, b) => b.sl_rate - a.sl_rate).slice(0, 5),
    best_conditions_around_news: [...byType].sort((a, b) => b.expectancy - a.expectancy).slice(0, 5),
    high_impact_summary: performanceRow("High Impact News", trades.filter((trade) => trade.high_impact_news === "Yes"))
  };
}

function edgeDiscovery(source?: Trade[]): EdgeDiscoveryResponse {
  const trades = validTakenTrades(source ?? readTrades());
  const fields: Array<keyof Trade | "bias_alignment"> = [
    "session",
    "location",
    "liquidity_sweep",
    "choch",
    "fvg_reaction",
    "volume_state",
    "bias_alignment",
    "market_state",
    "regime_label",
    "trade_decision",
    "strategy_version"
  ];
  const groups = new Map<string, Trade[]>();
  for (const trade of trades) {
    for (const field of fields) {
      const value = field === "bias_alignment"
        ? trade.daily_bias === "Neutral"
          ? "Neutral"
          : (trade.direction === "Long" && trade.daily_bias === "Bullish") || (trade.direction === "Short" && trade.daily_bias === "Bearish")
            ? "With Bias"
            : "Against Bias"
        : String(trade[field] || "Unknown");
      const key = `${field}:${value}`;
      groups.set(key, [...(groups.get(key) ?? []), trade]);
    }
  }
  const rows: EdgeCondition[] = [...groups.entries()]
    .filter(([, group]) => group.length >= 3)
    .map(([condition, group]) => {
      const results = group.map((trade) => asNumber(trade.result_r));
      return {
        condition,
        sample_size: group.length,
        tp1_rate: pct(group.filter((trade) => trade.result === "TP1").length, group.length),
        sl_rate: pct(group.filter((trade) => trade.result === "SL").length, group.length),
        average_rr: avg(results),
        profit_factor: profitFactor(results),
        confidence: group.length >= 50 ? "High" : group.length >= 20 ? "Medium" : "Low"
      };
    });
  return {
    top_best_conditions: [...rows].sort((a, b) => b.average_rr - a.average_rr || b.tp1_rate - a.tp1_rate).slice(0, 10),
    top_worst_conditions: [...rows].sort((a, b) => a.average_rr - b.average_rr || b.sl_rate - a.sl_rate).slice(0, 10),
    highest_tp1_conditions: [...rows].sort((a, b) => b.tp1_rate - a.tp1_rate).slice(0, 10),
    highest_sl_conditions: [...rows].sort((a, b) => b.sl_rate - a.sl_rate).slice(0, 10),
    highest_rr_conditions: [...rows].sort((a, b) => b.average_rr - a.average_rr).slice(0, 10),
    most_consistent_conditions: [...rows].sort((a, b) => b.profit_factor - a.profit_factor || b.sample_size - a.sample_size).slice(0, 10)
  };
}

export const localApi = {
  dashboard: async (params?: { regime_label?: string | null }) => {
    const trades = filterByRegime(readTrades(), params);
    return { ...calculateDashboard(validTakenTrades(trades)), data_quality: dataQualityDashboard(trades) };
  },
  trades: async () => [...readTrades()].sort((a, b) => b.date.localeCompare(a.date)),
  createTrade: async (payload: TradePayload) => {
    const trade = toTrade(payload);
    writeTrades([trade, ...readTrades()]);
    return trade;
  },
  updateTrade: async (tradeId: string, payload: Partial<TradePayload>) => {
    const trades = readTrades();
    const existing = trades.find((trade) => trade.id === tradeId);
    if (!existing) throw new Error("Local trade not found");
    const updated = toTrade({ ...existing, ...payload }, existing);
    writeTrades(trades.map((trade) => trade.id === tradeId ? updated : trade));
    return updated;
  },
  deleteTrade: async (tradeId: string) => {
    writeTrades(readTrades().filter((trade) => trade.id !== tradeId));
  },
  evaluateSetup: async (payload: AnalyzerRequest) => evaluateSetup(payload),
  managementLab: async (params: { partial_exit_percent: number; be_after_tp1: boolean; tp2_enabled: boolean; tp2_price: number | null; regime_label?: string | null }) => compareManagementStyles(params),
  dataQualityDashboard: async () => dataQualityDashboard(readTrades()),
  monteCarloRisk: async (params: {
    simulations: number;
    account_size: number;
    risk_per_trade: number;
    risk_mode: string;
    daily_loss_limit: number | null;
    account_drawdown_limit_percent: number;
    trades_per_day: number;
  }) => runMonteCarlo(params),
  mlStatus: async (): Promise<MlStatus> => {
    const current = validTakenTrades(readTrades()).length;
    return {
      enabled: current >= 300,
      minimum_required_trades: 300,
      current_trades: current,
      message: current >= 300 ? "ML architecture ready, training still disabled in this MVP." : "ML disabled: need at least 300 valid taken trades."
    };
  },
  screenshots: async (query = "") => screenshotItems(query),
  review: async (params?: { regime_label?: string | null }) => reviewAnalytics(filterByRegime(readTrades(), params)),
  dailyScore: async (params?: { regime_label?: string | null }) => tradingScores(filterByRegime(readTrades(), params)),
  marketContext: async (params?: { regime_label?: string | null }) => ({
    daily_bias: biasAlignment("daily_bias", params),
    weekly_bias: biasAlignment("weekly_bias", params),
    monthly_bias: biasAlignment("monthly_bias", params)
  }),
  news: async (params?: { regime_label?: string | null }) => newsAnalytics(filterByRegime(readTrades(), params)),
  strategyVersions: async (params?: { regime_label?: string | null }) => {
    const rows = groupPerformance(validTakenTrades(filterByRegime(readTrades(), params)).filter((trade) => trade.strategy_version), "strategy_version");
    return { versions: rows, performance_evolution: rows };
  },
  sessions: async (params?: { regime_label?: string | null }) => {
    const rows = groupPerformance(validTakenTrades(filterByRegime(readTrades(), params)), "session");
    return {
      sessions: rows,
      best_session: rows[0] ?? null,
      worst_session: [...rows].sort((a, b) => a.expectancy - b.expectancy)[0] ?? null,
      most_consistent_session: [...rows].sort((a, b) => b.win_rate - a.win_rate || b.trades - a.trades)[0] ?? null
    };
  },
  edgeDiscovery: async (params?: { regime_label?: string | null }) => edgeDiscovery(filterByRegime(readTrades(), params)),
  marketDataSummary: async (params: MarketSwingParams): Promise<MarketLabSummary> => {
    const candles = readMarketCandles().filter((candle) => candle.symbol === params.symbol && candle.timeframe === params.timeframe);
    return analyzeMarketCandles(candles, 0, null, swingConfigFromParams(params), structureSweepConfigFromParams(params));
  },
  importMarketDataCsv: async (file: File, params: MarketSwingParams): Promise<MarketLabSummary> => {
    const parsed = parseMarketCsv(await file.text(), params.symbol, params.timeframe, file.name);
    const existing = readMarketCandles();
    const existingKeys = new Set(existing.map((candle) => `${candle.symbol}|${candle.timeframe}|${candle.timestamp}`));
    let duplicateRows = parsed.importSummary.duplicate_rows;
    const inserted = parsed.candles
      .filter((candle) => {
        const key = `${candle.symbol}|${candle.timeframe}|${candle.timestamp}`;
        if (existingKeys.has(key)) {
          duplicateRows += 1;
          return false;
        }
        existingKeys.add(key);
        return true;
      })
      .map((candle) => ({ ...candle, id: id() }));
    writeMarketCandles([...existing, ...inserted]);
    const selected = readMarketCandles().filter((candle) => candle.symbol === params.symbol && candle.timeframe === params.timeframe);
    return analyzeMarketCandles(
      selected,
      duplicateRows,
      {
        ...parsed.importSummary,
        inserted_rows: inserted.length,
        duplicate_rows: duplicateRows
      },
      swingConfigFromParams(params),
      structureSweepConfigFromParams(params)
    );
  },
  uploadScreenshot: async (tradeId: string, file: File) => {
    const path = await fileToDataUrl(file);
    return localApi.updateTrade(tradeId, { screenshot_path: path });
  },
  importCsv: async (file: File) => {
    const rows = parseCsv(await file.text());
    const [headers = [], ...body] = rows;
    const imported = body.map((row) => {
      const values = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
      const payload = defaultPayload();
      for (const field of TRADE_FIELDS) {
        if (["id", "created_at", "updated_at"].includes(field)) continue;
        if (field in values) {
          (payload as Record<string, unknown>)[field] = parseValue(field, values[field]);
        }
      }
      return toTrade(payload);
    });
    writeTrades([...imported, ...readTrades()]);
    return imported;
  },
  exportCsv: async () => exportCsv()
};
