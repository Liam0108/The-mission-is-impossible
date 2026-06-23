export type RiskLabel = "Low Risk" | "Medium Risk" | "High Risk" | "Speculative";
export type RecommendationLabel = "Strong Buy Candidate" | "Buy Candidate" | "Watchlist" | "Wait for Better Price" | "Avoid" | "Insufficient Data";
export type RecommendationConfidence = "High" | "Medium" | "Low";
export type ValuationClass = "cheap" | "fair" | "expensive" | "unknown";
export type InvestmentDataSource =
  | "FMP profile"
  | "FMP quote"
  | "FMP ratios"
  | "FMP income statement"
  | "FMP cash flow statement"
  | "FMP historical EOD"
  | "SEC EDGAR XBRL"
  | "manual"
  | "cache"
  | "fallback"
  | "missing";

export type InvestmentFieldAudit = {
  rawValue: number | string | null;
  source: InvestmentDataSource;
  timestamp: string;
  affectedScore: boolean;
};

export type ScoreComponentAudit = InvestmentFieldAudit & {
  key: keyof Omit<ScoreBreakdown, "quality" | "valuation" | "risk">;
  label: string;
  score: number;
  finalWeightPct: number;
};

export type DcfAssumptions = {
  discount_rate_pct: number;
  terminal_growth_pct: number;
  projection_years: number;
  base_fcf_growth_pct: number;
};

export type DcfModelCalculation = {
  baseFcf: number;
  shares: number;
  growthPct: number;
  discountRatePct: number;
  terminalGrowthPct: number;
  projectionYears: number;
  explicitCashFlowPresentValue: number;
  terminalValue: number;
  terminalPresentValue: number;
  equityValue: number;
  fairValue: number;
};

export type ReverseDcfLabel =
  | "Reasonable expectation"
  | "Aggressive expectation"
  | "Very aggressive expectation"
  | "Unrealistic expectation";

export type ReverseDcfResult = {
  solved: boolean;
  targetPrice: number;
  primaryFairValue: number | null;
  impliedGrowthPct: number | null;
  baseGrowthPct: number;
  differencePct: number | null;
  label: ReverseDcfLabel;
  explanation: string;
};

export type ScenarioDecisionLabel =
  | "Deep Value"
  | "Near Bear Case"
  | "Near Base Case"
  | "Requires Bull Case"
  | "Above Bull Case"
  | "Speculative Premium"
  | "Insufficient Scenario Data";

export type ScenarioRiskRewardLabel =
  | "Attractive Risk/Reward"
  | "Balanced Risk/Reward"
  | "Poor Risk/Reward"
  | "Speculative Premium";

export type ScenarioProbabilities = {
  bear: number;
  base: number;
  bull: number;
};

export type ValuationScenario = {
  name: "Bear" | "Base" | "Bull";
  fairValue: number | null;
  upsideDownsidePct: number | null;
  impliedAnnualReturnPct: number | null;
  baseFcf: number | null;
  fcfSource: string;
  growthPct: number;
  discountRatePct: number;
  terminalGrowthPct: number;
  projectionYears: number;
  marginExpansionPct: number;
};

export type ScenarioValuationResult = {
  bear: ValuationScenario;
  base: ValuationScenario;
  bull: ValuationScenario;
  probabilities: ScenarioProbabilities;
  probabilitiesValid: boolean;
  weightedFairValue: number | null;
  weightedUpsideDownsidePct: number | null;
  expectedAnnualizedReturnPct: number | null;
  downsideRisk: number | null;
  downsideToBearPct: number | null;
  upsidePotential: number | null;
  upsideToBullPct: number | null;
  riskRewardRatio: number | null;
  riskRewardLabel: ScenarioRiskRewardLabel;
  decisionLabel: ScenarioDecisionLabel;
  missingReasons: string[];
  explanation: string;
};

export type ValuationContext = {
  normalizedFcf3y?: number | null;
  scenarioProbabilities?: ScenarioProbabilities;
};

export type StockRecord = {
  id: string;
  ticker: string;
  company_name: string;
  sector: string;
  industry: string;
  current_price: number;
  historical_close: number | null;
  target_buy_price: number;
  market_cap: number;
  pe_ratio: number | null;
  revenue_growth_pct: number | null;
  fcf_growth_pct: number | null;
  net_margin_pct: number | null;
  free_cash_flow: number | null;
  debt_to_equity: number | null;
  roe_pct: number | null;
  dividend_yield_pct: number | null;
  volatility_pct: number | null;
  drawdown_52w_pct: number | null;
  average_volume: number | null;
  shares_outstanding: number | null;
  price_to_sales: number | null;
  ev_to_ebitda: number | null;
  notes: string;
  source: string;
  last_updated: string;
  field_audit?: Record<string, InvestmentFieldAudit>;
};

export type Holding = {
  id: string;
  ticker: string;
  shares: number;
  average_cost: number;
  current_price: number;
  sector: string;
  risk_label: RiskLabel;
};

export type WatchlistItem = {
  id: string;
  ticker: string;
  target_buy_price: number;
  reason: string;
  risk_level: RiskLabel;
  notes: string;
  last_updated: string;
};

export type AllocationPlan = {
  to_stocks_pct: number;
  to_cash_pct: number;
  to_trading_account_pct: number;
  to_personal_spending_pct: number;
  trading_profit_amount: number;
  portfolio_cash: number;
  fmp_api_key: string;
};

export type ScoreBreakdown = {
  quality: number;
  valuation: number;
  risk: number;
  roe: number;
  margin: number;
  revenueGrowth: number;
  fcfGrowth: number;
  debt: number;
  dcfDiscount: number;
  peg: number;
  peVsIndustry: number;
  volatility: number;
  drawdown: number;
  debtRisk: number;
};

export type ValuationResult = {
  dcfFairValue: number | null;
  dcfConfidence: "Low" | "Medium" | "High";
  dcfAssumptions: DcfAssumptions;
  primaryDcfMode: "Conservative" | "Normalized";
  primaryDcfReason: string;
  latestFcf: number | null;
  normalizedFcf3y: number | null;
  latestFcfDeviationPct: number | null;
  conservativeDcfFairValue: number | null;
  normalizedDcfFairValue: number | null;
  optimisticDcfFairValue: number | null;
  scenarioValuation: ScenarioValuationResult;
  reverseDcf: ReverseDcfResult;
  impliedGrowthPct: number | null;
  reverseDcfWarning: string;
  relativeScore: number;
  relativeClass: ValuationClass;
  pegRatio: number | null;
  pegClass: ValuationClass;
  fairValueLow: number | null;
  fairValueHigh: number | null;
  conservativeBuyPrice: number | null;
  holdZoneLow: number | null;
  holdZoneHigh: number | null;
  trimZonePrice: number | null;
  confidenceScore: number;
  valuationAgreement: "Aligned" | "Mixed" | "Disagree" | "Unknown";
  dcfRelativeGapPct: number | null;
};

export type StockAnalysis = {
  stock: StockRecord;
  baseScore: number;
  fallbackPenalty: number;
  totalScore: number;
  breakdown: ScoreBreakdown;
  riskLabel: RiskLabel;
  recommendation: RecommendationLabel;
  valuation: ValuationResult;
  marginOfSafetyPct: number | null;
  valuationRisk: "Low" | "Medium" | "High" | "Unknown";
  betterBuyPrice: number | null;
  reasons: string[];
  biggestRisk: string;
  missingData: string[];
  positionSizeRange: string;
  dataReliabilityScore: number;
  recommendationConfidence: RecommendationConfidence;
  warnings: string[];
  componentAudit: ScoreComponentAudit[];
  realDataPercent: number;
  fallbackPercent: number;
  scoreReliable: boolean;
};

export type PortfolioSummary = {
  totalValue: number;
  investedValue: number;
  cash: number;
  cashAllocationPct: number;
  unrealizedPnl: number;
  stockAllocation: Array<{ ticker: string; value: number; allocationPct: number }>;
  sectorAllocation: Array<{ sector: string; value: number; allocationPct: number }>;
  highRiskExposurePct: number;
  speculativeExposurePct: number;
  warnings: string[];
};

export const STOCKS_KEY = "fabio-investment-stocks-v1";
export const HOLDINGS_KEY = "fabio-investment-holdings-v1";
export const WATCHLIST_KEY = "fabio-investment-watchlist-v1";
export const ALLOCATION_KEY = "fabio-investment-allocation-v1";
export const CACHE_KEY = "fabio-investment-data-cache-v1";
export const ASSUMPTIONS_KEY = "fabio-investment-dcf-assumptions-v1";
export const SCENARIO_PROBABILITIES_KEY = "fabio-investment-scenario-probabilities-v1";

export const LOCAL_SP500_UNIVERSE = [
  "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "AVGO", "TSLA", "BRK-B", "LLY",
  "JPM", "V", "UNH", "XOM", "MA", "COST", "WMT", "PG", "JNJ", "HD",
  "ORCL", "ABBV", "NFLX", "BAC", "KO", "CRM", "CVX", "MRK", "AMD", "PEP",
  "ADBE", "TMO", "LIN", "CSCO", "ACN", "MCD", "ABT", "WFC", "QCOM", "TXN",
  "AMGN", "INTU", "IBM", "CAT", "GE", "NOW", "PM", "ISRG", "VZ", "DIS",
  "GS", "RTX", "AXP", "UBER", "PFE", "BKNG", "SPGI", "LOW", "MS", "NEE",
  "HON", "UNP", "BLK", "T", "CMCSA", "TJX", "COP", "SYK", "ETN", "VRTX",
  "LMT", "C", "PANW", "ADP", "MDT", "BMY", "MU", "CB", "ADI", "SBUX",
  "DE", "GILD", "MMC", "PLD", "AMAT", "NKE", "SO", "REGN", "KLAC", "FI",
  "BA", "MDLZ", "INTC", "APH", "AON", "APO", "AMT", "AIG", "AEP", "AEE",
  "AMCR", "ALB", "ALGN", "ALLE", "LNT", "ALL", "MO", "AWK", "AMP", "AKAM",
  "ARE", "AJG", "AIZ", "ATO", "ADSK", "ADP", "AZO", "AVB", "AVY", "BALL",
  "BKR", "BBY", "TECH", "BIIB", "BX", "BK", "BWA", "BSX", "BMY", "BRO",
  "BLDR", "BG", "BXP", "CHRW", "CDNS", "CZR", "CPT", "CPB", "COF", "CAH",
  "KMX", "CCL", "CARR", "CTLT", "CBOE", "CE", "COR", "CNC", "CNP", "CF",
  "CRL", "SCHW", "CHTR", "CVX", "CMG", "CB", "CHD", "CI", "CINF", "CTAS",
  "CLX", "CME", "CMS", "CTSH", "CL", "CAG", "ED", "STZ", "CEG", "COO",
  "CPRT", "GLW", "CPAY", "CTVA", "CSGP", "CCI", "CSX", "CMI", "DHR", "DRI",
  "DVA", "DAY", "DECK", "DELL", "DAL", "DVN", "DXCM", "FANG", "DLR", "DFS",
  "DG", "DLTR", "D", "DPZ", "DOV", "DOW", "DHI", "DTE", "DUK", "DD",
  "EMN", "ETN", "EBAY", "ECL", "EIX", "EW", "EA", "ELV", "EMR", "ENPH",
  "EOG", "EPAM", "EQT", "EFX", "EQIX", "EQR", "ERIE", "ESS", "EL", "EG",
  "EVRG", "ES", "EXC", "EXE", "EXPE", "EXPD", "EXR", "FFIV", "FDS", "FICO",
  "FAST", "FRT", "FDX", "FIS", "FITB", "FSLR", "FE", "FISV", "F", "FTNT",
  "FTV", "FOXA", "FOX", "BEN", "FCX", "GRMN", "IT", "GEN", "GNRC", "GD",
  "GIS", "GM", "GPC", "GPN", "GL", "GDDY", "GILD", "GWW", "HAL", "HIG",
  "HAS", "HCA", "DOC", "HSIC", "HSY", "HES", "HPE", "HLT", "HOLX", "HRL",
  "HST", "HWM", "HPQ", "HUBB", "HUM", "HBAN", "HII", "IEX", "IDXX", "ITW",
  "INCY", "IR", "PODD", "ICE", "IFF", "IP", "IPG", "INVH", "IQV", "IRM",
  "JBHT", "JBL", "JKHY", "J", "JNPR", "K", "KVUE", "KDP", "KEY", "KEYS",
  "KMB", "KIM", "KMI", "KKR", "KLAC", "KHC", "KR", "LHX", "LH", "LRCX",
  "LW", "LVS", "LDOS", "LEN", "LII", "L", "LYV", "LKQ", "LMT", "LULU",
  "LYB", "MTB", "MPC", "MKTX", "MAR", "MMC", "MLM", "MAS", "MA", "MTCH",
  "MKC", "MCK", "MDT", "MRK", "MET", "MTD", "MGM", "MCHP", "MU", "MSI",
  "MSCI", "NDAQ", "NTAP", "NEM", "NWSA", "NWS", "NEE", "NKE", "NI", "NDSN",
  "NSC", "NTRS", "NOC", "NCLH", "NRG", "NUE", "NXPI", "ORLY", "OXY", "ODFL",
  "OMC", "ON", "OKE", "OTIS", "PCAR", "PKG", "PLTR", "PANW", "PARA", "PH",
  "PAYX", "PAYC", "PYPL", "PNR", "PEP", "PFE", "PCG", "PM", "PSX", "PNW",
  "PNC", "POOL", "PPG", "PPL", "PFG", "PG", "PGR", "PLD", "PRU", "PEG",
  "PTC", "PSA", "PHM", "QRVO", "PWR", "QCOM", "DGX", "RL", "RJF", "RTX",
  "O", "REG", "REGN", "RF", "RSG", "RMD", "RVTY", "ROK", "ROL", "ROP",
  "ROST", "RCL", "SPGI", "CRM", "SBAC", "SLB", "STX", "SRE", "NOW", "SHW",
  "SPG", "SWKS", "SJM", "SNA", "SOLV", "SO", "LUV", "SWK", "SBUX", "STT",
  "STLD", "STE", "SYK", "SMCI", "SYF", "SNPS", "SYY", "TMUS", "TROW", "TTWO",
  "TPR", "TRGP", "TGT", "TEL", "TDY", "TFX", "TER", "TSLA", "TXN", "TXT",
  "TMO", "TJX", "TSCO", "TT", "TDG", "TRV", "TRMB", "TFC", "TYL", "TSN",
  "USB", "ULTA", "UNP", "UAL", "UPS", "URI", "UNH", "UHS", "VLO", "VTR",
  "VLTO", "VRSN", "VRSK", "VZ", "VRTX", "VTRS", "VICI", "V", "VST", "VMC",
  "WRB", "GWW", "WAB", "WBA", "WMT", "DIS", "WBD", "WM", "WAT", "WEC",
  "WELL", "WST", "WDC", "WY", "WMB", "WTW", "WDAY", "WYNN", "XEL", "XYL",
  "YUM", "ZBRA", "ZBH", "ZTS"
];

export const LOCAL_NASDAQ_100_UNIVERSE = [
  "AAPL", "ABNB", "ADBE", "ADI", "ADP", "ADSK", "AEP", "AMAT", "AMD", "AMGN",
  "AMZN", "ANSS", "APP", "ARM", "ASML", "AVGO", "AZN", "BIIB", "BKNG", "BKR",
  "CCEP", "CDNS", "CDW", "CEG", "CHTR", "CMCSA", "COST", "CPRT", "CRWD", "CSCO",
  "CSGP", "CSX", "CTAS", "CTSH", "DASH", "DDOG", "DXCM", "EA", "EXC", "FANG",
  "FAST", "FTNT", "GEHC", "GFS", "GILD", "GOOG", "GOOGL", "HON", "IDXX", "INTC",
  "INTU", "ISRG", "KDP", "KHC", "KLAC", "LIN", "LRCX", "LULU", "MAR", "MCHP",
  "MDLZ", "MELI", "META", "MNST", "MRVL", "MSFT", "MU", "NFLX", "NVDA", "NXPI",
  "ODFL", "ON", "ORLY", "PANW", "PAYX", "PCAR", "PDD", "PEP", "PLTR", "PYPL",
  "QCOM", "REGN", "ROP", "ROST", "SBUX", "SHOP", "SNPS", "TEAM", "TMUS", "TSLA",
  "TTD", "TTWO", "TXN", "VRSK", "VRTX", "WBD", "WDAY", "WMT", "XEL", "ZS"
];

export const LOCAL_DOW_30_UNIVERSE = [
  "AAPL", "AMGN", "AMZN", "AXP", "BA", "CAT", "CRM", "CSCO", "CVX", "DIS",
  "GS", "HD", "HON", "IBM", "JNJ", "JPM", "KO", "MCD", "MMM", "MRK",
  "MSFT", "NKE", "NVDA", "PG", "SHW", "TRV", "UNH", "V", "VZ", "WMT"
];

export const DEFAULT_UNIVERSE = Array.from(new Set([
  ...LOCAL_SP500_UNIVERSE,
  ...LOCAL_NASDAQ_100_UNIVERSE,
  ...LOCAL_DOW_30_UNIVERSE
]));

const SECTOR_PE: Record<string, number> = {
  Technology: 28,
  "Communication Services": 22,
  "Consumer Cyclical": 24,
  "Consumer Defensive": 22,
  Healthcare: 24,
  Financial: 14,
  Industrials: 20,
  Energy: 12,
  Utilities: 18,
  "Real Estate": 18,
  Materials: 16
};

export function uid(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function scoreLowerBetter(value: number | null, good: number, bad: number, missing = 45) {
  if (value === null || !Number.isFinite(value)) return missing;
  if (value <= good) return 100;
  if (value >= bad) return 0;
  return clamp(100 - ((value - good) / (bad - good)) * 100);
}

export function scoreHigherBetter(value: number | null, bad: number, good: number, missing = 45) {
  if (value === null || !Number.isFinite(value)) return missing;
  if (value >= good) return 100;
  if (value <= bad) return 0;
  return clamp(((value - bad) / (good - bad)) * 100);
}

export function money(value: number) {
  if (!Number.isFinite(value)) return "--";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function pct(value: number | null) {
  return value === null || !Number.isFinite(value) ? "--" : `${value.toFixed(1)}%`;
}

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function emptyStock(): StockRecord {
  return {
    id: uid("stock"),
    ticker: "",
    company_name: "",
    sector: "Technology",
    industry: "",
    current_price: 0,
    historical_close: null,
    target_buy_price: 0,
    market_cap: 0,
    pe_ratio: null,
    revenue_growth_pct: null,
    fcf_growth_pct: null,
    net_margin_pct: null,
    free_cash_flow: null,
    debt_to_equity: null,
    roe_pct: null,
    dividend_yield_pct: null,
    volatility_pct: null,
    drawdown_52w_pct: null,
    average_volume: null,
    shares_outstanding: null,
    price_to_sales: null,
    ev_to_ebitda: null,
    notes: "",
    source: "Manual",
    last_updated: nowIso()
  };
}

export function defaultAllocation(): AllocationPlan {
  return {
    to_stocks_pct: 40,
    to_cash_pct: 20,
    to_trading_account_pct: 30,
    to_personal_spending_pct: 10,
    trading_profit_amount: 0,
    portfolio_cash: 0,
    fmp_api_key: ""
  };
}

export function defaultDcfAssumptions(): DcfAssumptions {
  return {
    discount_rate_pct: 10,
    terminal_growth_pct: 2.5,
    projection_years: 5,
    base_fcf_growth_pct: 5
  };
}

export function defaultScenarioProbabilities(): ScenarioProbabilities {
  return { bear: 25, base: 50, bull: 25 };
}

export function scenarioProbabilitiesAreValid(probabilities: ScenarioProbabilities) {
  const values = [probabilities.bear, probabilities.base, probabilities.bull];
  return values.every((value) => Number.isFinite(value) && value >= 0 && value <= 100)
    && Math.abs(values.reduce((sum, value) => sum + value, 0) - 100) < 0.001;
}

export function missingData(stock: StockRecord) {
  const fields: Array<[keyof StockRecord, string]> = [
    ["current_price", "current price"],
    ["market_cap", "market cap"],
    ["pe_ratio", "PE ratio"],
    ["revenue_growth_pct", "revenue growth"],
    ["fcf_growth_pct", "FCF growth"],
    ["net_margin_pct", "net margin"],
    ["free_cash_flow", "free cash flow"],
    ["debt_to_equity", "debt to equity"],
    ["roe_pct", "ROE"],
    ["dividend_yield_pct", "dividend yield"],
    ["volatility_pct", "volatility"],
    ["drawdown_52w_pct", "52 week drawdown"]
  ];
  return fields.filter(([field]) => {
    const value = stock[field];
    return value === null || value === undefined || value === "" || Number(value) === 0 && field !== "dividend_yield_pct";
  }).map(([, label]) => label);
}

export function dataReliabilityScore(stock: StockRecord) {
  const checks = [
    stock.current_price > 0,
    stock.pe_ratio !== null && Number.isFinite(stock.pe_ratio),
    stock.free_cash_flow !== null && Number.isFinite(stock.free_cash_flow),
    stock.debt_to_equity !== null && Number.isFinite(stock.debt_to_equity),
    stock.revenue_growth_pct !== null && Number.isFinite(stock.revenue_growth_pct)
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function inferredFieldAudit(stock: StockRecord, field: string, rawValue: number | string | null, affectedScore = true): InvestmentFieldAudit {
  const stored = stock.field_audit?.[field];
  if (stored) return { ...stored, affectedScore };
  if (rawValue === null || rawValue === "" || typeof rawValue === "number" && !Number.isFinite(rawValue)) {
    return { rawValue: null, source: "missing", timestamp: stock.last_updated || "", affectedScore };
  }
  const source: InvestmentDataSource =
    stock.source.includes("Historical") ? "FMP historical EOD" :
      stock.source.includes("SEC EDGAR") ? "SEC EDGAR XBRL" :
      stock.source.includes("FMP") ? "cache" :
        stock.source.includes("Manual") ? "manual" :
          "fallback";
  return { rawValue, source, timestamp: stock.last_updated || "", affectedScore };
}

function derivedAudit(
  stock: StockRecord,
  fields: string[],
  rawValue: number | string | null,
  affectedScore = true
): InvestmentFieldAudit {
  if (rawValue === null || typeof rawValue === "number" && !Number.isFinite(rawValue)) {
    return { rawValue: null, source: "missing", timestamp: stock.last_updated || "", affectedScore };
  }
  const audits = fields.map((field) => {
    const value = (stock as unknown as Record<string, unknown>)[field];
    const normalized = typeof value === "number" || typeof value === "string" ? value : null;
    return inferredFieldAudit(stock, field, normalized, affectedScore);
  });
  const available = audits.filter((audit) => audit.source !== "missing" && audit.source !== "fallback");
  if (available.length !== audits.length) {
    return { rawValue, source: "fallback", timestamp: stock.last_updated || "", affectedScore };
  }
  const source = available.some((audit) => audit.source === "manual")
    ? "manual"
    : available.some((audit) => audit.source === "cache")
      ? "cache"
      : available[0].source;
  const timestamp = available.map((audit) => audit.timestamp).filter(Boolean).sort().at(-1) ?? stock.last_updated ?? "";
  return { rawValue, source, timestamp, affectedScore };
}

function isRealAuditSource(source: InvestmentDataSource) {
  return source !== "fallback" && source !== "missing";
}

function dcfInputAudit(stock: StockRecord, rawValue: number | string | null, affectedScore = true): InvestmentFieldAudit {
  if (rawValue === null || typeof rawValue === "number" && !Number.isFinite(rawValue)) {
    return { rawValue: null, source: "missing", timestamp: stock.last_updated || "", affectedScore };
  }
  const requiredAudits = [
    inferredFieldAudit(stock, "free_cash_flow", stock.free_cash_flow, affectedScore),
    inferredFieldAudit(stock, "current_price", stock.current_price, affectedScore)
  ];
  const hasDirectShares = stock.shares_outstanding !== null && Number.isFinite(stock.shares_outstanding) && stock.shares_outstanding > 0;
  const shareAudits = hasDirectShares
    ? [inferredFieldAudit(stock, "shares_outstanding", stock.shares_outstanding, affectedScore)]
    : [
        inferredFieldAudit(stock, "market_cap", stock.market_cap, affectedScore),
        inferredFieldAudit(stock, "current_price", stock.current_price, affectedScore)
      ];
  const audits = [...requiredAudits, ...shareAudits];
  const available = audits.filter((audit) => audit.source !== "missing" && audit.source !== "fallback");
  if (available.length !== audits.length) {
    return { rawValue, source: "fallback", timestamp: stock.last_updated || "", affectedScore };
  }
  const source = available.some((audit) => audit.source === "manual")
    ? "manual"
    : available.some((audit) => audit.source === "cache")
      ? "cache"
      : available[0].source;
  const timestamp = available.map((audit) => audit.timestamp).filter(Boolean).sort().at(-1) ?? stock.last_updated ?? "";
  return { rawValue, source, timestamp, affectedScore };
}

export function calculateDcfModel(
  stock: StockRecord,
  assumptions: DcfAssumptions = defaultDcfAssumptions(),
  options: {
    baseFcf?: number | null;
    growthPct?: number | null;
    discountRatePct?: number | null;
    terminalGrowthPct?: number | null;
    growthRangePct?: { min: number; max: number };
  } = {}
): DcfModelCalculation | null {
  const fcf = options.baseFcf ?? stock.free_cash_flow;
  const shares = stock.shares_outstanding || (stock.current_price > 0 && stock.market_cap > 0 ? stock.market_cap / stock.current_price : null);
  if (!fcf || fcf <= 0 || !shares || shares <= 0) return null;
  const growthPct = options.growthPct ?? stock.revenue_growth_pct ?? assumptions.base_fcf_growth_pct;
  const growthRange = options.growthRangePct ?? { min: -5, max: 25 };
  const growth = clamp(growthPct, growthRange.min, growthRange.max) / 100;
  const discountRatePct = options.discountRatePct ?? assumptions.discount_rate_pct;
  const discount = Math.max(0.01, discountRatePct / 100);
  const terminalGrowthPct = options.terminalGrowthPct ?? assumptions.terminal_growth_pct;
  const terminalGrowth = Math.min(Math.max(0, terminalGrowthPct / 100), discount - 0.005);
  const projectionYears = Math.round(clamp(assumptions.projection_years, 3, 15));
  let explicitCashFlowPresentValue = 0;
  let projectedFcf = fcf;
  for (let year = 1; year <= projectionYears; year += 1) {
    projectedFcf *= 1 + growth;
    explicitCashFlowPresentValue += projectedFcf / (1 + discount) ** year;
  }
  const terminalValue = (projectedFcf * (1 + terminalGrowth)) / (discount - terminalGrowth);
  const terminalPresentValue = terminalValue / (1 + discount) ** projectionYears;
  const equityValue = explicitCashFlowPresentValue + terminalPresentValue;
  const fairValue = equityValue / shares;
  if (!Number.isFinite(fairValue) || fairValue <= 0) return null;
  return {
    baseFcf: fcf,
    shares,
    growthPct: growth * 100,
    discountRatePct: discount * 100,
    terminalGrowthPct: terminalGrowth * 100,
    projectionYears,
    explicitCashFlowPresentValue,
    terminalValue,
    terminalPresentValue,
    equityValue,
    fairValue
  };
}

export function dcfFairValue(stock: StockRecord, assumptions: DcfAssumptions = defaultDcfAssumptions()) {
  const calculation = calculateDcfModel(stock, assumptions);
  if (!calculation) {
    return { fairValue: null, confidence: "Low" as const };
  }
  const confidence: "Medium" | "High" = stock.revenue_growth_pct !== null && stock.debt_to_equity !== null && stock.net_margin_pct !== null ? "High" : "Medium";
  return { fairValue: calculation.fairValue, confidence };
}

export function reverseDcfGrowth(stock: StockRecord, assumptions: DcfAssumptions = defaultDcfAssumptions(), baseFcf?: number | null) {
  return solveReverseDcfGrowth(stock, assumptions, baseFcf).impliedGrowthPct;
}

function reverseDcfLabel(impliedGrowthPct: number | null): ReverseDcfLabel {
  if (impliedGrowthPct === null || impliedGrowthPct > 35) return "Unrealistic expectation";
  if (impliedGrowthPct > 20) return "Very aggressive expectation";
  if (impliedGrowthPct > 10) return "Aggressive expectation";
  return "Reasonable expectation";
}

export function solveReverseDcfGrowth(
  stock: StockRecord,
  assumptions: DcfAssumptions = defaultDcfAssumptions(),
  baseFcf?: number | null,
  primaryFairValue?: number | null
): ReverseDcfResult {
  const targetPrice = stock.current_price;
  const baseGrowthPct = clamp(stock.revenue_growth_pct ?? assumptions.base_fcf_growth_pct, -5, 25);
  const selectedFcf = baseFcf ?? stock.free_cash_flow;
  const unavailable: ReverseDcfResult = {
    solved: false,
    targetPrice,
    primaryFairValue: primaryFairValue ?? null,
    impliedGrowthPct: null,
    baseGrowthPct,
    differencePct: null,
    label: "Unrealistic expectation",
    explanation: "Reverse DCF is unavailable because current price, FCF, or share count assumptions are missing."
  };
  if (!selectedFcf || selectedFcf <= 0 || !Number.isFinite(targetPrice) || targetPrice <= 0) return unavailable;

  const growthRangePct = { min: -20, max: 50 };
  const lowCalculation = calculateDcfModel(stock, assumptions, {
    baseFcf: selectedFcf,
    growthPct: growthRangePct.min,
    growthRangePct
  });
  const highCalculation = calculateDcfModel(stock, assumptions, {
    baseFcf: selectedFcf,
    growthPct: growthRangePct.max,
    growthRangePct
  });
  if (!lowCalculation || !highCalculation || targetPrice < lowCalculation.fairValue || targetPrice > highCalculation.fairValue) {
    return {
      ...unavailable,
      explanation: "Market price requires assumptions beyond current model range. Unrealistic under current assumptions: no annual FCF growth rate between -20% and 50% makes DCF fair value equal the current market price."
    };
  }

  let low = growthRangePct.min;
  let high = growthRangePct.max;
  for (let index = 0; index < 60; index += 1) {
    const growthPct = (low + high) / 2;
    const calculation = calculateDcfModel(stock, assumptions, {
      baseFcf: selectedFcf,
      growthPct,
      growthRangePct
    });
    if (!calculation) return unavailable;
    if (calculation.fairValue > targetPrice) high = growthPct;
    else low = growthPct;
  }
  const impliedGrowthPct = (low + high) / 2;
  const differencePct = impliedGrowthPct - baseGrowthPct;
  return {
    solved: true,
    targetPrice,
    primaryFairValue: primaryFairValue ?? null,
    impliedGrowthPct,
    baseGrowthPct,
    differencePct,
    label: reverseDcfLabel(impliedGrowthPct),
    explanation: `Market price requires FCF to grow about ${impliedGrowthPct.toFixed(1)}% per year for ${Math.round(clamp(assumptions.projection_years, 3, 15))} years.`
  };
}

function scenarioMetrics(
  name: ValuationScenario["name"],
  calculation: DcfModelCalculation | null,
  stock: StockRecord,
  fcfSource: string,
  marginExpansionPct = 0
): ValuationScenario {
  const fairValue = calculation?.fairValue ?? null;
  const currentPrice = stock.current_price;
  const upsideDownsidePct =
    fairValue !== null && currentPrice > 0
      ? ((fairValue / currentPrice) - 1) * 100
      : null;
  const impliedAnnualReturnPct =
    fairValue !== null && fairValue > 0 && currentPrice > 0 && calculation
      ? ((fairValue / currentPrice) ** (1 / calculation.projectionYears) - 1) * 100
      : null;
  return {
    name,
    fairValue,
    upsideDownsidePct,
    impliedAnnualReturnPct,
    baseFcf: calculation?.baseFcf ?? null,
    fcfSource,
    growthPct: calculation?.growthPct ?? 0,
    discountRatePct: calculation?.discountRatePct ?? 0,
    terminalGrowthPct: calculation?.terminalGrowthPct ?? 0,
    projectionYears: calculation?.projectionYears ?? 0,
    marginExpansionPct
  };
}

function scenarioDecisionLabel(
  currentPrice: number,
  bearFairValue: number | null,
  baseFairValue: number | null,
  bullFairValue: number | null,
  missingReasons: string[]
): ScenarioDecisionLabel {
  if (
    missingReasons.length ||
    !Number.isFinite(currentPrice) ||
    currentPrice <= 0 ||
    bearFairValue === null ||
    baseFairValue === null ||
    bullFairValue === null
  ) return "Insufficient Scenario Data";

  const bearBaseMidpoint = (bearFairValue + baseFairValue) / 2;
  if (currentPrice < bearFairValue * 0.85) return "Deep Value";
  if (currentPrice <= bearBaseMidpoint) return "Near Bear Case";
  if (currentPrice <= baseFairValue * 1.05) return "Near Base Case";
  if (currentPrice <= bullFairValue) return "Requires Bull Case";
  if (currentPrice <= bullFairValue * 1.25) return "Above Bull Case";
  return "Speculative Premium";
}

function scenarioExplanation(label: ScenarioDecisionLabel) {
  if (label === "Deep Value") return "Current price is materially below the Bear Case fair value.";
  if (label === "Near Bear Case") return "Current price is closest to the Bear Case and remains below the Base Case.";
  if (label === "Near Base Case") return "Current price is close to the Base Case fair value.";
  if (label === "Requires Bull Case") return "Current price is above Base Case but below Bull Case. The stock requires optimistic assumptions to be attractive.";
  if (label === "Above Bull Case") return "Current price is above the Bull Case fair value and already discounts assumptions beyond the modeled upside case.";
  if (label === "Speculative Premium") return "Current price is materially above the Bull Case fair value, creating a speculative valuation premium.";
  return "Scenario decision is unavailable because required price, cash flow, share count, historical, or reliability data is missing.";
}

export function buildScenarioValuation(
  stock: StockRecord,
  assumptions: DcfAssumptions,
  primaryDcf: DcfModelCalculation | null,
  latestFcf: number | null,
  normalizedFcf3y: number | null,
  requestedProbabilities: ScenarioProbabilities = defaultScenarioProbabilities()
): ScenarioValuationResult {
  const probabilitiesValid = scenarioProbabilitiesAreValid(requestedProbabilities);
  const probabilities = probabilitiesValid ? requestedProbabilities : defaultScenarioProbabilities();
  const derivedShares =
    stock.shares_outstanding && stock.shares_outstanding > 0
      ? stock.shares_outstanding
      : stock.current_price > 0 && stock.market_cap > 0
        ? stock.market_cap / stock.current_price
        : null;
  const missingReasons = [
    !Number.isFinite(stock.current_price) || stock.current_price <= 0 ? "missing price" : "",
    !(latestFcf && latestFcf > 0) && !(normalizedFcf3y && normalizedFcf3y > 0) ? "missing FCF" : "",
    normalizedFcf3y === null ? "missing historical data" : "",
    !derivedShares || derivedShares <= 0 ? "missing share count" : ""
  ].filter(Boolean);
  const primaryBaseFcf = primaryDcf?.baseFcf ?? latestFcf ?? normalizedFcf3y;
  const availableFcf = [latestFcf, normalizedFcf3y]
    .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);
  const bearBaseFcf = availableFcf.length ? Math.min(...availableFcf) : primaryBaseFcf;
  const normalizedBullFcf = normalizedFcf3y ?? primaryBaseFcf;
  const baseGrowthPct = primaryDcf?.growthPct ?? clamp(stock.revenue_growth_pct ?? assumptions.base_fcf_growth_pct, -5, 25);
  const bearGrowthPct = clamp(baseGrowthPct - 5, -5, 25);
  const bullGrowthPct = clamp(baseGrowthPct + 5, -5, 25);
  const bullMarginExpansionPct = 5;
  const bullBaseFcf =
    normalizedBullFcf !== null && normalizedBullFcf !== undefined && Number.isFinite(normalizedBullFcf)
      ? normalizedBullFcf * (1 + bullMarginExpansionPct / 100)
      : normalizedBullFcf;

  const bearCalculation = calculateDcfModel(stock, assumptions, {
    baseFcf: bearBaseFcf,
    growthPct: bearGrowthPct,
    discountRatePct: assumptions.discount_rate_pct + 2,
    terminalGrowthPct: Math.min(assumptions.terminal_growth_pct, 1.5)
  });
  const bullCalculation = calculateDcfModel(stock, assumptions, {
    baseFcf: bullBaseFcf,
    growthPct: bullGrowthPct,
    discountRatePct: Math.max(8, assumptions.discount_rate_pct - 1.5),
    terminalGrowthPct: Math.max(assumptions.terminal_growth_pct, 3)
  });

  const bear = scenarioMetrics(
    "Bear",
    bearCalculation,
    stock,
    bearBaseFcf === latestFcf ? "Latest FCF" : bearBaseFcf === normalizedFcf3y ? "3-year normalized FCF" : "Primary available FCF"
  );
  const base = scenarioMetrics(
    "Base",
    primaryDcf,
    stock,
    primaryDcf?.baseFcf === normalizedFcf3y ? "Primary normalized FCF" : "Primary latest FCF"
  );
  const bull = scenarioMetrics(
    "Bull",
    bullCalculation,
    stock,
    normalizedFcf3y !== null ? "3-year normalized FCF with 5% margin-expansion proxy" : "Primary FCF with 5% margin-expansion proxy",
    bullMarginExpansionPct
  );
  const allFairValuesAvailable = [bear.fairValue, base.fairValue, bull.fairValue]
    .every((value) => value !== null && Number.isFinite(value) && value > 0);
  if (!allFairValuesAvailable && !missingReasons.length) {
    missingReasons.push("insufficient real data");
  }
  const weightedFairValue =
    allFairValuesAvailable
      ? (bear.fairValue! * probabilities.bear / 100)
        + (base.fairValue! * probabilities.base / 100)
        + (bull.fairValue! * probabilities.bull / 100)
      : null;
  const currentPrice = stock.current_price;
  const weightedUpsideDownsidePct =
    weightedFairValue !== null && currentPrice > 0
      ? ((weightedFairValue / currentPrice) - 1) * 100
      : null;
  const projectionYears = base.projectionYears || Math.round(clamp(assumptions.projection_years, 3, 15));
  const expectedAnnualizedReturnPct =
    weightedFairValue !== null && weightedFairValue > 0 && currentPrice > 0
      ? ((weightedFairValue / currentPrice) ** (1 / projectionYears) - 1) * 100
      : null;
  const downsideRisk =
    bear.fairValue !== null && currentPrice > 0
      ? currentPrice - bear.fairValue
      : null;
  const downsideToBearPct =
    bear.fairValue !== null && currentPrice > 0
      ? ((bear.fairValue / currentPrice) - 1) * 100
      : null;
  const upsidePotential =
    bull.fairValue !== null && currentPrice > 0
      ? bull.fairValue - currentPrice
      : null;
  const upsideToBullPct =
    bull.fairValue !== null && currentPrice > 0
      ? ((bull.fairValue / currentPrice) - 1) * 100
      : null;
  const riskRewardRatio =
    downsideRisk !== null && downsideRisk > 0 && upsidePotential !== null && upsidePotential > 0
      ? upsidePotential / downsideRisk
      : null;
  const decisionLabel = scenarioDecisionLabel(currentPrice, bear.fairValue, base.fairValue, bull.fairValue, missingReasons);
  const riskRewardLabel: ScenarioRiskRewardLabel =
    decisionLabel === "Above Bull Case" || decisionLabel === "Speculative Premium"
      ? "Speculative Premium"
      : upsidePotential !== null && upsidePotential > 0 && downsideRisk !== null && downsideRisk <= 0
        ? "Attractive Risk/Reward"
        : riskRewardRatio !== null && riskRewardRatio >= 2
          ? "Attractive Risk/Reward"
          : riskRewardRatio !== null && riskRewardRatio >= 1
            ? "Balanced Risk/Reward"
            : "Poor Risk/Reward";
  return {
    bear,
    base,
    bull,
    probabilities,
    probabilitiesValid,
    weightedFairValue,
    weightedUpsideDownsidePct,
    expectedAnnualizedReturnPct,
    downsideRisk,
    downsideToBearPct,
    upsidePotential,
    upsideToBullPct,
    riskRewardRatio,
    riskRewardLabel,
    decisionLabel,
    missingReasons,
    explanation: scenarioExplanation(decisionLabel)
  };
}

export function valuation(
  stock: StockRecord,
  assumptions: DcfAssumptions = defaultDcfAssumptions(),
  context: ValuationContext = {}
): ValuationResult {
  const latestFcf = stock.free_cash_flow;
  const normalizedFcf3y =
    context.normalizedFcf3y !== null && context.normalizedFcf3y !== undefined && Number.isFinite(context.normalizedFcf3y) && context.normalizedFcf3y > 0
      ? context.normalizedFcf3y
      : null;
  const latestFcfDeviationPct =
    latestFcf !== null && Number.isFinite(latestFcf) && normalizedFcf3y !== null
      ? ((latestFcf - normalizedFcf3y) / normalizedFcf3y) * 100
      : null;
  const useNormalized =
    normalizedFcf3y !== null &&
    latestFcfDeviationPct !== null &&
    Math.abs(latestFcfDeviationPct) > 30;
  const growthPct = stock.revenue_growth_pct ?? assumptions.base_fcf_growth_pct;
  const conservativeDcf = calculateDcfModel(stock, assumptions, { baseFcf: latestFcf, growthPct });
  const normalizedDcf = normalizedFcf3y === null
    ? null
    : calculateDcfModel(stock, assumptions, { baseFcf: normalizedFcf3y, growthPct });
  const optimisticDcf = normalizedFcf3y === null
    ? null
    : calculateDcfModel(stock, assumptions, { baseFcf: normalizedFcf3y, growthPct: Math.min(25, growthPct + 3) });
  const primaryDcf = useNormalized ? normalizedDcf : conservativeDcf;
  const primaryDcfMode: ValuationResult["primaryDcfMode"] = useNormalized ? "Normalized" : "Conservative";
  const primaryDcfReason =
    useNormalized && latestFcfDeviationPct !== null
      ? `Primary mode: Normalized DCF because latest FCF is ${Math.abs(latestFcfDeviationPct).toFixed(1)}% ${latestFcfDeviationPct < 0 ? "below" : "above"} 3-year average.`
      : normalizedFcf3y === null
        ? "Primary mode: Conservative DCF because a 3-year FCF average is unavailable."
        : latestFcfDeviationPct === null
          ? "Primary mode: Conservative DCF because latest FCF cannot be compared with the 3-year average."
          : `Primary mode: Conservative DCF because latest FCF is within ${Math.abs(latestFcfDeviationPct).toFixed(1)}% of the 3-year average.`;
  const dcfFairValue = primaryDcf?.fairValue ?? null;
  const dcfConfidence: ValuationResult["dcfConfidence"] =
    dcfFairValue === null
      ? "Low"
      : stock.revenue_growth_pct !== null && stock.debt_to_equity !== null && stock.net_margin_pct !== null
        ? "High"
        : "Medium";
  const scenarioValuation = buildScenarioValuation(
    stock,
    assumptions,
    primaryDcf,
    latestFcf,
    normalizedFcf3y,
    context.scenarioProbabilities
  );
  const reverseDcf = solveReverseDcfGrowth(stock, assumptions, primaryDcf?.baseFcf, dcfFairValue);
  const impliedGrowthPct = reverseDcf.impliedGrowthPct;
  const sectorPe = SECTOR_PE[stock.sector] ?? 22;
  const peScore = scoreLowerBetter(stock.pe_ratio, sectorPe * 0.8, sectorPe * 1.6, 45);
  const priceToFcf = stock.free_cash_flow && stock.free_cash_flow > 0 && stock.market_cap > 0 ? stock.market_cap / stock.free_cash_flow : null;
  const fcfScore = scoreLowerBetter(priceToFcf, 18, 45, 45);
  const relativeScore = Math.round((peScore * 0.65) + (fcfScore * 0.35));
  const relativeClass: ValuationClass = stock.pe_ratio === null && priceToFcf === null ? "unknown" : relativeScore >= 70 ? "cheap" : relativeScore >= 45 ? "fair" : "expensive";
  const growthProxy = stock.revenue_growth_pct && stock.revenue_growth_pct > 0 ? stock.revenue_growth_pct : null;
  const pegRatio = stock.pe_ratio && growthProxy ? stock.pe_ratio / growthProxy : null;
  const pegClass: ValuationClass = pegRatio === null ? "unknown" : pegRatio <= 1.2 ? "cheap" : pegRatio <= 2 ? "fair" : "expensive";
  const values = [dcfFairValue, stock.target_buy_price > 0 ? stock.target_buy_price / 0.85 : null].filter((item): item is number => item !== null && Number.isFinite(item) && item > 0);
  const fairMid = values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : null;
  const fairValueLow = fairMid ? fairMid * 0.9 : null;
  const fairValueHigh = fairMid ? fairMid * 1.15 : null;
  const conservativeBuyPrice = fairValueLow ? fairValueLow * 0.82 : stock.target_buy_price || null;
  const modelCount = [dcfFairValue, impliedGrowthPct, relativeScore, pegRatio].filter((item) => item !== null && Number.isFinite(Number(item))).length;
  const dcfRelativeGapPct = dcfFairValue && stock.current_price > 0 ? ((dcfFairValue - stock.current_price) / stock.current_price) * 100 : null;
  const dcfClass: ValuationClass = dcfRelativeGapPct === null ? "unknown" : dcfRelativeGapPct >= 15 ? "cheap" : dcfRelativeGapPct <= -15 ? "expensive" : "fair";
  const valuationAgreement =
    dcfClass === "unknown" || relativeClass === "unknown"
      ? "Unknown"
      : dcfClass === relativeClass
        ? "Aligned"
        : (dcfClass === "cheap" && relativeClass === "expensive") || (dcfClass === "expensive" && relativeClass === "cheap")
          ? "Disagree"
          : "Mixed";
  return {
    dcfFairValue,
    dcfConfidence,
    dcfAssumptions: assumptions,
    primaryDcfMode,
    primaryDcfReason,
    latestFcf,
    normalizedFcf3y,
    latestFcfDeviationPct,
    conservativeDcfFairValue: conservativeDcf?.fairValue ?? null,
    normalizedDcfFairValue: normalizedDcf?.fairValue ?? null,
    optimisticDcfFairValue: optimisticDcf?.fairValue ?? null,
    scenarioValuation,
    reverseDcf,
    impliedGrowthPct,
    reverseDcfWarning: reverseDcf.explanation,
    relativeScore,
    relativeClass,
    pegRatio,
    pegClass,
    fairValueLow,
    fairValueHigh,
    conservativeBuyPrice,
    holdZoneLow: fairValueLow,
    holdZoneHigh: fairValueHigh,
    trimZonePrice: fairValueHigh ? fairValueHigh * 1.2 : null,
    confidenceScore: Math.round((modelCount / 4) * 100),
    valuationAgreement,
    dcfRelativeGapPct
  };
}

export function portfolioSummary(holdings: Holding[], cash: number): PortfolioSummary {
  const investedValue = holdings.reduce((sum, holding) => sum + holding.shares * holding.current_price, 0);
  const totalValue = investedValue + cash;
  const unrealizedPnl = holdings.reduce((sum, holding) => sum + holding.shares * (holding.current_price - holding.average_cost), 0);
  const sectorMap = new Map<string, number>();
  for (const holding of holdings) sectorMap.set(holding.sector, (sectorMap.get(holding.sector) ?? 0) + holding.shares * holding.current_price);
  const stockAllocation = holdings.map((holding) => {
    const value = holding.shares * holding.current_price;
    return { ticker: holding.ticker.toUpperCase(), value, allocationPct: totalValue ? (value / totalValue) * 100 : 0 };
  }).sort((a, b) => b.allocationPct - a.allocationPct);
  const sectorAllocation = [...sectorMap.entries()].map(([sector, value]) => ({ sector, value, allocationPct: totalValue ? (value / totalValue) * 100 : 0 })).sort((a, b) => b.allocationPct - a.allocationPct);
  const highRiskValue = holdings.filter((holding) => holding.risk_label === "High Risk" || holding.risk_label === "Speculative").reduce((sum, holding) => sum + holding.shares * holding.current_price, 0);
  const speculativeValue = holdings.filter((holding) => holding.risk_label === "Speculative").reduce((sum, holding) => sum + holding.shares * holding.current_price, 0);
  const cashAllocationPct = totalValue ? (cash / totalValue) * 100 : 0;
  const warnings = [
    ...stockAllocation.filter((row) => row.allocationPct > 15).map((row) => `${row.ticker} is above 15% allocation.`),
    ...sectorAllocation.filter((row) => row.allocationPct > 35).map((row) => `${row.sector} is above 35% sector allocation.`),
    totalValue && (highRiskValue / totalValue) * 100 > 25 ? "High risk stocks are above 25% of portfolio." : "",
    totalValue && (speculativeValue / totalValue) * 100 > 5 ? "Speculative stocks are above 5% of portfolio." : "",
    totalValue && cashAllocationPct < 10 ? "Cash allocation is below 10%." : "",
    stockAllocation.slice(0, 3).reduce((sum, row) => sum + row.allocationPct, 0) > 45 ? "Portfolio is concentrated in the top three holdings." : ""
  ].filter(Boolean);
  return {
    totalValue,
    investedValue,
    cash,
    cashAllocationPct,
    unrealizedPnl,
    stockAllocation,
    sectorAllocation,
    highRiskExposurePct: totalValue ? (highRiskValue / totalValue) * 100 : 0,
    speculativeExposurePct: totalValue ? (speculativeValue / totalValue) * 100 : 0,
    warnings
  };
}

export function riskLabel(stock: StockRecord, valuationRisk: "Low" | "Medium" | "High" | "Unknown", missingCount: number): RiskLabel {
  let risk = 0;
  risk += stock.volatility_pct !== null ? clamp(stock.volatility_pct, 0, 80) / 80 * 25 : 10;
  risk += stock.drawdown_52w_pct !== null ? clamp(Math.abs(stock.drawdown_52w_pct), 0, 70) / 70 * 20 : 8;
  risk += stock.debt_to_equity !== null ? clamp(stock.debt_to_equity, 0, 3) / 3 * 18 : 8;
  risk += (stock.net_margin_pct ?? 0) < 0 ? 15 : 0;
  risk += stock.market_cap < 10_000_000_000 ? 15 : stock.market_cap < 50_000_000_000 ? 6 : 0;
  risk += valuationRisk === "High" ? 12 : valuationRisk === "Medium" ? 5 : 0;
  risk += missingCount >= 5 ? 12 : missingCount >= 3 ? 6 : 0;
  if (risk >= 65) return "Speculative";
  if (risk >= 45) return "High Risk";
  if (risk >= 25) return "Medium Risk";
  return "Low Risk";
}

function recommendationConfidence(reliability: number, valuationAgreement: ValuationResult["valuationAgreement"], missingCount: number, fallbackPercent: number): RecommendationConfidence {
  if (fallbackPercent <= 30 && reliability >= 80 && missingCount <= 2 && (valuationAgreement === "Aligned" || valuationAgreement === "Mixed")) return "High";
  if (reliability >= 60 && missingCount <= 4 && valuationAgreement !== "Disagree") return "Medium";
  return "Low";
}

function reliabilityWarnings(stock: StockRecord, val: ValuationResult, reliability: number, fallbackPercent: number) {
  return [
    reliability < 60 ? "Recommendation is based mostly on missing or manual data." : "",
    fallbackPercent > 30 ? "Score unreliable due to missing data." : "",
    val.valuationAgreement === "Disagree" ? "DCF and relative valuation disagree strongly." : "",
    (stock.volatility_pct ?? 0) >= 45 ? "Stock is highly volatile." : "",
    val.fairValueHigh !== null && stock.current_price > val.fairValueHigh ? "Current price is above the fair value range." : ""
  ].filter(Boolean);
}

export function analyzeStock(
  stock: StockRecord,
  portfolio: PortfolioSummary,
  assumptions: DcfAssumptions = defaultDcfAssumptions(),
  valuationContext: ValuationContext = {}
): StockAnalysis {
  void portfolio;
  const missing = missingData(stock);
  const val = valuation(stock, assumptions, valuationContext);
  const marginOfSafetyPct = stock.current_price > 0 && stock.target_buy_price > 0 ? ((stock.target_buy_price - stock.current_price) / stock.current_price) * 100 : null;
  const valuationRisk: "Low" | "Medium" | "High" | "Unknown" =
    val.relativeClass === "unknown" ? "Unknown" : val.relativeClass === "expensive" || (marginOfSafetyPct !== null && marginOfSafetyPct < -10) ? "High" : marginOfSafetyPct !== null && marginOfSafetyPct < 5 ? "Medium" : "Low";
  const risk = riskLabel(stock, valuationRisk, missing.length);
  const roe = scoreHigherBetter(stock.roe_pct, 0, 25);
  const margin = scoreHigherBetter(stock.net_margin_pct, 0, 25);
  const revenueGrowth = scoreHigherBetter(stock.revenue_growth_pct, -5, 20);
  const fcfGrowth = scoreHigherBetter(stock.fcf_growth_pct, -10, 20);
  const debt = scoreLowerBetter(stock.debt_to_equity, 0.5, 2.5);
  const quality = Math.round((roe * 0.22) + (margin * 0.22) + (revenueGrowth * 0.2) + (fcfGrowth * 0.18) + (debt * 0.18));
  const dcfDiscount = val.dcfRelativeGapPct === null ? 45 : scoreHigherBetter(val.dcfRelativeGapPct, -20, 25, 45);
  const peg = val.pegClass === "cheap" ? 90 : val.pegClass === "fair" ? 65 : val.pegClass === "expensive" ? 25 : 45;
  const peVsIndustry = scoreLowerBetter(stock.pe_ratio, (SECTOR_PE[stock.sector] ?? 22) * 0.8, (SECTOR_PE[stock.sector] ?? 22) * 1.6, 45);
  const valuationScore = Math.round((dcfDiscount * 0.4) + (peg * 0.3) + (peVsIndustry * 0.3));
  const volatility = scoreLowerBetter(stock.volatility_pct, 18, 55);
  const drawdown = scoreLowerBetter(Math.abs(stock.drawdown_52w_pct ?? NaN), 15, 60);
  const debtRisk = scoreLowerBetter(stock.debt_to_equity, 0.5, 2.5);
  const riskScore = Math.round((volatility * 0.34) + (drawdown * 0.33) + (debtRisk * 0.33));
  const baseScore = Math.round((quality * 0.4) + (valuationScore * 0.35) + (riskScore * 0.25));
  const breakdown = { quality, valuation: valuationScore, risk: riskScore, roe, margin, revenueGrowth, fcfGrowth, debt, dcfDiscount, peg, peVsIndustry, volatility, drawdown, debtRisk };

  const componentAudit: ScoreComponentAudit[] = [
    { key: "roe", label: "ROE", score: roe, finalWeightPct: 8.8, ...inferredFieldAudit(stock, "roe_pct", stock.roe_pct) },
    { key: "margin", label: "Margin", score: margin, finalWeightPct: 8.8, ...inferredFieldAudit(stock, "net_margin_pct", stock.net_margin_pct) },
    { key: "revenueGrowth", label: "Revenue Growth", score: revenueGrowth, finalWeightPct: 8, ...inferredFieldAudit(stock, "revenue_growth_pct", stock.revenue_growth_pct) },
    { key: "fcfGrowth", label: "FCF Growth", score: fcfGrowth, finalWeightPct: 7.2, ...inferredFieldAudit(stock, "fcf_growth_pct", stock.fcf_growth_pct) },
    { key: "debt", label: "Debt", score: debt, finalWeightPct: 7.2, ...inferredFieldAudit(stock, "debt_to_equity", stock.debt_to_equity) },
    { key: "dcfDiscount", label: "DCF Discount", score: dcfDiscount, finalWeightPct: 14, ...dcfInputAudit(stock, val.dcfRelativeGapPct) },
    { key: "peg", label: "PEG", score: peg, finalWeightPct: 10.5, ...derivedAudit(stock, ["pe_ratio", "revenue_growth_pct"], val.pegRatio) },
    { key: "peVsIndustry", label: "PE vs Industry", score: peVsIndustry, finalWeightPct: 10.5, ...derivedAudit(stock, ["pe_ratio"], stock.pe_ratio) },
    { key: "volatility", label: "Volatility", score: volatility, finalWeightPct: 8.5, ...inferredFieldAudit(stock, "volatility_pct", stock.volatility_pct) },
    { key: "drawdown", label: "Drawdown", score: drawdown, finalWeightPct: 8.25, ...inferredFieldAudit(stock, "drawdown_52w_pct", stock.drawdown_52w_pct) },
    { key: "debtRisk", label: "Debt Risk", score: debtRisk, finalWeightPct: 8.25, ...inferredFieldAudit(stock, "debt_to_equity", stock.debt_to_equity) }
  ];
  const realDataPercent = Math.round(componentAudit.filter((item) => isRealAuditSource(item.source)).reduce((sum, item) => sum + item.finalWeightPct, 0));
  const fallbackPercent = Math.max(0, 100 - realDataPercent);
  const reliability = realDataPercent;
  const scoreReliable = fallbackPercent <= 30;
  const dataTooIncomplete = fallbackPercent > 50;
  if (dataTooIncomplete && !val.scenarioValuation.missingReasons.includes("insufficient real data")) {
    val.scenarioValuation = {
      ...val.scenarioValuation,
      decisionLabel: "Insufficient Scenario Data",
      riskRewardLabel: "Poor Risk/Reward",
      missingReasons: [...val.scenarioValuation.missingReasons, "insufficient real data"],
      explanation: "Scenario decision is unavailable because too much of the supporting stock data is missing or fallback-based."
    };
  }
  const fallbackPenalty = Math.round(Math.max(0, fallbackPercent - 30) * 0.4);
  const totalScore = Math.max(0, baseScore - fallbackPenalty);
  const negativeSignal = scoreReliable && (totalScore < 45 || risk === "Speculative" || (risk === "High Risk" && quality < 60));
  let recommendation: RecommendationLabel = "Watchlist";
  if (dataTooIncomplete) recommendation = "Insufficient Data";
  else if (negativeSignal) recommendation = "Avoid";
  else if (quality >= 72 && valuationScore < 55) recommendation = "Wait for Better Price";
  else if (totalScore >= 82 && quality >= 75 && valuationScore >= 70 && (risk === "Low Risk" || risk === "Medium Risk")) recommendation = "Strong Buy Candidate";
  else if (totalScore >= 70 && quality >= 65 && valuationScore >= 60) recommendation = "Buy Candidate";
  const biggestRisk =
    risk === "Speculative" ? "Speculative risk from volatility, drawdown, debt, or missing data." :
      valuationRisk === "High" ? "Valuation risk: price may already discount optimistic assumptions." :
        (stock.debt_to_equity ?? 0) > 2 ? "Balance sheet risk from elevated debt to equity." :
          (stock.volatility_pct ?? 0) > 45 ? "Volatility risk is elevated." :
            "Main risk is model uncertainty and incomplete forward-looking data.";
  const reasons = [
    `Quality ${quality}/100, valuation ${valuationScore}/100, risk ${risk}.`,
    val.conservativeBuyPrice ? `Research buy zone starts near ${money(val.conservativeBuyPrice)}.` : "DCF buy zone needs free cash flow and shares data.",
    recommendation === "Wait for Better Price" ? "Company quality is better than the current valuation setup." : `Recommendation is ${recommendation}.`
  ];
  const positionSizeRange = risk === "Low Risk" ? "Research-only: 5-10%" : risk === "Medium Risk" ? "Research-only: 2-5%" : risk === "High Risk" ? "Research-only: 0-2%" : "Research-only: 0-1%";
  const confidence = recommendationConfidence(reliability, val.valuationAgreement, missing.length, fallbackPercent);
  return {
    stock,
    baseScore,
    fallbackPenalty,
    totalScore,
    breakdown,
    riskLabel: risk,
    recommendation,
    valuation: val,
    marginOfSafetyPct,
    valuationRisk,
    betterBuyPrice: val.conservativeBuyPrice ?? (stock.target_buy_price || null),
    reasons,
    biggestRisk,
    missingData: missing,
    positionSizeRange,
    dataReliabilityScore: reliability,
    recommendationConfidence: confidence,
    warnings: reliabilityWarnings(stock, val, reliability, fallbackPercent),
    componentAudit,
    realDataPercent,
    fallbackPercent,
    scoreReliable
  };
}

export function broadScanCandidates(
  stocks: StockRecord[],
  portfolio: PortfolioSummary,
  assumptions: DcfAssumptions = defaultDcfAssumptions(),
  normalizedFcfByTicker: ReadonlyMap<string, number | null> = new Map(),
  scenarioProbabilities: ScenarioProbabilities = defaultScenarioProbabilities()
) {
  return stocks
    .filter((stock) => stock.market_cap >= 10_000_000_000 || stock.market_cap === 0)
    .filter((stock) => stock.current_price >= 5 || stock.current_price === 0)
    .filter((stock) => stock.pe_ratio === null || (stock.pe_ratio > 0 && stock.pe_ratio < 90))
    .filter((stock) => stock.volatility_pct === null || stock.volatility_pct < 80)
    .filter((stock) => stock.drawdown_52w_pct === null || Math.abs(stock.drawdown_52w_pct) < 75)
    .map((stock) => analyzeStock(stock, portfolio, assumptions, {
      normalizedFcf3y: normalizedFcfByTicker.get(stock.ticker.toUpperCase()) ?? null,
      scenarioProbabilities
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 100);
}
