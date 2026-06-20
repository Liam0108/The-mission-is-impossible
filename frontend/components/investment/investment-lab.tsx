"use client";

import { type ChangeEvent, FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  ChevronDown,
  CircleDollarSign,
  DatabaseZap,
  DownloadCloud,
  GitBranch,
  LayoutDashboard,
  Plus,
  RefreshCcw,
  ScanSearch,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  UploadCloud,
  WalletCards
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CollapsiblePanel,
  DashboardCard,
  DataTableWrapper,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  SectionHeader,
  StatusBadge
} from "@/components/ui/dashboard";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE } from "@/lib/api";
import { getStoredLanguage, type Language } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  ALLOCATION_KEY,
  ASSUMPTIONS_KEY,
  CACHE_KEY,
  DEFAULT_UNIVERSE,
  HOLDINGS_KEY,
  LOCAL_DOW_30_UNIVERSE,
  LOCAL_NASDAQ_100_UNIVERSE,
  LOCAL_SP500_UNIVERSE,
  SCENARIO_PROBABILITIES_KEY,
  STOCKS_KEY,
  WATCHLIST_KEY,
  analyzeStock,
  broadScanCandidates,
  calculateDcfModel,
  defaultAllocation,
  defaultDcfAssumptions,
  defaultScenarioProbabilities,
  emptyStock,
  money,
  nowIso,
  pct,
  portfolioSummary,
  readJson,
  scenarioProbabilitiesAreValid,
  uid,
  writeJson,
  type AllocationPlan,
  type DcfAssumptions,
  type Holding,
  type InvestmentDataSource,
  type InvestmentFieldAudit,
  type RecommendationLabel,
  type RiskLabel,
  type ScenarioProbabilities,
  type StockAnalysis,
  type StockRecord,
  type WatchlistItem
} from "@/lib/investment-engine";
import {
  createLocalBackup,
  downloadLocalBackup,
  parseLocalBackupJson,
  restoreLocalBackup,
  summarizeLocalBackup,
  type LocalDataBackup
} from "@/lib/local-backup";
import { STAGE1_FMP_SYMBOL_LIMIT, fmpSingleSymbolEndpoint, stage1FmpTickers } from "@/lib/investment-scanner";

const SECTORS = [
  "Technology",
  "Communication Services",
  "Consumer Cyclical",
  "Consumer Defensive",
  "Healthcare",
  "Financial",
  "Industrials",
  "Energy",
  "Utilities",
  "Real Estate",
  "Materials",
  "Unknown"
];

const RISK_LABELS: RiskLabel[] = ["Low Risk", "Medium Risk", "High Risk", "Speculative"];
const BACKEND_OFFLINE_MESSAGE = "Backend is offline. SEC EDGAR and experimental Yahoo data are unavailable.";
const FMP_STABLE_BASE = "https://financialmodelingprep.com/stable";
const FMP_AUDIT_TICKERS = ["AAPL", "MSFT", "NVDA", "GOOGL"];
const REVERSE_DCF_AUDIT_TICKERS = ["AMZN", "NVDA", "MSFT", "META", "GOOGL", "AAPL"];
const FMP_MAPPING_COMPARISON_KEY = "fabio-investment-fmp-mapping-comparison-v1";
const SCAN_PRIORITY_SETTINGS_KEY = "fabio-investment-scan-priority-v1";
const SCAN_ROI_HISTORY_KEY = "fabio-investment-scan-roi-v1";
const INVESTMENT_TAB_KEY = "fabio-investment-active-tab-v1";
const INVESTMENT_TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "scanner", label: "Stock Scanner", icon: ScanSearch },
  { id: "valuation", label: "Valuation Lab", icon: CircleDollarSign },
  { id: "scenario", label: "Scenario Decision", icon: GitBranch },
  { id: "portfolio", label: "Portfolio Builder", icon: WalletCards },
  { id: "coverage", label: "Data Coverage", icon: DatabaseZap },
  { id: "diagnostics", label: "Diagnostics", icon: SlidersHorizontal }
] as const;
type InvestmentTab = (typeof INVESTMENT_TABS)[number]["id"];
const SCAN_PRIORITY_MODES = [
  "Make Valid Fastest",
  "Complete SEC-FCF Stocks First",
  "Largest Market Cap",
  "Highest Existing Data Coverage",
  "Watchlist First",
  "Technology / AI First",
  "Semiconductor First",
  "Energy First",
  "Financials First",
  "Lowest Valuation First",
  "Highest Quality First",
  "Manual Custom Order"
] as const;
const SCAN_PRIORITY_SECTORS = [
  "Technology",
  "Communication Services",
  "Consumer Discretionary",
  "Financials",
  "Healthcare",
  "Energy",
  "Industrials",
  "Semiconductors / AI"
] as const;
const FMP_AUDIT_FIELDS = [
  { key: "current_price", label: "price" },
  { key: "market_cap", label: "marketCap" },
  { key: "pe_ratio", label: "PE" },
  { key: "roe_pct", label: "ROE" },
  { key: "net_margin_pct", label: "net margin" },
  { key: "revenue_growth_pct", label: "revenue growth" },
  { key: "free_cash_flow", label: "free cash flow" },
  { key: "debt_to_equity", label: "debt/equity" },
  { key: "dividend_yield_pct", label: "dividend yield" },
  { key: "historical_close", label: "historical close" },
  { key: "drawdown_52w_pct", label: "drawdown" },
  { key: "volatility_pct", label: "volatility" }
] as const;
type FmpInspectorEndpointId = "profile" | "ratios" | "income" | "historical";
type FmpInspectorEndpointDefinition = {
  id: FmpInspectorEndpointId;
  label: string;
  path: string;
  mappedKeys: Record<string, string>;
};
type FmpRawPayloadView = {
  id: FmpInspectorEndpointId;
  label: string;
  cacheKey: string;
  cacheDate: string;
  records: Record<string, unknown>[];
  keys: string[];
  mappedFields: string[];
  unmappedFields: string[];
  snippet: string;
};
type FmpMetricDiagnostic = {
  label: string;
  stockField: keyof StockRecord;
  sourceKey: string;
  sourceEndpoint: string;
  found: boolean;
  mappingRule: boolean;
  stored: boolean;
  rawValue: number | string | null;
  mappedValue: number | string | null;
};
type FmpMappingSnapshot = {
  peRatio: number | null;
  revenueGrowth: number | null;
  dividendYield: number | null;
  historicalClose: number | null;
  peVsIndustry: number | null;
  peg: number | null;
  revenueGrowthScore: number | null;
  realDataPercent: number | null;
  fallbackPercent: number | null;
};
type FmpMappingComparisonRow = {
  ticker: string;
  before: FmpMappingSnapshot;
  after: FmpMappingSnapshot;
  fixedFields: string[];
};
type RankingAuditRow = {
  section: string;
  rank: number;
  stock: string;
  sortMetric: string;
  metricValue: string;
  rankSource: string;
};
type FcfHistoryRow = {
  fiscalYear: string;
  date: string;
  freeCashFlow: number;
  capitalExpenditure: number | null;
  operatingCashFlow: number | null;
  cacheDate: string;
  source: "FMP cashFlow" | "SEC EDGAR";
  operatingConcept?: string;
  capexConcept?: string;
  capexSignAdjusted?: boolean;
  capexSignNote?: string;
};
type SecAnnualPeriod = {
  fiscal_year: string;
  start: string;
  end: string;
  filed: string;
  form: string;
  operating_cash_flow: number;
  operating_cash_flow_concept: string;
  capex_raw: number;
  capex: number;
  capex_concept: string;
  capex_sign_adjusted: boolean;
  capex_sign_note: string;
  free_cash_flow: number;
};
type SecCashFlowResult = {
  ticker: string;
  cik?: string;
  company_name?: string;
  status: "success" | "missing" | "error";
  error?: string;
  latest_fcf?: number | null;
  average_fcf_3y?: number | null;
  average_fcf_5y?: number | null;
  revenue_growth_pct?: number | null;
  net_margin_pct?: number | null;
  roe_pct?: number | null;
  debt_to_equity?: number | null;
  shares_outstanding?: number | null;
  fundamental_status?: "success" | "missing";
  fundamental_error?: string;
  sec_fundamental_concepts?: Record<string, string>;
  sec_fundamental_periods?: Record<string, Array<string | number | null>>;
  latest_operating_cash_flow?: number | null;
  latest_capex?: number | null;
  operating_cash_flow_concept?: string;
  capex_concept?: string;
  operating_cash_flow_concepts_found?: string[];
  capex_concepts_found?: string[];
  fiscal_periods_used?: string[];
  annual_periods: SecAnnualPeriod[];
  confidence?: "High" | "Medium" | "Low";
  source?: "SEC EDGAR XBRL";
  extracted_at?: string;
  from_cache?: boolean;
};
type SecCashFlowResponse = {
  source: "SEC EDGAR XBRL";
  requested_symbols: string[];
  ticker_map_cache_hit?: boolean;
  results: SecCashFlowResult[];
  requests_made: number;
  cache_hits: number;
  successes: number;
  failures: number;
  rate_limit_seconds?: number;
  fetched_at?: string;
  local_cache_fallback?: boolean;
};
type SecCoverageStats = {
  requestsMade: number;
  cacheHits: number;
  extractionSuccesses: number;
  extractionFailures: number;
  stocksMadeValid: number;
  lastRunAt: string;
  lastRunSymbols: string[];
};
type CoverageManualField = "shares_outstanding" | "free_cash_flow" | "current_price" | "revenue_growth_pct";
type CoverageManualDraft = Partial<Record<CoverageManualField, number | null>>;
type ScanPriorityMode = typeof SCAN_PRIORITY_MODES[number];
type ScanPrioritySector = typeof SCAN_PRIORITY_SECTORS[number];
type ScanPriorityWeights = {
  marketCap: number;
  dataCoverage: number;
  watchlist: number;
  sectorPreference: number;
  missingFields: number;
  quality: number;
  valuation: number;
  risk: number;
};
type ScanPrioritySettings = {
  mode: ScanPriorityMode;
  weights: ScanPriorityWeights;
  preferredSectors: ScanPrioritySector[];
  manualTickers: string;
};
type CoverageRow = {
  analysis: StockAnalysis;
  reasons: string[];
  endpointIds: FmpCapabilityId[];
  endpointNeeds: CoverageEndpointNeed[];
  priorityScore: number;
  priorityReason: string;
  estimatedChancePct: number;
  blockingReason: string;
  scannable: boolean;
  blockedFromValidity: boolean;
  requiresSecFallback: boolean;
  secFcfAvailable: boolean;
  secFcfStatus: SecCashFlowResult["status"] | "unknown";
  estimatedAvailableCalls: number;
  hybridChecklist: HybridValidityChecklist;
  financialSectorWarning: boolean;
};
type HybridFieldStatus = {
  available: boolean;
  source: string;
};
type HybridValidityChecklist = {
  price: HybridFieldStatus;
  shares: HybridFieldStatus;
  incomeStatement: HybridFieldStatus;
  historicalEod: HybridFieldStatus;
  fcf: HybridFieldStatus;
  scenarioValid: boolean;
};
type CoverageEndpointStatus = "available" | "blocked by plan" | "unknown";
type CoverageEndpointNeed = {
  id: FmpCapabilityId;
  status: CoverageEndpointStatus;
};
type CoverageScanEndpointPlan = {
  id: FmpCapabilityId;
  status:
    | "valid cache hit"
    | "empty cache"
    | "failed cache"
    | "needs refetch"
    | "capability test + request"
    | "blocked by plan"
    | "unavailable";
  estimatedCalls: number;
  cacheCategory?: FmpCacheCategory | "missing";
};
type CoverageScanLikelihood = "High" | "Medium" | "Low";
type CoverageScanPreviewRow = {
  ticker: string;
  priorityScore: number;
  priorityReason: string;
  estimatedChancePct: number;
  blockingReason: string;
  missingEndpoints: CoverageScanEndpointPlan[];
  estimatedCalls: number;
  secFcfAvailable: boolean;
  likelihood: CoverageScanLikelihood;
  likelihoodReason: string;
};
type CoverageScanPreview = {
  batchSize: number;
  priorityMode: ScanPriorityMode;
  selectedSymbols: string[];
  rows: CoverageScanPreviewRow[];
  capabilityTestIds: FmpCapabilityId[];
  estimatedCalls: number;
  safeRemaining: number;
  isSafe: boolean;
  likelyValidSymbols: string[];
  createdAt: string;
};
type ScanRoiBatch = {
  id: string;
  batchTime: string;
  localDate: string;
  priorityMode: ScanPriorityMode;
  symbolsScanned: string[];
  estimatedCalls: number;
  actualCallsUsed: number;
  successfulEndpoints: number;
  failedEndpoints: number;
  premiumBlockedEndpoints: number;
  callsWastedOnBlockedEndpoints: number;
  callsAddedFields: number;
  callsNoUsableData: number;
  endpointRoi: Record<FmpCapabilityId, EndpointRoiStats>;
  stocksValidBefore: number;
  stocksValidAfter: number;
  newValidStocksGained: number;
  newValidSymbols: string[];
  callsPerNewValidStock: number | null;
  hybridCompletedSymbols?: string[];
  secFcfSymbols?: string[];
  remainingMissingFields?: Record<string, string[]>;
};
type ScanRoiSummary = {
  batches: number;
  calls: number;
  successfulEndpoints: number;
  failedEndpoints: number;
  premiumBlockedEndpoints: number;
  newValidStocks: number;
  callsPerNewValidStock: number | null;
  validStocksPerCall: number;
};
type EndpointRoiStats = {
  calls: number;
  successfulCalls: number;
  failedCalls: number;
  premiumBlockedCalls: number;
  callsAddedFields: number;
  callsNoUsableData: number;
};

const FMP_INSPECTOR_ENDPOINTS: FmpInspectorEndpointDefinition[] = [
  {
    id: "profile",
    label: "Profile",
    path: "profile",
    mappedKeys: {
      companyName: "company_name",
      name: "company_name",
      sector: "sector",
      industry: "industry",
      price: "current_price",
      marketCap: "market_cap",
      mktCap: "market_cap",
      sharesOutstanding: "shares_outstanding",
      pe: "pe_ratio",
      peRatio: "pe_ratio",
      trailingPE: "pe_ratio"
    }
  },
  {
    id: "ratios",
    label: "Ratios",
    path: "ratios-ttm",
    mappedKeys: {
      peRatioTTM: "pe_ratio",
      priceToEarningsRatioTTM: "pe_ratio",
      returnOnEquityTTM: "roe_pct",
      dividendYieldTTM: "dividend_yield_pct",
      dividendYielTTM: "dividend_yield_pct",
      debtEquityRatioTTM: "debt_to_equity",
      debtToEquityRatioTTM: "debt_to_equity",
      priceToSalesRatioTTM: "price_to_sales",
      enterpriseValueMultipleTTM: "ev_to_ebitda",
      revenueGrowthTTM: "revenue_growth_pct",
      netProfitMarginTTM: "net_margin_pct"
    }
  },
  {
    id: "income",
    label: "Income Statement",
    path: "income-statement",
    mappedKeys: {
      revenue: "revenue_growth_pct (derived from two periods)",
      netIncome: "net_margin_pct (derived with revenue)"
    }
  },
  {
    id: "historical",
    label: "Historical EOD",
    path: "historical-price-eod/full",
    mappedKeys: {
      date: "historical ordering",
      close: "current_price, historical_close, volatility_pct",
      high: "drawdown_52w_pct"
    }
  }
];
const UNIVERSE_DIAGNOSTICS = {
  sp500: LOCAL_SP500_UNIVERSE.length,
  nasdaq100: LOCAL_NASDAQ_100_UNIVERSE.length,
  dow30: LOCAL_DOW_30_UNIVERSE.length,
  total: DEFAULT_UNIVERSE.length
};

type FmpEndpoint = {
  path: string;
  params?: Record<string, string | number | boolean | null | undefined>;
};

type FmpCapabilityId = "quote" | "profile" | "ratios" | "income" | "cashFlow" | "historical";
type FmpCapabilityStatus = "untested" | "available" | "premium blocked" | "error";
type FmpCapabilityResult = {
  id: FmpCapabilityId;
  label: string;
  status: FmpCapabilityStatus;
  httpStatus?: number | null;
  preview: string;
  testedAt?: string;
};

type FmpCapabilityDefinition = {
  id: FmpCapabilityId;
  label: string;
  endpoint: FmpEndpoint;
};
type FmpAttemptStats = {
  success: number;
  premiumBlocked: number;
  unauthorized: number;
  rateLimited: number;
  networkErrors: number;
  otherErrors: number;
};
type FmpPremiumBlockMemory = {
  endpointId: FmpCapabilityId;
  firstBlockedAt: string;
  lastBlockedAt: string;
  httpStatus: number;
  message: string;
};
type FmpCacheEntry = {
  date: string;
  data: unknown;
  status?: "success" | "failed" | "premium blocked";
  httpStatus?: number | null;
  error?: string;
  timestamp?: string;
};
type FmpCacheCategory =
  | "valid data cache"
  | "empty cache"
  | "failed cache"
  | "premium blocked cache"
  | "stale cache";
type FmpCacheAuditRow = {
  cacheKey: string;
  capabilityId: FmpCapabilityId | null;
  symbols: string[];
  category: FmpCacheCategory;
  date: string;
  reason: string;
};
type FmpCacheRepairSummary = {
  repairedAt: string;
  action: "empty" | "failed" | "empty and failed";
  emptyCachesFound: number;
  failedCachesFound: number;
  cachesCleared: number;
  symbolsAffected: string[];
  endpointsAffected: string[];
  nextRecommendedBatch: string[];
};

const FMP_CAPABILITY_DEFINITIONS: FmpCapabilityDefinition[] = [
  { id: "quote", label: "quote AAPL", endpoint: { path: "quote", params: { symbol: "AAPL" } } },
  { id: "profile", label: "profile AAPL", endpoint: { path: "profile", params: { symbol: "AAPL" } } },
  { id: "ratios", label: "ratios TTM AAPL", endpoint: { path: "ratios-ttm", params: { symbol: "AAPL" } } },
  { id: "income", label: "income statement AAPL", endpoint: { path: "income-statement", params: { symbol: "AAPL" } } },
  { id: "cashFlow", label: "cash flow statement AAPL", endpoint: { path: "cash-flow-statement", params: { symbol: "AAPL" } } },
  { id: "historical", label: "historical EOD AAPL", endpoint: { path: "historical-price-eod/full", params: { symbol: "AAPL" } } }
];

type InvestmentCache = {
  yahoo?: Record<string, { date: string; data: Partial<StockRecord> }>;
  fmp?: Record<string, FmpCacheEntry>;
  fmpCapabilities?: Partial<Record<FmpCapabilityId, FmpCapabilityResult>>;
  fmpPremiumBlocked?: Partial<Record<FmpCapabilityId, FmpPremiumBlockMemory>>;
  fmpUsageDate?: string;
  fmpCalls?: number;
  fmpAttemptStats?: FmpAttemptStats;
  officialFmpUsageDate?: string;
  officialFmpUsed?: number;
  officialFmpLimit?: number;
  fmpSafetyBuffer?: number;
  secTickerCik?: Record<string, { cik: string; companyName: string; timestamp: string }>;
  secCashFlow?: Record<string, { date: string; timestamp: string; data: SecCashFlowResult }>;
  secCoverageStats?: SecCoverageStats;
};

const copy = {
  en: {
    title: "Investment Lab",
    eyebrow: "Research-only stock screening",
    subtitle: "Screen long-term stock candidates with valuation, quality, risk, and portfolio-fit rules. No brokerage connection. No order placement.",
    stockInput: "Stock Input / Watchlist",
    scanner: "Two-Stage Stock Scanner",
    portfolio: "Portfolio Diversification",
    allocation: "Profit Allocation Plan",
    rankings: "Ranking Views",
    watchlist: "Watchlist",
    addStock: "Save Stock",
    runYahoo: "Run Free/Local Stage 1",
    runFmp: "Run Stage 2 FMP Deep Scan",
    localOnly: "Using Free Plan Compatible Mode. Stage 1 always starts from the local S&P 500, Nasdaq 100, and Dow 30 universe. FMP enriches only endpoints your plan allows. Yahoo is experimental fallback only.",
    researchOnly: "Research-only. This is not financial advice and does not guarantee outcomes.",
    stale: "Data may be stale. Refresh scanner or update fields manually.",
    noKey: "FMP API key is optional. Without it, V1 loads the local universe only. Enter metrics manually; data reliability stays Low until key fields are filled.",
    topRecommended: "Top 20 Recommended",
    reliableCandidates: "Reliable Candidates",
    incompleteCandidates: "Incomplete Data Candidates",
    bestValue: "Best Value",
    highestQuality: "Highest Quality",
    lowestRisk: "Lowest Risk",
    highestRisk: "Highest Risk",
    avoidList: "Avoid List",
    waitList: "Wait for Better Price",
    warnings: "Portfolio Warnings",
    noWarnings: "No major portfolio-rule warnings.",
    dataSource: "Data Source",
    cacheStatus: "Cache Status",
    lastUpdated: "Last Updated",
    missingData: "Missing Data",
    biggestRisk: "Biggest Risk",
    betterPrice: "Better Buy Price",
    positionSize: "Position Size Range",
    fairValue: "Fair Value Range",
    conservativeBuy: "Conservative Buy Price",
    holdZone: "Hold Zone",
    trimZone: "Overvalued / Trim Zone"
  },
  zh: {
    title: "投资实验室",
    eyebrow: "仅用于研究的股票筛选",
    subtitle: "用估值、公司质量、风险和组合适配度筛选长期投资候选。没有券商连接，不会下单。",
    stockInput: "股票输入 / 观察名单",
    scanner: "两阶段股票扫描器",
    portfolio: "投资组合分散度",
    allocation: "利润分配计划",
    rankings: "排名视图",
    watchlist: "观察名单",
    addStock: "保存股票",
    runYahoo: "加载本地股票池",
    runFmp: "运行第二阶段 FMP 深度扫描",
    localOnly: "Using Free Plan Compatible Mode。第一阶段始终从本地 S&P 500、Nasdaq 100 和 Dow 30 股票池开始。FMP 只补全当前订阅允许的端点。Yahoo 只作为实验性备用。",
    researchOnly: "仅供研究，不是投资建议，也不保证结果。",
    stale: "数据可能过期。请刷新扫描或手动更新字段。",
    noKey: "FMP API key 是可选项。没有 key 时，V1 只加载本地股票池。你可以手动输入指标；关键字段补齐前数据可靠性会保持 Low。",
    topRecommended: "前 20 个推荐候选",
    reliableCandidates: "可靠候选",
    incompleteCandidates: "数据不完整候选",
    bestValue: "最佳价值候选",
    highestQuality: "最高质量公司",
    lowestRisk: "最低风险候选",
    highestRisk: "最高风险股票",
    avoidList: "避免名单",
    waitList: "等待更好价格",
    warnings: "组合规则警告",
    noWarnings: "没有明显组合规则警告。",
    dataSource: "数据来源",
    cacheStatus: "缓存状态",
    lastUpdated: "最后更新",
    missingData: "缺失数据",
    biggestRisk: "最大风险",
    betterPrice: "更好的买入价",
    positionSize: "研究仓位范围",
    fairValue: "合理价值区间",
    conservativeBuy: "保守买入价",
    holdZone: "持有区间",
    trimZone: "高估 / 减仓区间"
  }
};

const recommendationZh: Record<RecommendationLabel, string> = {
  "Strong Buy Candidate": "强买入候选",
  "Buy Candidate": "买入候选",
  Watchlist: "观察名单",
  "Wait for Better Price": "等待更好价格",
  Avoid: "避免",
  "Insufficient Data": "数据不足"
};

const riskZh: Record<RiskLabel, string> = {
  "Low Risk": "低风险",
  "Medium Risk": "中等风险",
  "High Risk": "高风险",
  Speculative: "投机"
};

function parseNumber(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberValue(value: number | null) {
  return value === null ? "" : String(value);
}

function defaultScanPrioritySettings(): ScanPrioritySettings {
  return {
    mode: "Make Valid Fastest",
    weights: {
      marketCap: 20,
      dataCoverage: 35,
      watchlist: 15,
      sectorPreference: 10,
      missingFields: 20,
      quality: 0,
      valuation: 0,
      risk: 0
    },
    preferredSectors: [],
    manualTickers: ""
  };
}

function normalizeScanPrioritySettings(value: Partial<ScanPrioritySettings> | null | undefined) {
  const defaults = defaultScanPrioritySettings();
  const mode = SCAN_PRIORITY_MODES.includes(value?.mode as ScanPriorityMode)
    ? value!.mode as ScanPriorityMode
    : defaults.mode;
  const weights = Object.fromEntries(
    Object.entries(defaults.weights).map(([key, fallback]) => {
      const candidate = value?.weights?.[key as keyof ScanPriorityWeights];
      return [key, typeof candidate === "number" && Number.isFinite(candidate) ? Math.max(0, candidate) : fallback];
    })
  ) as ScanPriorityWeights;
  return {
    mode,
    weights,
    preferredSectors: (value?.preferredSectors ?? []).filter((sector): sector is ScanPrioritySector =>
      SCAN_PRIORITY_SECTORS.includes(sector as ScanPrioritySector)
    ),
    manualTickers: value?.manualTickers ?? ""
  } satisfies ScanPrioritySettings;
}

function manualPriorityTickers(value: string) {
  return [...new Set(
    value
      .split(/[\s,;]+/)
      .map((ticker) => ticker.trim().toUpperCase())
      .filter(Boolean)
  )];
}

function fmpAttemptDelta(after: FmpAttemptStats, before: FmpAttemptStats) {
  return {
    success: Math.max(0, after.success - before.success),
    premiumBlocked: Math.max(0, after.premiumBlocked - before.premiumBlocked),
    unauthorized: Math.max(0, after.unauthorized - before.unauthorized),
    rateLimited: Math.max(0, after.rateLimited - before.rateLimited),
    networkErrors: Math.max(0, after.networkErrors - before.networkErrors),
    otherErrors: Math.max(0, after.otherErrors - before.otherErrors)
  } satisfies FmpAttemptStats;
}

function defaultEndpointRoiStats(): EndpointRoiStats {
  return {
    calls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    premiumBlockedCalls: 0,
    callsAddedFields: 0,
    callsNoUsableData: 0
  };
}

function defaultEndpointRoi(): Record<FmpCapabilityId, EndpointRoiStats> {
  return Object.fromEntries(
    FMP_CAPABILITY_DEFINITIONS.map((definition) => [definition.id, defaultEndpointRoiStats()])
  ) as Record<FmpCapabilityId, EndpointRoiStats>;
}

function normalizedEndpointRoi(value: Partial<Record<FmpCapabilityId, Partial<EndpointRoiStats>>> | undefined) {
  const next = defaultEndpointRoi();
  for (const definition of FMP_CAPABILITY_DEFINITIONS) {
    const stored = value?.[definition.id];
    if (!stored) continue;
    next[definition.id] = {
      calls: stored.calls ?? 0,
      successfulCalls: stored.successfulCalls ?? 0,
      failedCalls: stored.failedCalls ?? 0,
      premiumBlockedCalls: stored.premiumBlockedCalls ?? 0,
      callsAddedFields: stored.callsAddedFields ?? 0,
      callsNoUsableData: stored.callsNoUsableData ?? 0
    };
  }
  return next;
}

function scanRoiSummary(batches: ScanRoiBatch[]) {
  const calls = batches.reduce((sum, batch) => sum + batch.actualCallsUsed, 0);
  const newValidStocks = batches.reduce((sum, batch) => sum + batch.newValidStocksGained, 0);
  return {
    batches: batches.length,
    calls,
    successfulEndpoints: batches.reduce((sum, batch) => sum + batch.successfulEndpoints, 0),
    failedEndpoints: batches.reduce((sum, batch) => sum + batch.failedEndpoints, 0),
    premiumBlockedEndpoints: batches.reduce((sum, batch) => sum + batch.premiumBlockedEndpoints, 0),
    newValidStocks,
    callsPerNewValidStock: newValidStocks > 0 ? calls / newValidStocks : null,
    validStocksPerCall: calls > 0 ? newValidStocks / calls : 0
  } satisfies ScanRoiSummary;
}

function aggregateEndpointRoi(batches: ScanRoiBatch[]) {
  const aggregate = defaultEndpointRoi();
  for (const batch of batches) {
    const row = normalizedEndpointRoi(batch.endpointRoi);
    for (const definition of FMP_CAPABILITY_DEFINITIONS) {
      const current = aggregate[definition.id];
      const value = row[definition.id];
      current.calls += value.calls;
      current.successfulCalls += value.successfulCalls;
      current.failedCalls += value.failedCalls;
      current.premiumBlockedCalls += value.premiumBlockedCalls;
      current.callsAddedFields += value.callsAddedFields;
      current.callsNoUsableData += value.callsNoUsableData;
    }
  }
  return aggregate;
}

function priorityModeRoi(history: ScanRoiBatch[]) {
  const grouped = new Map<ScanPriorityMode, ScanRoiBatch[]>();
  for (const batch of history) {
    if (batch.actualCallsUsed <= 0) continue;
    grouped.set(batch.priorityMode, [...(grouped.get(batch.priorityMode) ?? []), batch]);
  }
  return [...grouped.entries()]
    .map(([mode, batches]) => ({ mode, summary: scanRoiSummary(batches) }))
    .sort((left, right) =>
      right.summary.validStocksPerCall - left.summary.validStocksPerCall
      || left.summary.calls - right.summary.calls
    );
}

function todayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isStale(dateText: string) {
  if (!dateText) return true;
  return Date.now() - new Date(dateText).getTime() > 24 * 60 * 60 * 1000;
}

function recommendationLabel(language: Language, label: RecommendationLabel) {
  return language === "zh" ? recommendationZh[label] : label;
}

function riskLabel(language: Language, label: RiskLabel) {
  return language === "zh" ? riskZh[label] : label;
}

function localizedReasons(language: Language, analysis: StockAnalysis) {
  if (language !== "zh") return analysis.reasons;
  return [
    `质量评分 ${analysis.breakdown.quality}/100，估值评分 ${analysis.breakdown.valuation}/100，风险等级 ${riskLabel(language, analysis.riskLabel)}。`,
    analysis.valuation.conservativeBuyPrice ? `研究买入区从 ${money(analysis.valuation.conservativeBuyPrice)} 附近开始。` : "DCF 买入区需要自由现金流和股本数据。",
    `当前结论：${recommendationLabel(language, analysis.recommendation)}。`
  ];
}

function localizedRisk(language: Language, analysis: StockAnalysis) {
  if (language !== "zh") return analysis.biggestRisk;
  if (analysis.riskLabel === "Speculative") return "波动、回撤、债务或缺失数据导致投机风险。";
  if (analysis.valuationRisk === "High") return "估值风险：当前价格可能已经反映过高增长预期。";
  if ((analysis.stock.debt_to_equity ?? 0) > 2) return "资产负债风险：债务权益比偏高。";
  if ((analysis.stock.volatility_pct ?? 0) > 45) return "波动风险偏高。";
  return "主要风险来自模型不确定性和前瞻数据不足。";
}

function recommendationNeedsAttention(label: RecommendationLabel) {
  return label === "Avoid" || label === "Insufficient Data" || label === "Wait for Better Price";
}

function riskNeedsAttention(label: RiskLabel) {
  return label === "High Risk" || label === "Speculative";
}

function analysisNeedsAttention(analysis: StockAnalysis) {
  return recommendationNeedsAttention(analysis.recommendation)
    || riskNeedsAttention(analysis.riskLabel)
    || analysis.realDataPercent < 70
    || analysis.fallbackPercent > 30
    || analysis.valuationRisk === "High"
    || analysis.warnings.length > 0
    || analysis.missingData.length > 0;
}

function scenarioDecisionNeedsAttention(label: string) {
  return label === "Requires Bull Case"
    || label === "Above Bull Case"
    || label === "Speculative Premium"
    || label === "Insufficient Scenario Data";
}

function scenarioRiskRewardNeedsAttention(label: string) {
  return label === "Poor Risk/Reward" || label === "Speculative Premium";
}

function attentionTextClass(active: boolean) {
  return active ? "text-danger" : "text-ink";
}

function attentionMutedTextClass(active: boolean) {
  return active ? "text-danger" : "text-muted";
}

function warningText(language: Language, warning: string) {
  if (language !== "zh") return warning;
  if (warning.includes("missing or manual data")) return "推荐主要基于缺失数据或手动数据，可信度较低。";
  if (warning.includes("Score unreliable")) return "由于缺失数据较多，当前评分不可靠。";
  if (warning.includes("DCF and relative valuation")) return "DCF 与相对估值明显不一致。";
  if (warning.includes("highly volatile")) return "该股票波动率较高。";
  if (warning.includes("above the fair value range")) return "当前价格高于公允价值区间。";
  if (warning.includes("above 15%")) return warning.replace(" is above 15% allocation.", " 超过 15% 单股占比。");
  if (warning.includes("above 35%")) return warning.replace(" is above 35% sector allocation.", " 超过 35% 行业占比。");
  if (warning.includes("High risk")) return "高风险股票超过组合 25%。";
  if (warning.includes("Speculative")) return "投机股票超过组合 5%。";
  if (warning.includes("Cash")) return "现金比例低于 10%。";
  if (warning.includes("top three")) return "前三大持仓过于集中。";
  return warning;
}

async function backendIsOnline(timeoutMs = 2500) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}/health`, { cache: "no-store", signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

type YahooQuoteResult = {
  rows: Partial<StockRecord>[];
  fromCache: boolean;
  errorMessage?: string;
};

async function yahooBackendError(response: Response) {
  const text = await response.text();
  try {
    const data = JSON.parse(text) as { detail?: string | { message?: string; error?: string; symbols?: string[] } };
    if (typeof data.detail === "string") return data.detail;
    if (data.detail) {
      const parts = [data.detail.message, data.detail.error, data.detail.symbols?.length ? `Symbols: ${data.detail.symbols.join(", ")}` : ""].filter(Boolean);
      return parts.join(" ");
    }
  } catch {
    // Fall back to the raw body below.
  }
  return text || `Backend Yahoo proxy failed with HTTP ${response.status}.`;
}

async function fetchYahooQuotes(tickers: string[]): Promise<YahooQuoteResult> {
  const rows: Partial<StockRecord>[] = [];
  try {
    for (let index = 0; index < tickers.length; index += 40) {
      const chunk = tickers.slice(index, index + 40);
      const query = new URLSearchParams({ symbols: chunk.join(",") });
      const response = await fetch(`${API_BASE}/api/investment/yahoo-quotes?${query.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(await yahooBackendError(response));
      const data = await response.json() as { quotes?: Partial<StockRecord>[] };
      rows.push(...(data.quotes ?? []));
    }
    const today = todayKey();
    const cache = getCache();
    const yahoo = { ...(cache.yahoo ?? {}) };
    for (const row of rows) {
      if (row.ticker) yahoo[row.ticker] = { date: today, data: row };
    }
    setCache({ ...cache, yahoo });
    return { rows, fromCache: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backend Yahoo proxy failed.";
    const cache = getCache();
    const cachedRows = tickers
      .map((ticker) => cache.yahoo?.[ticker.toUpperCase()]?.data)
      .filter((row): row is Partial<StockRecord> => Boolean(row));
    if (cachedRows.length) return { rows: cachedRows, fromCache: true, errorMessage: message };
    throw new Error(`${message} No local Yahoo cache available.`);
  }
}

async function secBackendError(response: Response) {
  const text = await response.text();
  try {
    const data = JSON.parse(text) as { detail?: string | { message?: string; error?: string; symbols?: string[] } };
    if (typeof data.detail === "string") return data.detail;
    if (data.detail) {
      return [data.detail.message, data.detail.error, data.detail.symbols?.length ? `Symbols: ${data.detail.symbols.join(", ")}` : ""]
        .filter(Boolean)
        .join(" ");
    }
  } catch {
    // Fall back to the raw response body.
  }
  return text || `Backend SEC EDGAR proxy failed with HTTP ${response.status}.`;
}

async function fetchSecCashFlowBatch(
  tickers: string[],
  cache: InvestmentCache,
  forceRefresh = false
): Promise<SecCashFlowResponse> {
  const symbols = [...new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))].slice(0, 25);
  const query = new URLSearchParams({
    symbols: symbols.join(","),
    force_refresh: String(forceRefresh)
  });
  try {
    const response = await fetch(`${API_BASE}/api/investment/sec-cash-flow?${query.toString()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(await secBackendError(response));
    return response.json() as Promise<SecCashFlowResponse>;
  } catch (error) {
    const cachedResults = symbols
      .map((ticker) => secCashFlowEntry(cache, ticker)?.data)
      .filter((result): result is SecCashFlowResult => Boolean(result));
    if (cachedResults.length) {
      return {
        source: "SEC EDGAR XBRL",
        requested_symbols: symbols,
        results: cachedResults,
        requests_made: 0,
        cache_hits: cachedResults.length,
        successes: cachedResults.filter((result) => result.status === "success").length,
        failures: cachedResults.filter((result) => result.status !== "success").length,
        fetched_at: nowIso(),
        local_cache_fallback: true
      };
    }
    const message = error instanceof Error ? error.message : "Backend SEC EDGAR proxy failed.";
    throw new Error(`${message} No local SEC cache available.`);
  }
}

function mergeStock(existing: StockRecord | undefined, incoming: Partial<StockRecord>): StockRecord {
  const base = existing ?? emptyStock();
  return {
    ...base,
    ...incoming,
    id: existing?.id ?? uid("stock"),
    ticker: (incoming.ticker ?? existing?.ticker ?? "").toUpperCase(),
    sector: incoming.sector || existing?.sector || "Unknown",
    industry: incoming.industry || existing?.industry || "",
    target_buy_price: existing?.target_buy_price ?? incoming.target_buy_price ?? 0,
    notes: existing?.notes ?? incoming.notes ?? "",
    last_updated: incoming.last_updated ?? nowIso(),
    field_audit: { ...(existing?.field_audit ?? {}), ...(incoming.field_audit ?? {}) }
  };
}

function mergeStockRows(current: StockRecord[], incomingRows: Partial<StockRecord>[]) {
  const next = [...current];
  const byTicker = new Map(next.map((stock) => [stock.ticker, stock]));
  for (const row of incomingRows) {
    const ticker = row.ticker?.toUpperCase() ?? "";
    if (!ticker) continue;
    const merged = mergeStock(byTicker.get(ticker), { ...row, ticker });
    if (byTicker.has(ticker)) {
      const index = next.findIndex((stock) => stock.ticker === ticker);
      next[index] = merged;
    } else {
      next.push(merged);
    }
    byTicker.set(ticker, merged);
  }
  return next;
}

function mergePartialStock(existing: Partial<StockRecord> | undefined, incoming: Partial<StockRecord>) {
  return {
    ...(existing ?? {}),
    ...incoming,
    field_audit: {
      ...(existing?.field_audit ?? {}),
      ...(incoming.field_audit ?? {})
    }
  } satisfies Partial<StockRecord>;
}

function localUniverseRows(existingStocks: StockRecord[]) {
  const byTicker = new Map(existingStocks.map((stock) => [stock.ticker, stock]));
  return DEFAULT_UNIVERSE.map((ticker) => {
    const existing = byTicker.get(ticker);
    return {
      ticker,
      company_name: existing?.company_name || ticker,
      sector: existing?.sector || "Unknown",
      industry: existing?.industry || "",
      source: existing?.source && existing.source !== "Manual" ? existing.source : "Local Universe",
      last_updated: existing?.last_updated || nowIso()
    } satisfies Partial<StockRecord>;
  });
}

function withManualFieldAudit(stock: StockRecord) {
  const timestamp = nowIso();
  const next: StockRecord = { ...stock, field_audit: { ...(stock.field_audit ?? {}) }, last_updated: timestamp };
  for (const field of SCORE_FIELD_KEYS) {
    const value = (stock as unknown as Record<string, unknown>)[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value === 0 && field !== "dividend_yield_pct") continue;
    next.field_audit![field] = auditEntry(value, "manual", timestamp, true);
  }
  return next;
}

function getCache() {
  return readJson<InvestmentCache>(CACHE_KEY, {});
}

function setCache(cache: InvestmentCache) {
  writeJson(CACHE_KEY, cache);
}

function defaultFmpAttemptStats(): FmpAttemptStats {
  return {
    success: 0,
    premiumBlocked: 0,
    unauthorized: 0,
    rateLimited: 0,
    networkErrors: 0,
    otherErrors: 0
  };
}

function capabilityIdForEndpoint(endpoint: FmpEndpoint) {
  const path = endpoint.path.replace(/^\/+/, "");
  if (path === "quote") return "quote";
  if (path === "profile") return "profile";
  if (path === "ratios-ttm") return "ratios";
  if (path === "income-statement") return "income";
  if (path === "cash-flow-statement") return "cashFlow";
  if (path === "historical-price-eod/full") return "historical";
  return null;
}

function premiumBlockMemoryFromCache(cache: InvestmentCache) {
  const memory = { ...(cache.fmpPremiumBlocked ?? {}) };
  for (const definition of FMP_CAPABILITY_DEFINITIONS) {
    const capability = cache.fmpCapabilities?.[definition.id];
    if (capability?.status !== "premium blocked" || memory[definition.id]) continue;
    const timestamp = capability.testedAt ?? nowIso();
    memory[definition.id] = {
      endpointId: definition.id,
      firstBlockedAt: timestamp,
      lastBlockedAt: timestamp,
      httpStatus: capability.httpStatus ?? 402,
      message: capability.preview || "Premium blocked by current FMP plan."
    };
  }
  for (const [cacheKey, entry] of Object.entries(cache.fmp ?? {})) {
    const endpointId = capabilityIdForCacheKey(cacheKey);
    if (!endpointId || memory[endpointId] || !isPremiumBlockedCacheEntry(entry)) continue;
    const timestamp = entry.timestamp ?? `${entry.date}T00:00:00.000Z`;
    memory[endpointId] = {
      endpointId,
      firstBlockedAt: timestamp,
      lastBlockedAt: timestamp,
      httpStatus: entry.httpStatus ?? 402,
      message: entry.error || "Premium or restricted endpoint response found in FMP cache."
    };
  }
  return memory;
}

function rememberPremiumBlocked(cache: InvestmentCache, endpointId: FmpCapabilityId, message: string, status = 402) {
  const timestamp = nowIso();
  const memory = premiumBlockMemoryFromCache(cache);
  const previous = memory[endpointId];
  const blocked: FmpPremiumBlockMemory = {
    endpointId,
    firstBlockedAt: previous?.firstBlockedAt ?? timestamp,
    lastBlockedAt: timestamp,
    httpStatus: status,
    message
  };
  const next = {
    ...cache,
    fmpPremiumBlocked: { ...memory, [endpointId]: blocked },
    fmpCapabilities: {
      ...(cache.fmpCapabilities ?? {}),
      [endpointId]: {
        id: endpointId,
        label: FMP_CAPABILITY_DEFINITIONS.find((definition) => definition.id === endpointId)?.label ?? endpointId,
        status: "premium blocked" as const,
        httpStatus: status,
        preview: message.slice(0, 400),
        testedAt: timestamp
      }
    }
  };
  setCache(next);
  return next;
}

function normalizeFmpDailyUsage(cache: InvestmentCache) {
  const today = todayKey();
  const appUsageCurrent = cache.fmpUsageDate === today;
  const officialUsageCurrent = cache.officialFmpUsageDate === today;
  const appCalls = appUsageCurrent ? cache.fmpCalls ?? 0 : 0;
  return {
    ...cache,
    fmpPremiumBlocked: premiumBlockMemoryFromCache(cache),
    fmpUsageDate: today,
    fmpCalls: appCalls,
    fmpAttemptStats: appUsageCurrent ? cache.fmpAttemptStats ?? defaultFmpAttemptStats() : defaultFmpAttemptStats(),
    officialFmpUsageDate: today,
    officialFmpUsed: officialUsageCurrent ? cache.officialFmpUsed ?? appCalls : appCalls,
    officialFmpLimit: Math.max(1, cache.officialFmpLimit ?? 250),
    fmpSafetyBuffer: Math.max(0, cache.fmpSafetyBuffer ?? 10)
  } satisfies InvestmentCache;
}

function safeFmpRemaining(cache: InvestmentCache) {
  const normalized = normalizeFmpDailyUsage(cache);
  return Math.max(0, (normalized.officialFmpLimit ?? 250) - (normalized.officialFmpUsed ?? 0) - (normalized.fmpSafetyBuffer ?? 10));
}

function recordFmpAttempt(cache: InvestmentCache) {
  const normalized = normalizeFmpDailyUsage(cache);
  const next = {
    ...normalized,
    fmpCalls: (normalized.fmpCalls ?? 0) + 1,
    officialFmpUsed: (normalized.officialFmpUsed ?? 0) + 1
  };
  setCache(next);
  return next;
}

function recordFmpAttemptResult(cache: InvestmentCache, result: keyof FmpAttemptStats) {
  const normalized = normalizeFmpDailyUsage(cache);
  const stats = { ...(normalized.fmpAttemptStats ?? defaultFmpAttemptStats()) };
  stats[result] += 1;
  const next = { ...normalized, fmpAttemptStats: stats };
  setCache(next);
  return next;
}

function defaultFmpCapabilities(): Record<FmpCapabilityId, FmpCapabilityResult> {
  return Object.fromEntries(
    FMP_CAPABILITY_DEFINITIONS.map((definition) => [
      definition.id,
      { id: definition.id, label: definition.label, status: "untested" as const, preview: "" }
    ])
  ) as Record<FmpCapabilityId, FmpCapabilityResult>;
}

function capabilitiesFromCache(cache: InvestmentCache) {
  const next = defaultFmpCapabilities();
  const premiumBlocked = premiumBlockMemoryFromCache(cache);
  for (const definition of FMP_CAPABILITY_DEFINITIONS) {
    const cached = cache.fmpCapabilities?.[definition.id];
    if (cached) next[definition.id] = cached;
    const blocked = premiumBlocked[definition.id];
    if (blocked) {
      next[definition.id] = {
        id: definition.id,
        label: definition.label,
        status: "premium blocked",
        httpStatus: blocked.httpStatus,
        preview: blocked.message,
        testedAt: blocked.lastBlockedAt
      };
    }
  }
  return next;
}

function isPremiumBlockedText(value: string) {
  return /HTTP 402|premium|subscription|special endpoint|restricted endpoint|not available under current subscription|not available under current plan/i.test(value);
}

function classifyFmpFailure(status: number | null, preview: string): FmpCapabilityStatus {
  return status === 402 || isPremiumBlockedText(preview) ? "premium blocked" : "error";
}

function fmpCapabilityStatusLabel(status: FmpCapabilityStatus) {
  if (status === "available") return "available";
  if (status === "premium blocked") return "premium blocked";
  if (status === "error") return "error";
  return "untested";
}

function blockedCapabilityMessage(capabilities: Record<FmpCapabilityId, FmpCapabilityResult>) {
  return FMP_CAPABILITY_DEFINITIONS.some((definition) => capabilities[definition.id].status === "premium blocked")
    ? "Some FMP endpoints are blocked by your plan. Investment Lab used available data only."
    : "";
}

function fmpEndpointKey(endpoint: FmpEndpoint) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(endpoint.params ?? {}).sort(([left], [right]) => left.localeCompare(right))) {
    if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return `${endpoint.path.replace(/^\/+/, "")}${query ? `?${query}` : ""}`;
}

function fmpUrl(endpoint: FmpEndpoint, apiKey: string) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(endpoint.params ?? {})) {
    if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
  }
  params.set("apikey", apiKey);
  return `${FMP_STABLE_BASE}/${endpoint.path.replace(/^\/+/, "")}?${params.toString()}`;
}

function maskApiKey(apiKey: string) {
  const trimmed = apiKey.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 8) return "****";
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

function maskFmpText(text: string, apiKey: string) {
  const masked = maskApiKey(apiKey);
  if (!masked) return text;
  return text
    .replaceAll(apiKey, masked)
    .replaceAll(encodeURIComponent(apiKey), masked)
    .replace(/apikey=[^&\s"]+/gi, `apikey=${masked}`);
}

async function fmpErrorDetails(response: Response, apiKey: string) {
  const body = await response.text();
  const trimmed = body.slice(0, 800);
  return `FMP request failed: HTTP ${response.status}. Body: ${maskFmpText(trimmed || "<empty>", apiKey)}`;
}

class FmpRequestError extends Error {
  constructor(message: string, readonly status: number | null = null) {
    super(message);
  }
}

class FmpQuotaError extends Error {}

function storeFmpFailure(
  cache: InvestmentCache,
  cacheKey: string,
  result: "failed" | "premium blocked",
  message: string,
  httpStatus: number | null
) {
  const next = {
    ...cache,
    fmp: {
      ...(cache.fmp ?? {}),
      [cacheKey]: {
        date: todayKey(),
        data: { error: message, httpStatus },
        status: result,
        httpStatus,
        error: message,
        timestamp: nowIso()
      }
    }
  } satisfies InvestmentCache;
  setCache(next);
  return next;
}

async function fmpFetch(endpoint: FmpEndpoint, apiKey: string, cache: InvestmentCache, options: { forceRefresh?: boolean; allowErrorCacheFallback?: boolean } = {}) {
  const key = fmpEndpointKey(endpoint);
  const today = todayKey();
  const normalizedCache = normalizeFmpDailyUsage(cache);
  const capabilityId = capabilityIdForEndpoint(endpoint);
  const cached = normalizedCache.fmp?.[key];
  const cachedAudit = cached ? classifyFmpCacheEntry(key, cached) : null;
  const usableCachedData =
    cachedAudit?.category === "valid data cache"
    || cachedAudit?.category === "stale cache";
  if (!options.forceRefresh && cached && cachedAudit?.category === "valid data cache") {
    return { data: cached.data, cache: normalizedCache, fromCache: true, attempted: false, attemptResult: "cache" as const, timestamp: `${cached.date}T00:00:00.000Z` };
  }
  if (capabilityId && normalizedCache.fmpPremiumBlocked?.[capabilityId]) {
    if (cached && usableCachedData) {
      return { data: cached.data, cache: normalizedCache, fromCache: true, attempted: false, attemptResult: "cache" as const, timestamp: `${cached.date}T00:00:00.000Z` };
    }
    throw new FmpRequestError(`${capabilityId} is permanently marked premium blocked for the current FMP plan.`, 402);
  }
  if (safeFmpRemaining(normalizedCache) <= 0) {
    if (cached && usableCachedData) {
      return { data: cached.data, cache: normalizedCache, fromCache: true, attempted: false, attemptResult: "cache" as const, timestamp: `${cached.date}T00:00:00.000Z` };
    }
    throw new FmpQuotaError("FMP safe remaining calls reached zero. Reconcile the official dashboard usage before continuing.");
  }
  let attemptedCache: InvestmentCache = recordFmpAttempt(normalizedCache);
  let response: Response;
  try {
    response = await fetch(fmpUrl(endpoint, apiKey));
  } catch (error) {
    attemptedCache = recordFmpAttemptResult(attemptedCache, "networkErrors");
    if (options.allowErrorCacheFallback !== false && cached && usableCachedData) {
      return { data: cached.data, cache: attemptedCache, fromCache: true, attempted: true, attemptResult: "networkErrors" as const, timestamp: `${cached.date}T00:00:00.000Z` };
    }
    attemptedCache = storeFmpFailure(
      attemptedCache,
      key,
      "failed",
      error instanceof Error ? error.message : "Network error while requesting FMP.",
      null
    );
    throw error;
  }
  if (!response.ok) {
    const details = await fmpErrorDetails(response, apiKey);
    const resultKey: keyof FmpAttemptStats =
      response.status === 402 ? "premiumBlocked" :
        response.status === 403 ? "unauthorized" :
          response.status === 429 ? "rateLimited" :
            "otherErrors";
    attemptedCache = recordFmpAttemptResult(attemptedCache, resultKey);
    if (response.status === 402 && capabilityId) {
      if (!(cached && usableCachedData)) {
        attemptedCache = storeFmpFailure(attemptedCache, key, "premium blocked", details, response.status);
      }
      attemptedCache = rememberPremiumBlocked(attemptedCache, capabilityId, details, response.status);
    } else if (!(cached && usableCachedData)) {
      attemptedCache = storeFmpFailure(attemptedCache, key, "failed", details, response.status);
    }
    if (options.allowErrorCacheFallback !== false && cached && usableCachedData) {
      return { data: cached.data, cache: attemptedCache, fromCache: true, attempted: true, attemptResult: resultKey, timestamp: `${cached.date}T00:00:00.000Z` };
    }
    throw new FmpRequestError(details, response.status);
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    attemptedCache = recordFmpAttemptResult(attemptedCache, "otherErrors");
    if (!(cached && usableCachedData)) {
      attemptedCache = storeFmpFailure(
        attemptedCache,
        key,
        "failed",
        error instanceof Error ? `Malformed JSON: ${error.message}` : "Malformed JSON response.",
        response.status
      );
    }
    throw error;
  }
  const successfulCache = recordFmpAttemptResult(attemptedCache, "success");
  const next = {
    ...successfulCache,
    fmp: {
      ...(successfulCache.fmp ?? {}),
      [key]: { date: today, data, status: "success" as const, httpStatus: response.status, timestamp: nowIso() }
    }
  };
  setCache(next);
  return { data, cache: next, fromCache: false, attempted: true, attemptResult: "success" as const, timestamp: nowIso() };
}

function recordArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object") : [];
}

function finiteValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const SCORE_FIELD_KEYS = new Set([
  "current_price",
  "market_cap",
  "pe_ratio",
  "revenue_growth_pct",
  "fcf_growth_pct",
  "net_margin_pct",
  "free_cash_flow",
  "debt_to_equity",
  "roe_pct",
  "dividend_yield_pct",
  "volatility_pct",
  "drawdown_52w_pct",
  "shares_outstanding"
]);

function auditEntry(rawValue: number | string | null, source: InvestmentDataSource, timestamp = nowIso(), affectedScore = true): InvestmentFieldAudit {
  return { rawValue, source, timestamp, affectedScore };
}

function setFieldAudit(row: Partial<StockRecord>, field: string, rawValue: number | string | null, source: InvestmentDataSource, timestamp = nowIso(), affectedScore = SCORE_FIELD_KEYS.has(field)) {
  row.field_audit = {
    ...(row.field_audit ?? {}),
    [field]: auditEntry(rawValue, source, timestamp, affectedScore)
  };
}

function setNumber(row: Partial<StockRecord>, key: keyof StockRecord, value: unknown, source?: InvestmentDataSource, timestamp = nowIso()) {
  const parsed = finiteValue(value);
  if (parsed !== null) {
    (row as Record<string, unknown>)[key] = parsed;
    if (source) setFieldAudit(row, String(key), parsed, source, timestamp);
  }
}

function fmpStockRow(item: Record<string, unknown>, source: InvestmentDataSource, timestamp = nowIso()) {
  const ticker = String(item.symbol ?? item.ticker ?? "").toUpperCase();
  if (!ticker) return null;
  const row: Partial<StockRecord> = {
    ticker,
    company_name: String(item.companyName ?? item.name ?? item.company_name ?? ticker),
    sector: String(item.sector ?? "Unknown"),
    industry: String(item.industry ?? ""),
    source: "FMP",
    last_updated: nowIso()
  };
  setNumber(row, "current_price", item.price, source, timestamp);
  setNumber(row, "market_cap", item.marketCap ?? item.mktCap, source, timestamp);
  setNumber(row, "pe_ratio", item.pe ?? item.peRatio ?? item.trailingPE, source, timestamp);
  setNumber(row, "average_volume", item.avgVolume ?? item.volume, source, timestamp);
  setNumber(row, "shares_outstanding", item.sharesOutstanding, source, timestamp);
  const price = finiteValue(item.price);
  const yearHigh = finiteValue(item.yearHigh ?? item["52WeekHigh"]);
  if (price !== null && yearHigh !== null && yearHigh > 0) {
    row.drawdown_52w_pct = ((price - yearHigh) / yearHigh) * 100;
    setFieldAudit(row, "drawdown_52w_pct", row.drawdown_52w_pct, source, timestamp);
  }
  return row;
}

function fmpHistoricalRow(ticker: string, value: unknown, source: InvestmentDataSource = "FMP historical EOD") {
  const metrics = historicalMetrics(value);
  if (metrics.current_price === null && metrics.drawdown_52w_pct === null && metrics.volatility_pct === null) return null;
  const timestamp = nowIso();
  const row: Partial<StockRecord> = {
    ticker,
    source: "FMP Historical EOD",
    last_updated: timestamp
  };
  if (metrics.current_price !== null) {
    row.current_price = metrics.current_price;
    row.historical_close = metrics.current_price;
    setFieldAudit(row, "current_price", metrics.current_price, source, timestamp);
    setFieldAudit(row, "historical_close", metrics.current_price, source, timestamp, false);
  }
  if (metrics.drawdown_52w_pct !== null) {
    row.drawdown_52w_pct = metrics.drawdown_52w_pct;
    setFieldAudit(row, "drawdown_52w_pct", metrics.drawdown_52w_pct, source, timestamp);
  }
  if (metrics.volatility_pct !== null) {
    row.volatility_pct = metrics.volatility_pct;
    setFieldAudit(row, "volatility_pct", metrics.volatility_pct, source, timestamp);
  }
  return row;
}

function capabilitySource(capabilityId: FmpCapabilityId, fromCache: boolean): InvestmentDataSource {
  if (fromCache) return "cache";
  if (capabilityId === "profile") return "FMP profile";
  if (capabilityId === "ratios") return "FMP ratios";
  if (capabilityId === "income") return "FMP income statement";
  if (capabilityId === "cashFlow") return "FMP cash flow statement";
  if (capabilityId === "historical") return "FMP historical EOD";
  return "FMP quote";
}

async function fetchFmpStage1(
  tickers: string[],
  apiKey: string,
  capabilities: Record<FmpCapabilityId, FmpCapabilityResult>,
  onCapabilityUpdate: (result: FmpCapabilityResult) => void
) {
  let cacheState = getCache();
  let calls = 0;
  const rowsByTicker = new Map<string, Partial<StockRecord>>();
  let usedAvailableOnly = false;
  const pullRaw = async (capabilityId: FmpCapabilityId, endpoint: FmpEndpoint) => {
    const capability = capabilities[capabilityId];
    if (capability.status !== "available") {
      usedAvailableOnly = true;
      return null;
    }
    try {
      const response = await fmpFetch(endpoint, apiKey, cacheState);
      cacheState = response.cache;
      if (!response.fromCache) calls += 1;
      return {
        data: response.data,
        source: capabilitySource(capabilityId, response.fromCache),
        timestamp: response.timestamp
      };
    } catch (error) {
      if (error instanceof FmpQuotaError) {
        usedAvailableOnly = true;
        return null;
      }
      const message = error instanceof Error ? maskFmpText(error.message, apiKey) : "FMP endpoint failed.";
      const result: FmpCapabilityResult = {
        ...capability,
        status: classifyFmpFailure(error instanceof FmpRequestError ? error.status : null, message),
        httpStatus: error instanceof FmpRequestError ? error.status : null,
        preview: message.slice(0, 400),
        testedAt: nowIso()
      };
      onCapabilityUpdate(result);
      usedAvailableOnly = true;
      return null;
    }
  };
  const pull = async (capabilityId: FmpCapabilityId, endpoint: FmpEndpoint) => {
    const result = await pullRaw(capabilityId, endpoint);
    return {
      rows: recordArray(result?.data),
      source: result?.source ?? "missing" as InvestmentDataSource,
      timestamp: result?.timestamp ?? nowIso()
    };
  };
  const localTickers = [...new Set(tickers)].filter(Boolean);
  const stage1Tickers = stage1FmpTickers(localTickers);

  for (const ticker of stage1Tickers) {
    const profileResult = await pull("profile", fmpSingleSymbolEndpoint("profile", ticker));
    for (const row of profileResult.rows) {
      const parsed = fmpStockRow(row, profileResult.source, profileResult.timestamp);
      if (!parsed?.ticker) continue;
      rowsByTicker.set(parsed.ticker, mergePartialStock(rowsByTicker.get(parsed.ticker), parsed));
    }
  }

  if (capabilities.quote.status === "available") {
    for (const ticker of stage1Tickers) {
      const quoteResult = await pull("quote", fmpSingleSymbolEndpoint("quote", ticker));
      for (const row of quoteResult.rows) {
        const parsed = fmpStockRow(row, quoteResult.source, quoteResult.timestamp);
        if (!parsed?.ticker) continue;
        rowsByTicker.set(parsed.ticker, mergePartialStock(rowsByTicker.get(parsed.ticker), parsed));
      }
    }
  } else if (capabilities.historical.status === "available") {
    usedAvailableOnly = true;
    for (const ticker of stage1Tickers) {
      const historical = await pullRaw("historical", fmpSingleSymbolEndpoint("historical-price-eod/full", ticker));
      const parsed = fmpHistoricalRow(ticker, historical?.data, historical?.source);
      if (parsed?.ticker) rowsByTicker.set(parsed.ticker, mergePartialStock(rowsByTicker.get(parsed.ticker), parsed));
    }
  } else {
    usedAvailableOnly = true;
  }

  return { rows: [...rowsByTicker.values()], calls, usedAvailableOnly };
}

async function testFmpCapabilityDefinition(definition: FmpCapabilityDefinition, apiKey: string, cache: InvestmentCache) {
  try {
    const response = await fmpFetch(definition.endpoint, apiKey, cache, { forceRefresh: true, allowErrorCacheFallback: false });
    const preview = JSON.stringify(response.data).slice(0, 400);
    return {
      cache: response.cache,
      result: {
        id: definition.id,
        label: definition.label,
        status: "available" as const,
        httpStatus: 200,
        preview: response.fromCache ? `Cached response: ${preview}` : preview,
        testedAt: nowIso()
      }
    };
  } catch (error) {
    const message = error instanceof Error ? maskFmpText(error.message, apiKey) : "FMP endpoint failed.";
    return {
      cache,
      result: {
        id: definition.id,
        label: definition.label,
        status: classifyFmpFailure(error instanceof FmpRequestError ? error.status : null, message),
        httpStatus: error instanceof FmpRequestError ? error.status : null,
        preview: message.slice(0, 400),
        testedAt: nowIso()
      }
    };
  }
}

function firstArrayItem(value: unknown) {
  return Array.isArray(value) ? value[0] as Record<string, unknown> | undefined : undefined;
}

function historicalArray(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object");
  if (value && typeof value === "object" && Array.isArray((value as { historical?: unknown }).historical)) {
    return (value as { historical: unknown[] }).historical.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object");
  }
  return [];
}

function historicalMetrics(value: unknown) {
  const rows = historicalArray(value)
    .map((row, index) => ({
      close: finiteValue(row.close),
      high: finiteValue(row.high) ?? finiteValue(row.close),
      timestamp: String(row.date ?? row.timestamp ?? ""),
      index
    }))
    .filter((row): row is { close: number; high: number; timestamp: string; index: number } => row.close !== null && row.high !== null)
    .sort((left, right) => {
      const leftTime = Date.parse(left.timestamp);
      const rightTime = Date.parse(right.timestamp);
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return rightTime - leftTime;
      return left.index - right.index;
    })
    .slice(0, 252);
  if (rows.length < 2) return { current_price: rows[0]?.close ?? null, drawdown_52w_pct: null, volatility_pct: null };
  const latestClose = rows[0].close;
  const yearHigh = Math.max(...rows.map((row) => row.high));
  const returns = rows.slice(0, -1)
    .map((row, index) => {
      const nextClose = rows[index + 1]?.close;
      return nextClose ? (row.close - nextClose) / nextClose : null;
    })
    .filter((value): value is number => value !== null && Number.isFinite(value));
  if (!returns.length) {
    return {
      current_price: latestClose,
      drawdown_52w_pct: yearHigh > 0 ? ((latestClose - yearHigh) / yearHigh) * 100 : null,
      volatility_pct: null
    };
  }
  const averageReturn = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - averageReturn) ** 2, 0) / returns.length;
  return {
    current_price: latestClose,
    drawdown_52w_pct: yearHigh > 0 ? ((latestClose - yearHigh) / yearHigh) * 100 : null,
    volatility_pct: Math.sqrt(variance) * Math.sqrt(252) * 100
  };
}

function fcfGrowthFromCashFlow(value: unknown) {
  const rows = sortFinancialPeriods(recordArray(value));
  const current = finiteValue(rows[0]?.freeCashFlow);
  const prior = finiteValue(rows[1]?.freeCashFlow);
  if (current === null || prior === null || prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

function financialPeriodTime(row: Record<string, unknown>) {
  const dateValue = String(row.date ?? row.fillingDate ?? row.acceptedDate ?? "");
  const parsedDate = Date.parse(dateValue);
  if (Number.isFinite(parsedDate)) return parsedDate;
  const calendarYear = Number(row.calendarYear ?? row.fiscalYear);
  return Number.isFinite(calendarYear) ? calendarYear * 10_000 : Number.NEGATIVE_INFINITY;
}

function sortFinancialPeriods(rows: Record<string, unknown>[]) {
  return [...rows].sort((left, right) => financialPeriodTime(right) - financialPeriodTime(left));
}

function cacheKeyPath(cacheKey: string) {
  return cacheKey.split("?")[0] ?? cacheKey;
}

function cacheKeySymbols(cacheKey: string) {
  const query = cacheKey.split("?")[1] ?? "";
  const symbols = new URLSearchParams(query).get("symbol") ?? "";
  return symbols.split(",").map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);
}

function capabilityIdForCacheKey(cacheKey: string): FmpCapabilityId | null {
  const path = cacheKeyPath(cacheKey);
  if (path === "quote") return "quote";
  if (path === "profile") return "profile";
  if (path === "ratios-ttm") return "ratios";
  if (path === "income-statement") return "income";
  if (path === "cash-flow-statement") return "cashFlow";
  if (path === "historical-price-eod/full") return "historical";
  return null;
}

function fmpCachePayloadMessage(entry: FmpCacheEntry) {
  if (entry.error) return entry.error;
  if (typeof entry.data === "string") return entry.data;
  if (!entry.data || typeof entry.data !== "object") return "";
  const payload = Array.isArray(entry.data)
    ? recordArray(entry.data)[0]
    : entry.data as Record<string, unknown>;
  if (!payload) return "";
  return String(
    payload["Error Message"]
    ?? payload.error
    ?? payload.message
    ?? payload.detail
    ?? payload.statusText
    ?? ""
  );
}

function fmpCachePayloadStatus(entry: FmpCacheEntry) {
  if (entry.httpStatus !== null && entry.httpStatus !== undefined) return entry.httpStatus;
  if (!entry.data || typeof entry.data !== "object") return null;
  const payload = Array.isArray(entry.data)
    ? recordArray(entry.data)[0]
    : entry.data as Record<string, unknown>;
  if (!payload) return null;
  return finiteValue(payload.httpStatus ?? payload.statusCode ?? payload.status);
}

function isPremiumBlockedCacheEntry(entry: FmpCacheEntry) {
  const status = fmpCachePayloadStatus(entry);
  return (
    entry.status === "premium blocked"
    || status === 402
    || isPremiumBlockedText(fmpCachePayloadMessage(entry))
  );
}

function isFailedFmpCacheEntry(entry: FmpCacheEntry) {
  if (entry.status === "failed") return true;
  const status = fmpCachePayloadStatus(entry);
  if (status === 403 || status === 429 || (status !== null && status >= 500)) return true;
  const message = fmpCachePayloadMessage(entry);
  return /network error|failed to fetch|fetch failed|malformed json|invalid json|json parse|unauthorized|forbidden|rate limit|internal server error|request failed/i.test(message);
}

function cacheRowsForCapability(capabilityId: FmpCapabilityId | null, data: unknown) {
  if (capabilityId === "historical") return historicalArray(data);
  return recordArray(data);
}

function hasExpectedFmpFields(capabilityId: FmpCapabilityId | null, row: Record<string, unknown>) {
  if (capabilityId === "historical") {
    return row.close !== null && row.close !== undefined && row.close !== ""
      || row.adjClose !== null && row.adjClose !== undefined && row.adjClose !== "";
  }
  const expectedFields: Record<Exclude<FmpCapabilityId, "historical">, string[]> = {
    quote: ["price", "marketCap", "volume", "avgVolume", "yearHigh", "yearLow"],
    profile: ["companyName", "name", "price", "marketCap", "mktCap", "sharesOutstanding", "sector", "industry"],
    ratios: [
      "peRatioTTM",
      "priceToEarningsRatioTTM",
      "returnOnEquityTTM",
      "dividendYieldTTM",
      "debtEquityRatioTTM",
      "debtToEquityRatioTTM",
      "revenueGrowthTTM",
      "netProfitMarginTTM"
    ],
    income: ["revenue", "netIncome", "eps", "operatingIncome", "grossProfit"],
    cashFlow: ["freeCashFlow", "operatingCashFlow", "netCashProvidedByOperatingActivities", "capitalExpenditure"]
  };
  const fields = capabilityId ? expectedFields[capabilityId] : Object.keys(row);
  return fields.some((field) => {
    const value = row[field];
    return value !== null && value !== undefined && value !== "";
  });
}

function fmpCacheHasUsableData(cacheKey: string, entry: FmpCacheEntry) {
  const capabilityId = capabilityIdForCacheKey(cacheKey);
  const rows = cacheRowsForCapability(capabilityId, entry.data);
  return rows.some((row) => hasExpectedFmpFields(capabilityId, row));
}

function classifyFmpCacheEntry(cacheKey: string, entry: FmpCacheEntry): FmpCacheAuditRow {
  const capabilityId = capabilityIdForCacheKey(cacheKey);
  const base = {
    cacheKey,
    capabilityId,
    symbols: cacheKeySymbols(cacheKey),
    date: entry.date
  };
  if (isPremiumBlockedCacheEntry(entry)) {
    return { ...base, category: "premium blocked cache", reason: "HTTP 402 or premium/restricted endpoint response." };
  }
  if (isFailedFmpCacheEntry(entry)) {
    return { ...base, category: "failed cache", reason: fmpCachePayloadMessage(entry) || "Stored request failure marker." };
  }
  if (!fmpCacheHasUsableData(cacheKey, entry)) {
    const rows = cacheRowsForCapability(capabilityId, entry.data);
    return {
      ...base,
      category: "empty cache",
      reason: rows.length
        ? "Response rows exist but expected endpoint fields are missing."
        : "Response is null, empty, malformed, or contains no usable rows."
    };
  }
  if (entry.date !== todayKey()) {
    return { ...base, category: "stale cache", reason: `Usable data is dated ${entry.date || "unknown"}.` };
  }
  return { ...base, category: "valid data cache", reason: "Usable endpoint data is fresh." };
}

function auditFmpCaches(cache: InvestmentCache) {
  return Object.entries(cache.fmp ?? {}).map(([cacheKey, entry]) => classifyFmpCacheEntry(cacheKey, entry));
}

function fmpCacheAuditForEndpoint(cache: InvestmentCache, capabilityId: FmpCapabilityId, ticker: string) {
  const cacheKey = fmpEndpointKey(fmpEndpointForTicker(capabilityId, ticker));
  const entry = cache.fmp?.[cacheKey];
  return entry ? classifyFmpCacheEntry(cacheKey, entry) : null;
}

function repairFmpCacheEntries(cache: InvestmentCache, action: FmpCacheRepairSummary["action"]) {
  const audit = auditFmpCaches(cache);
  const categories = new Set<FmpCacheCategory>(
    action === "empty"
      ? ["empty cache"]
      : action === "failed"
        ? ["failed cache"]
        : ["empty cache", "failed cache"]
  );
  const selected = audit.filter((row) => categories.has(row.category));
  const nextFmp = { ...(cache.fmp ?? {}) };
  selected.forEach((row) => delete nextFmp[row.cacheKey]);
  const next = {
    ...cache,
    fmp: nextFmp,
    fmpPremiumBlocked: premiumBlockMemoryFromCache(cache)
  } satisfies InvestmentCache;
  return {
    cache: next,
    audit,
    selected,
    emptyCachesFound: audit.filter((row) => row.category === "empty cache").length,
    failedCachesFound: audit.filter((row) => row.category === "failed cache").length
  };
}

function cashFlowHistoryForTicker(cache: InvestmentCache, ticker: string) {
  const normalizedTicker = ticker.toUpperCase();
  const candidates = Object.entries(cache.fmp ?? {})
    .filter(([cacheKey]) => cacheKeyPath(cacheKey) === "cash-flow-statement" && cacheKeySymbols(cacheKey).includes(normalizedTicker))
    .sort(([, left], [, right]) => right.date.localeCompare(left.date));
  const selected = candidates[0];
  if (!selected) return [] as FcfHistoryRow[];
  const [, entry] = selected;
  const seen = new Set<string>();
  return sortFinancialPeriods(recordArray(entry.data))
    .filter((row) => !rawRecordSymbol(row) || rawRecordSymbol(row) === normalizedTicker)
    .map((row): FcfHistoryRow | null => {
      const freeCashFlow = finiteValue(row.freeCashFlow);
      if (freeCashFlow === null) return null;
      const fiscalYear = String(row.fiscalYear ?? row.calendarYear ?? row.date ?? "");
      const dedupeKey = fiscalYear || String(row.date ?? "");
      if (seen.has(dedupeKey)) return null;
      seen.add(dedupeKey);
      return {
        fiscalYear,
        date: String(row.date ?? ""),
        freeCashFlow,
        capitalExpenditure: finiteValue(row.capitalExpenditure ?? row.investmentsInPropertyPlantAndEquipment),
        operatingCashFlow: finiteValue(row.operatingCashFlow ?? row.netCashProvidedByOperatingActivities),
        cacheDate: entry.date,
        source: "FMP cashFlow"
      };
    })
    .filter((row): row is FcfHistoryRow => row !== null);
}

function secCashFlowEntry(cache: InvestmentCache, ticker: string) {
  return cache.secCashFlow?.[ticker.toUpperCase()];
}

function secCashFlowHistoryForTicker(cache: InvestmentCache, ticker: string) {
  const entry = secCashFlowEntry(cache, ticker);
  if (!entry || entry.data.status !== "success") return [] as FcfHistoryRow[];
  return entry.data.annual_periods
    .map((period) => ({
      fiscalYear: period.fiscal_year,
      date: period.end,
      freeCashFlow: period.free_cash_flow,
      capitalExpenditure: period.capex,
      operatingCashFlow: period.operating_cash_flow,
      cacheDate: entry.date,
      source: "SEC EDGAR" as const,
      operatingConcept: period.operating_cash_flow_concept,
      capexConcept: period.capex_concept,
      capexSignAdjusted: period.capex_sign_adjusted,
      capexSignNote: period.capex_sign_note
    }))
    .filter((period) => Number.isFinite(period.freeCashFlow));
}

function combinedCashFlowHistoryForTicker(cache: InvestmentCache, ticker: string) {
  const fmpHistory = cashFlowHistoryForTicker(cache, ticker);
  if (fmpHistory.length) return fmpHistory;
  return secCashFlowHistoryForTicker(cache, ticker);
}

function applySecCashFlow(stock: StockRecord, result: SecCashFlowResult) {
  if (result.status !== "success" || !result.annual_periods.length) return stock;
  const latest = result.annual_periods[0];
  const prior = result.annual_periods[1];
  const timestamp = result.extracted_at ?? nowIso();
  const currentFcfSource = stock.field_audit?.free_cash_flow?.source;
  const preserveExistingFcf =
    Number.isFinite(stock.free_cash_flow)
    && (stock.free_cash_flow ?? 0) > 0
    && (currentFcfSource === "manual" || currentFcfSource === "FMP cash flow statement");
  const incoming: Partial<StockRecord> = {
    source: stock.source.includes("SEC EDGAR") ? stock.source : `${stock.source} + SEC EDGAR`,
    last_updated: timestamp,
    field_audit: { ...(stock.field_audit ?? {}) }
  };
  if (!preserveExistingFcf && Number.isFinite(latest.free_cash_flow)) {
    incoming.free_cash_flow = latest.free_cash_flow;
    setFieldAudit(incoming, "free_cash_flow", latest.free_cash_flow, "SEC EDGAR XBRL", timestamp);
  }
  if (
    Number.isFinite(latest.free_cash_flow)
    && prior
    && Number.isFinite(prior.free_cash_flow)
    && prior.free_cash_flow !== 0
  ) {
    incoming.fcf_growth_pct = ((latest.free_cash_flow - prior.free_cash_flow) / Math.abs(prior.free_cash_flow)) * 100;
    setFieldAudit(incoming, "fcf_growth_pct", incoming.fcf_growth_pct, "SEC EDGAR XBRL", timestamp);
  }
  const applySecFundamental = (key: keyof StockRecord, value: unknown) => {
    const parsed = finiteValue(value);
    if (parsed === null) return;
    const current = finiteValue(stock[key]);
    const currentSource = stock.field_audit?.[String(key)]?.source;
    const preserveExisting =
      current !== null
      && (currentSource === "manual" || String(currentSource ?? "").startsWith("FMP"));
    if (preserveExisting) return;
    (incoming as Record<string, unknown>)[key] = parsed;
    setFieldAudit(incoming, String(key), parsed, "SEC EDGAR XBRL", timestamp);
  };
  applySecFundamental("revenue_growth_pct", result.revenue_growth_pct);
  applySecFundamental("net_margin_pct", result.net_margin_pct);
  applySecFundamental("roe_pct", result.roe_pct);
  applySecFundamental("debt_to_equity", result.debt_to_equity);
  applySecFundamental("shares_outstanding", result.shares_outstanding);
  return mergeStock(stock, incoming);
}

function repairCachedSecCashFlows(stocks: StockRecord[], cache: InvestmentCache) {
  let changed = false;
  const repaired = stocks.map((stock) => {
    const result = secCashFlowEntry(cache, stock.ticker)?.data;
    if (!result || result.status !== "success") return stock;
    const next = applySecCashFlow(stock, result);
    if (
      next.free_cash_flow !== stock.free_cash_flow
      || next.fcf_growth_pct !== stock.fcf_growth_pct
      || next.field_audit?.free_cash_flow?.source !== stock.field_audit?.free_cash_flow?.source
    ) changed = true;
    return next;
  });
  return { stocks: repaired, changed };
}

function storeSecResponse(cache: InvestmentCache, response: SecCashFlowResponse) {
  const timestamp = response.fetched_at ?? nowIso();
  const secCashFlow = { ...(cache.secCashFlow ?? {}) };
  const secTickerCik = { ...(cache.secTickerCik ?? {}) };
  for (const result of response.results) {
    const ticker = result.ticker.toUpperCase();
    secCashFlow[ticker] = {
      date: todayKey(),
      timestamp,
      data: { ...result, extracted_at: result.extracted_at ?? timestamp }
    };
    if (result.cik) {
      secTickerCik[ticker] = {
        cik: result.cik,
        companyName: result.company_name ?? ticker,
        timestamp
      };
    }
  }
  return { ...cache, secCashFlow, secTickerCik } satisfies InvestmentCache;
}

function averageFcf(rows: FcfHistoryRow[], years: number) {
  if (rows.length < years) return null;
  return rows.slice(0, years).reduce((sum, row) => sum + row.freeCashFlow, 0) / years;
}

function fmpEndpointForTicker(capabilityId: FmpCapabilityId, ticker: string): FmpEndpoint {
  if (capabilityId === "quote") return fmpSingleSymbolEndpoint("quote", ticker);
  if (capabilityId === "profile") return fmpSingleSymbolEndpoint("profile", ticker);
  if (capabilityId === "ratios") return fmpSingleSymbolEndpoint("ratios-ttm", ticker);
  if (capabilityId === "income") return fmpSingleSymbolEndpoint("income-statement", ticker);
  if (capabilityId === "cashFlow") return fmpSingleSymbolEndpoint("cash-flow-statement", ticker);
  return fmpSingleSymbolEndpoint("historical-price-eod/full", ticker);
}

function cachedFmpEntry(cache: InvestmentCache, capabilityId: FmpCapabilityId, ticker: string) {
  return cache.fmp?.[fmpEndpointKey(fmpEndpointForTicker(capabilityId, ticker))];
}

function hasFmpRecords(cache: InvestmentCache, capabilityId: FmpCapabilityId, ticker: string) {
  const audit = fmpCacheAuditForEndpoint(cache, capabilityId, ticker);
  return audit?.category === "valid data cache" || audit?.category === "stale cache";
}

function coverageReasons(stock: StockRecord, analysis: StockAnalysis, cache: InvestmentCache) {
  const effectiveShares =
    stock.shares_outstanding && stock.shares_outstanding > 0
      ? stock.shares_outstanding
      : stock.current_price > 0 && stock.market_cap > 0
        ? stock.market_cap / stock.current_price
        : null;
  const cashFlowHistory = combinedCashFlowHistoryForTicker(cache, stock.ticker);
  return [
    !Number.isFinite(stock.current_price) || stock.current_price <= 0 ? "missing current price" : "",
    stock.free_cash_flow === null || !Number.isFinite(stock.free_cash_flow) || stock.free_cash_flow <= 0 ? "missing FCF" : "",
    !hasFmpRecords(cache, "historical", stock.ticker) ? "missing historical EOD" : "",
    !effectiveShares || effectiveShares <= 0 ? "missing shares outstanding" : "",
    !hasFmpRecords(cache, "income", stock.ticker) ? "missing income statement" : "",
    cashFlowHistory.length < 3 ? "missing 3-year FCF history" : "",
    !analysis.scoreReliable ? "insufficient real data" : ""
  ].filter(Boolean);
}

function coverageEndpointIds(stock: StockRecord, analysis: StockAnalysis, cache: InvestmentCache) {
  const reasons = coverageReasons(stock, analysis, cache);
  const endpointIds = new Set<FmpCapabilityId>();
  if (
    reasons.includes("missing shares outstanding") ||
    stock.market_cap <= 0 ||
    !stock.company_name ||
    stock.sector === "Unknown"
  ) endpointIds.add("profile");
  if (
    stock.pe_ratio === null ||
    stock.roe_pct === null ||
    stock.debt_to_equity === null ||
    analysis.realDataPercent < 70
  ) endpointIds.add("ratios");
  if (
    reasons.includes("missing income statement") ||
    stock.revenue_growth_pct === null ||
    stock.net_margin_pct === null
  ) endpointIds.add("income");
  if (
    reasons.includes("missing current price") ||
    reasons.includes("missing historical EOD") ||
    stock.volatility_pct === null ||
    stock.drawdown_52w_pct === null
  ) endpointIds.add("historical");
  return [...endpointIds];
}

const HYBRID_ENDPOINT_ORDER: FmpCapabilityId[] = ["profile", "historical", "income", "ratios"];

function orderedHybridEndpoints(endpointIds: FmpCapabilityId[]) {
  const selected = new Set<FmpCapabilityId>(endpointIds.filter((endpointId) => endpointId !== "cashFlow"));
  return HYBRID_ENDPOINT_ORDER.filter((endpointId) => selected.has(endpointId));
}

function validAuditSourceLabel(stock: StockRecord, field: string) {
  const audit = stockFieldAudit(stock, field);
  return audit.source === "missing" || audit.source === "fallback" ? "--" : audit.source;
}

function isFinancialSectorException(stock: StockRecord) {
  const text = `${stock.sector} ${stock.industry}`.toLowerCase();
  return /financial|bank|insurance|insurer|capital markets|credit services|asset management|mortgage/.test(text);
}

function hybridValidityChecklist(
  stock: StockRecord,
  analysis: StockAnalysis,
  cache: InvestmentCache
): HybridValidityChecklist {
  const priceAvailable = Number.isFinite(stock.current_price) && stock.current_price > 0;
  const directShares = Number.isFinite(stock.shares_outstanding) && (stock.shares_outstanding ?? 0) > 0;
  const derivedShares = priceAvailable && stock.market_cap > 0;
  const incomeEntry = cachedFmpEntry(cache, "income", stock.ticker);
  const manualIncomeAvailable =
    stock.field_audit?.revenue_growth_pct?.source === "manual"
    && stock.field_audit?.net_margin_pct?.source === "manual";
  const incomeAvailable =
    hasFmpRecords(cache, "income", stock.ticker)
    || (manualIncomeAvailable && (
      stock.revenue_growth_pct !== null
      && Number.isFinite(stock.revenue_growth_pct)
      && stock.net_margin_pct !== null
      && Number.isFinite(stock.net_margin_pct)
    ));
  const historicalEntry = cachedFmpEntry(cache, "historical", stock.ticker);
  const historicalAvailable = hasFmpRecords(cache, "historical", stock.ticker);
  const secEntry = secCashFlowEntry(cache, stock.ticker);
  const fcfAvailable =
    Number.isFinite(stock.free_cash_flow)
    && (stock.free_cash_flow ?? 0) > 0
    && combinedCashFlowHistoryForTicker(cache, stock.ticker).length >= 3;
  const fcfSource =
    secEntry?.data.status === "success"
      ? "SEC EDGAR XBRL"
      : validAuditSourceLabel(stock, "free_cash_flow");
  return {
    price: {
      available: priceAvailable,
      source: priceAvailable ? validAuditSourceLabel(stock, "current_price") : "--"
    },
    shares: {
      available: directShares || derivedShares,
      source: directShares
        ? validAuditSourceLabel(stock, "shares_outstanding")
        : derivedShares
          ? "derived from market cap / price"
          : "--"
    },
    incomeStatement: {
      available: incomeAvailable,
      source: hasFmpRecords(cache, "income", stock.ticker)
        ? `FMP income statement cache ${incomeEntry?.date ?? ""}`.trim()
        : manualIncomeAvailable
          ? "manual"
          : "--"
    },
    historicalEod: {
      available: historicalAvailable,
      source: historicalAvailable ? `FMP historical EOD cache ${historicalEntry?.date ?? ""}`.trim() : "--"
    },
    fcf: {
      available: fcfAvailable,
      source: fcfAvailable ? fcfSource : "--"
    },
    scenarioValid: analysis.valuation.scenarioValuation.decisionLabel !== "Insufficient Scenario Data"
  };
}

function scanSectorMatches(stock: StockRecord, sector: ScanPrioritySector) {
  const stockSector = stock.sector.toLowerCase();
  const industry = stock.industry.toLowerCase();
  if (sector === "Technology") return stockSector.includes("technology");
  if (sector === "Communication Services") return stockSector.includes("communication");
  if (sector === "Consumer Discretionary") return stockSector.includes("consumer cyclical") || stockSector.includes("consumer discretionary");
  if (sector === "Financials") return stockSector.includes("financial");
  if (sector === "Healthcare") return stockSector.includes("healthcare");
  if (sector === "Energy") return stockSector.includes("energy");
  if (sector === "Industrials") return stockSector.includes("industrial");
  return /semiconductor|artificial intelligence|\bai\b|data center|gpu|chip/.test(industry);
}

function modeSectorMatches(stock: StockRecord, mode: ScanPriorityMode) {
  if (mode === "Technology / AI First") {
    return scanSectorMatches(stock, "Technology")
      || scanSectorMatches(stock, "Communication Services")
      || scanSectorMatches(stock, "Semiconductors / AI");
  }
  if (mode === "Semiconductor First") return scanSectorMatches(stock, "Semiconductors / AI");
  if (mode === "Energy First") return scanSectorMatches(stock, "Energy");
  if (mode === "Financials First") return scanSectorMatches(stock, "Financials");
  return false;
}

function normalizedRangeScore(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return 0;
  if (maximum <= minimum) return value > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, ((value - minimum) / (maximum - minimum)) * 100));
}

function coverageRowsFor(
  analyses: StockAnalysis[],
  cache: InvestmentCache,
  watchlist: WatchlistItem[],
  settings: ScanPrioritySettings
) {
  const capabilities = capabilitiesFromCache(cache);
  const watchTickers = new Set(watchlist.map((item) => item.ticker.toUpperCase()));
  const manualTickers = manualPriorityTickers(settings.manualTickers);
  const manualRanks = new Map(manualTickers.map((ticker, index) => [ticker, index]));
  const candidates = analyses
    .filter((analysis) => analysis.valuation.scenarioValuation.decisionLabel === "Insufficient Scenario Data")
    .map((analysis) => {
      const stock = analysis.stock;
      const reasons = coverageReasons(stock, analysis, cache);
      const endpointIds = orderedHybridEndpoints(coverageEndpointIds(stock, analysis, cache));
      const endpointNeeds = endpointIds.map((id) => ({
        id,
        status:
          capabilities[id].status === "available"
            ? "available"
            : capabilities[id].status === "premium blocked"
              ? "blocked by plan"
              : "unknown"
      } satisfies CoverageEndpointNeed));
      const secFcfStatus: CoverageRow["secFcfStatus"] =
        secCashFlowEntry(cache, stock.ticker)?.data.status ?? "unknown";
      const checklist = hybridValidityChecklist(stock, analysis, cache);
      return {
        analysis,
        reasons,
        endpointIds,
        endpointNeeds,
        secFcfStatus,
        secFcfAvailable: secFcfStatus === "success" && checklist.fcf.available,
        hybridChecklist: checklist,
        financialSectorWarning: isFinancialSectorException(stock)
      };
    });
  const marketCapValues = candidates
    .map((row) => row.analysis.stock.market_cap > 0 ? Math.log10(row.analysis.stock.market_cap) : 0);
  const marketCapMinimum = Math.min(...marketCapValues, 0);
  const marketCapMaximum = Math.max(...marketCapValues, 1);
  const totalWeight = Math.max(1, Object.values(settings.weights).reduce((sum, weight) => sum + weight, 0));
  return candidates
    .map((row) => {
      const stock = row.analysis.stock;
      const ticker = stock.ticker.toUpperCase();
      const hardReasonCount = row.reasons.filter((reason) => reason !== "insufficient real data").length;
      const availableNeeds = row.endpointNeeds.filter((endpoint) => endpoint.status === "available");
      const unknownNeeds = row.endpointNeeds.filter((endpoint) => endpoint.status === "unknown");
      const blockedNeeds = row.endpointNeeds.filter((endpoint) => endpoint.status === "blocked by plan");
      const missingFcf =
        row.reasons.includes("missing FCF")
        || row.reasons.includes("missing 3-year FCF history");
      const hardBlockedNeeds = blockedNeeds;
      const requiresSecFallback = missingFcf && row.secFcfStatus === "unknown";
      const estimatedAvailableCalls = row.endpointNeeds.reduce((sum, endpoint) => {
        if (endpoint.status === "blocked by plan") return sum;
        const cacheAudit = fmpCacheAuditForEndpoint(cache, endpoint.id, ticker);
        return sum + (cacheAudit?.category === "valid data cache" ? 0 : 1);
      }, 0);
      const fcfUnavailableAfterSec =
        missingFcf
        && (row.secFcfStatus === "missing" || row.secFcfStatus === "error");
      const blockedFromValidity = hardBlockedNeeds.length > 0 || fcfUnavailableAfterSec;
      const fcfCoverageAvailable = row.hybridChecklist.fcf.available;
      const scannable =
        fcfCoverageAvailable
        && !blockedFromValidity
        && estimatedAvailableCalls > 0;
      const completionCriticalMissing = [
        row.hybridChecklist.price,
        row.hybridChecklist.shares,
        row.hybridChecklist.incomeStatement,
        row.hybridChecklist.historicalEod
      ].filter((field) => !field.available).length;
      const estimatedChancePct =
        requiresSecFallback ? 70 :
          row.financialSectorWarning ? 10 :
          !scannable ? 0 :
          unknownNeeds.length > 0 ? Math.max(25, 60 - unknownNeeds.length * 8 - hardReasonCount * 3) :
            Math.max(45, 96 - estimatedAvailableCalls * 8 - completionCriticalMissing * 5);
      const blockingReason =
        row.financialSectorWarning
          ? "DCF may not be suitable. Consider financial-sector valuation later."
          : blockedFromValidity
          ? fcfUnavailableAfterSec
            ? "Cannot make valid automatically because SEC FCF is missing or ambiguous."
            : `Cannot make valid automatically. Blocked or unresolved endpoint: ${hardBlockedNeeds.map((endpoint) => endpoint.id).join(", ")}.`
          : requiresSecFallback
            ? "FMP cashFlow is blocked. Run the free SEC EDGAR FCF fallback first."
          : !fcfCoverageAvailable
            ? "No FCF source is available yet. Run SEC EDGAR fallback or add FCF manually."
          : !scannable
            ? "No additional endpoint request is available today. Review cached data or use a manual fix."
            : unknownNeeds.length
              ? `Capability unknown: ${unknownNeeds.map((endpoint) => endpoint.id).join(", ")}.`
              : "";
      const preferredSector = settings.preferredSectors.some((sector) => scanSectorMatches(stock, sector));
      const marketCapScore = normalizedRangeScore(
        stock.market_cap > 0 ? Math.log10(stock.market_cap) : 0,
        marketCapMinimum,
        marketCapMaximum
      );
      const componentScores: Record<keyof ScanPriorityWeights, number> = {
        marketCap: marketCapScore,
        dataCoverage: row.analysis.realDataPercent,
        watchlist: watchTickers.has(ticker) ? 100 : 0,
        sectorPreference: preferredSector ? 100 : 0,
        missingFields: Math.max(0, 100 - hardReasonCount * 15),
        quality: row.analysis.breakdown.quality,
        valuation: row.analysis.breakdown.valuation,
        risk: row.analysis.breakdown.risk
      };
      const weightedScore = (Object.entries(settings.weights) as Array<[keyof ScanPriorityWeights, number]>)
        .reduce((sum, [key, weight]) => sum + componentScores[key] * weight, 0) / totalWeight;
      let priorityScore = weightedScore;
      if (settings.mode === "Make Valid Fastest") {
        priorityScore =
          !scannable ? 0 :
            unknownNeeds.length > 0 ? Math.max(25, 65 - estimatedAvailableCalls * 5) :
              Math.max(35, 100 - estimatedAvailableCalls * 8 + row.analysis.realDataPercent * 0.12);
      }
      if (settings.mode === "Complete SEC-FCF Stocks First") {
        priorityScore =
          row.financialSectorWarning ? 0 :
            !row.secFcfAvailable ? 5 :
              !scannable ? 15 :
                Math.max(35, 110 - estimatedAvailableCalls * 14 - completionCriticalMissing * 6);
      }
      if (settings.mode === "Largest Market Cap") priorityScore = marketCapScore * 0.75 + weightedScore * 0.25;
      if (settings.mode === "Highest Existing Data Coverage") priorityScore = row.analysis.realDataPercent * 0.75 + weightedScore * 0.25;
      if (settings.mode === "Watchlist First") priorityScore = componentScores.watchlist * 0.75 + weightedScore * 0.25;
      if (["Technology / AI First", "Semiconductor First", "Energy First", "Financials First"].includes(settings.mode)) {
        priorityScore = (modeSectorMatches(stock, settings.mode) ? 100 : 0) * 0.75 + weightedScore * 0.25;
      }
      if (settings.mode === "Lowest Valuation First") priorityScore = row.analysis.breakdown.valuation * 0.75 + weightedScore * 0.25;
      if (settings.mode === "Highest Quality First") priorityScore = row.analysis.breakdown.quality * 0.75 + weightedScore * 0.25;
      const manualRank = manualRanks.get(ticker);
      if (manualRank !== undefined) priorityScore = Math.max(priorityScore, 100 - Math.min(40, manualRank));

      const reasonParts: string[] = [];
      if (manualRank !== undefined) reasonParts.push(`Manual order #${manualRank + 1}`);
      if (watchTickers.has(ticker)) reasonParts.push("Watchlist");
      if (marketCapScore >= 70) reasonParts.push("Large cap");
      if (row.analysis.realDataPercent >= 70) reasonParts.push(`${row.analysis.realDataPercent}% existing data`);
      if (preferredSector) reasonParts.push("Preferred sector");
      if (scanSectorMatches(stock, "Semiconductors / AI")) reasonParts.push("Semiconductor / AI");
      if (hardReasonCount <= 3) reasonParts.push(`Missing only ${hardReasonCount} field${hardReasonCount === 1 ? "" : "s"}`);
      if (row.analysis.breakdown.quality >= 70) reasonParts.push("High quality");
      if (row.analysis.breakdown.valuation >= 70) reasonParts.push("Low valuation");
      if (!blockedNeeds.length && !unknownNeeds.length && availableNeeds.length) reasonParts.push(`${estimatedAvailableCalls} available call${estimatedAvailableCalls === 1 ? "" : "s"}`);
      if (unknownNeeds.length) reasonParts.push(`${unknownNeeds.length} unknown endpoint${unknownNeeds.length === 1 ? "" : "s"}`);
      if (blockedNeeds.length) reasonParts.push(`${blockedNeeds.length} blocked endpoint${blockedNeeds.length === 1 ? "" : "s"}`);
      if (requiresSecFallback) reasonParts.push("SEC FCF fallback");
      if (row.secFcfAvailable) reasonParts.push("SEC FCF available");
      if (row.financialSectorWarning) reasonParts.push("Financial-sector DCF exception");
      if (!reasonParts.length) reasonParts.push(`${settings.mode} weighted ranking`);
      return {
        ...row,
        priorityScore: Math.round(Math.max(0, Math.min(100, priorityScore))),
        priorityReason: reasonParts.slice(0, 4).join(" + "),
        estimatedChancePct: Math.round(estimatedChancePct),
        blockingReason,
        scannable,
        blockedFromValidity,
        requiresSecFallback,
        secFcfAvailable: row.secFcfAvailable,
        secFcfStatus: row.secFcfStatus,
        estimatedAvailableCalls
      } satisfies CoverageRow;
    })
    .sort((left, right) => {
      if (settings.mode === "Make Valid Fastest" && left.blockedFromValidity !== right.blockedFromValidity) {
        return left.blockedFromValidity ? 1 : -1;
      }
      if (settings.mode === "Complete SEC-FCF Stocks First" && left.secFcfAvailable !== right.secFcfAvailable) {
        return left.secFcfAvailable ? -1 : 1;
      }
      if (settings.mode === "Complete SEC-FCF Stocks First" && left.financialSectorWarning !== right.financialSectorWarning) {
        return left.financialSectorWarning ? 1 : -1;
      }
      if (left.scannable !== right.scannable) return left.scannable ? -1 : 1;
      const leftManual = manualRanks.get(left.analysis.stock.ticker.toUpperCase());
      const rightManual = manualRanks.get(right.analysis.stock.ticker.toUpperCase());
      if (leftManual !== undefined || rightManual !== undefined) {
        if (leftManual === undefined) return 1;
        if (rightManual === undefined) return -1;
        return leftManual - rightManual;
      }
      return right.priorityScore - left.priorityScore || right.analysis.stock.market_cap - left.analysis.stock.market_cap;
    });
}

function validScenarioTickerSet(
  stocks: StockRecord[],
  cache: InvestmentCache,
  portfolio: ReturnType<typeof portfolioSummary>,
  assumptions: DcfAssumptions,
  scenarioProbabilities: ScenarioProbabilities
) {
  return new Set(
    stocks
      .filter((stock) => {
        const analysis = analyzeStock(stock, portfolio, assumptions, {
          normalizedFcf3y: averageFcf(combinedCashFlowHistoryForTicker(cache, stock.ticker), 3),
          scenarioProbabilities
        });
        return analysis.valuation.scenarioValuation.decisionLabel !== "Insufficient Scenario Data";
      })
      .map((stock) => stock.ticker.toUpperCase())
  );
}

function buildCoverageScanPreview(
  coverageRows: CoverageRow[],
  batchSize: number,
  cache: InvestmentCache,
  capabilities: Record<FmpCapabilityId, FmpCapabilityResult>,
  settings: ScanPrioritySettings
) {
  const selectedRows = coverageRows.filter((row) => row.scannable).slice(0, batchSize);
  const displayRows = selectedRows.length ? selectedRows : coverageRows.slice(0, batchSize);
  const selectedTickers = new Set(selectedRows.map((row) => row.analysis.stock.ticker));
  const selectedUnknownIds = new Set(
    selectedRows.flatMap((row) => row.endpointNeeds.filter((endpoint) => endpoint.status === "unknown").map((endpoint) => endpoint.id))
  );
  const capabilityTestIds = FMP_CAPABILITY_DEFINITIONS
    .filter((definition) => selectedUnknownIds.has(definition.id) && capabilities[definition.id].status === "untested")
    .map((definition) => definition.id);
  const rows = displayRows.map((row) => {
    const ticker = row.analysis.stock.ticker;
    const missingEndpoints = row.endpointIds.map((id) => {
      const capability = capabilities[id];
      if (capability.status === "premium blocked") {
        return { id, status: "blocked by plan", estimatedCalls: 0, cacheCategory: "premium blocked cache" } satisfies CoverageScanEndpointPlan;
      }
      const cacheAudit = fmpCacheAuditForEndpoint(cache, id, ticker);
      if (cacheAudit?.category === "valid data cache") {
        return { id, status: "valid cache hit", estimatedCalls: 0, cacheCategory: cacheAudit.category } satisfies CoverageScanEndpointPlan;
      }
      if (cacheAudit?.category === "empty cache") {
        return { id, status: "empty cache", estimatedCalls: 1, cacheCategory: cacheAudit.category } satisfies CoverageScanEndpointPlan;
      }
      if (cacheAudit?.category === "failed cache") {
        return { id, status: "failed cache", estimatedCalls: 1, cacheCategory: cacheAudit.category } satisfies CoverageScanEndpointPlan;
      }
      if (cacheAudit?.category === "stale cache") {
        return { id, status: "needs refetch", estimatedCalls: 1, cacheCategory: cacheAudit.category } satisfies CoverageScanEndpointPlan;
      }
      if (cacheAudit?.category === "premium blocked cache") {
        return { id, status: "blocked by plan", estimatedCalls: 0, cacheCategory: cacheAudit.category } satisfies CoverageScanEndpointPlan;
      }
      if (capability.status === "available" || capability.status === "error") {
        return { id, status: "needs refetch", estimatedCalls: 1, cacheCategory: "missing" } satisfies CoverageScanEndpointPlan;
      }
      if (capability.status === "untested") {
        return { id, status: "capability test + request", estimatedCalls: 1, cacheCategory: "missing" } satisfies CoverageScanEndpointPlan;
      }
      return { id, status: "unavailable", estimatedCalls: 0, cacheCategory: "missing" } satisfies CoverageScanEndpointPlan;
    });
    const unavailable = missingEndpoints.filter((endpoint) => endpoint.status === "unavailable");
    const blocked = missingEndpoints.filter((endpoint) => endpoint.status === "blocked by plan");
    const repairableCache = missingEndpoints.filter(
      (endpoint) => endpoint.status === "empty cache" || endpoint.status === "failed cache"
    );
    const estimatedCalls = selectedTickers.has(ticker)
      ? missingEndpoints.reduce((sum, endpoint) => sum + endpoint.estimatedCalls, 0)
      : 0;
    const hardReasonCount = row.reasons.filter((reason) => reason !== "insufficient real data").length;
    let likelihood: CoverageScanLikelihood = row.estimatedChancePct >= 70 ? "High" : row.estimatedChancePct >= 30 ? "Medium" : "Low";
    let likelihoodReason = "Required endpoints are available, but several missing fields still need to map successfully.";
    if (row.financialSectorWarning) {
      likelihood = "Low";
      likelihoodReason = "DCF may not be suitable. Consider financial-sector valuation later.";
    } else if (!missingEndpoints.length) {
      likelihood = "Low";
      likelihoodReason = "No additional FMP endpoint can currently resolve the remaining missing data.";
    } else if (blocked.length) {
      likelihood = "Low";
      likelihoodReason = row.blockingReason || `Blocked by plan: ${blocked.map((endpoint) => endpoint.id).join(", ")}.`;
    } else if (unavailable.length) {
      likelihood = "Low";
      likelihoodReason = `Blocked or unavailable endpoints: ${unavailable.map((endpoint) => endpoint.id).join(", ")}.`;
    } else if (repairableCache.length) {
      likelihoodReason = `Bad cache entries will be refetched: ${repairableCache.map((endpoint) => `${endpoint.id} (${endpoint.status})`).join(", ")}.`;
    } else if (hardReasonCount <= 3) {
      likelihood = "High";
      likelihoodReason = "Only a small number of addressable fields are missing and all required endpoints can be used.";
    }
    return {
      ticker,
      priorityScore: row.priorityScore,
      priorityReason: row.priorityReason,
      estimatedChancePct: row.estimatedChancePct,
      blockingReason: row.blockingReason,
      missingEndpoints,
      estimatedCalls,
      secFcfAvailable: row.secFcfAvailable,
      likelihood,
      likelihoodReason
    } satisfies CoverageScanPreviewRow;
  });
  const endpointCalls = rows
    .filter((row) => selectedTickers.has(row.ticker))
    .reduce((sum, row) => sum + row.estimatedCalls, 0);
  const estimatedCalls = capabilityTestIds.length + endpointCalls;
  const safeRemaining = safeFmpRemaining(cache);
  const likelyRows = rows
    .filter((row) => row.estimatedChancePct >= 30)
    .sort((left, right) => {
      const rank = { High: 2, Medium: 1, Low: 0 };
      return rank[right.likelihood] - rank[left.likelihood] || left.estimatedCalls - right.estimatedCalls;
    });
  return {
    batchSize,
    priorityMode: settings.mode,
    selectedSymbols: selectedRows.map((row) => row.analysis.stock.ticker),
    rows,
    capabilityTestIds,
    estimatedCalls,
    safeRemaining,
    isSafe: estimatedCalls <= safeRemaining,
    likelyValidSymbols: likelyRows.slice(0, 10).map((row) => row.ticker),
    createdAt: nowIso()
  } satisfies CoverageScanPreview;
}

function scannedTickersToday(cache: InvestmentCache) {
  const today = todayKey();
  const tickers = new Set<string>();
  for (const [key, entry] of Object.entries(cache.fmp ?? {})) {
    if (entry.date !== today) continue;
    cacheKeySymbols(key).forEach((ticker) => tickers.add(ticker));
  }
  return tickers;
}

function rawRecordSymbol(record: Record<string, unknown>) {
  return String(record.symbol ?? record.ticker ?? "").toUpperCase();
}

function endpointRecordsForTicker(definition: FmpInspectorEndpointDefinition, cacheKey: string, data: unknown, ticker: string) {
  const rows = definition.id === "historical" ? historicalArray(data) : recordArray(data);
  if (definition.id === "historical") return cacheKeySymbols(cacheKey).includes(ticker) ? rows : [];
  const matchingRows = rows.filter((row) => rawRecordSymbol(row) === ticker);
  if (matchingRows.length) return matchingRows;
  const hasSymbols = rows.some((row) => rawRecordSymbol(row));
  return !hasSymbols && cacheKeySymbols(cacheKey).includes(ticker) ? rows : [];
}

function buildFmpRawPayloadViews(cache: InvestmentCache, ticker: string): FmpRawPayloadView[] {
  return FMP_INSPECTOR_ENDPOINTS.map((definition) => {
    const candidates = Object.entries(cache.fmp ?? {})
      .filter(([cacheKey]) => cacheKeyPath(cacheKey) === definition.path)
      .map(([cacheKey, entry]) => ({
        cacheKey,
        cacheDate: entry.date,
        records: endpointRecordsForTicker(definition, cacheKey, entry.data, ticker),
        relevant: cacheKeySymbols(cacheKey).includes(ticker)
      }))
      .filter((entry) => entry.relevant || entry.records.length)
      .sort((left, right) => {
        const leftExact = cacheKeySymbols(left.cacheKey).length === 1 ? 1 : 0;
        const rightExact = cacheKeySymbols(right.cacheKey).length === 1 ? 1 : 0;
        return rightExact - leftExact || right.cacheDate.localeCompare(left.cacheDate);
      });
    const selected = candidates[0];
    if (!selected) {
      return {
        id: definition.id,
        label: definition.label,
        cacheKey: "",
        cacheDate: "",
        records: [],
        keys: [],
        mappedFields: [],
        unmappedFields: [],
        snippet: ""
      };
    }
    const keys = [...new Set(selected.records.slice(0, 10).flatMap((record) => Object.keys(record)))].sort();
    const mappedFields = keys
      .filter((key) => definition.mappedKeys[key])
      .map((key) => `${key} -> ${definition.mappedKeys[key]}`);
    const unmappedFields = keys.filter((key) => !definition.mappedKeys[key]);
    const snippetRows = selected.records.slice(0, definition.id === "historical" ? 3 : 2);
    const snippet = JSON.stringify(snippetRows, null, 2).slice(0, 4000);
    return {
      id: definition.id,
      label: definition.label,
      cacheKey: selected.cacheKey,
      cacheDate: selected.cacheDate,
      records: selected.records,
      keys,
      mappedFields,
      unmappedFields,
      snippet
    };
  });
}

function normalizedRawValue(value: unknown): number | string | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) return value;
  return null;
}

function findRawMetricValue(
  views: FmpRawPayloadView[],
  endpointIds: FmpInspectorEndpointId[],
  keys: string[],
  fallbackPattern?: RegExp
) {
  for (const endpointId of endpointIds) {
    const view = views.find((item) => item.id === endpointId);
    if (!view) continue;
    for (const record of view.records) {
      for (const key of keys) {
        const rawValue = normalizedRawValue(record[key]);
        if (rawValue !== null) return { endpoint: view.label, key, rawValue };
      }
      if (fallbackPattern) {
        const key = Object.keys(record).find((candidate) => fallbackPattern.test(candidate));
        const rawValue = key ? normalizedRawValue(record[key]) : null;
        if (key && rawValue !== null) return { endpoint: view.label, key, rawValue };
      }
    }
  }
  return null;
}

function derivedGrowthValue(view: FmpRawPayloadView | undefined, key: string) {
  if (!view) return { found: false, value: null as number | null };
  const values = sortFinancialPeriods(view.records).map((record) => finiteValue(record[key])).filter((value): value is number => value !== null);
  if (!values.length) return { found: false, value: null as number | null };
  if (values.length < 2 || values[1] === 0) return { found: true, value: null as number | null };
  return { found: true, value: ((values[0] - values[1]) / Math.abs(values[1])) * 100 };
}

function fmpMetricMappedValue(stock: StockRecord | undefined, field: keyof StockRecord) {
  const audit = stockFieldAudit(stock, String(field));
  const mapped = audit.source !== "missing" && audit.source !== "fallback" && audit.source !== "manual" && audit.rawValue !== null;
  return { mapped, value: mapped ? audit.rawValue : null };
}

function hasFmpMappingRule(endpointLabel: string | undefined, sourceKey: string | undefined) {
  if (!endpointLabel || !sourceKey) return false;
  const definition = FMP_INSPECTOR_ENDPOINTS.find((endpoint) => endpoint.label === endpointLabel);
  return Boolean(definition?.mappedKeys[sourceKey]);
}

function buildFmpMetricDiagnostics(stock: StockRecord | undefined, views: FmpRawPayloadView[]): FmpMetricDiagnostic[] {
  const mapped = (field: keyof StockRecord) => fmpMetricMappedValue(stock, field);
  const simpleDiagnostic = (
    label: string,
    stockField: keyof StockRecord,
    endpointIds: FmpInspectorEndpointId[],
    keys: string[],
    pattern?: RegExp
  ): FmpMetricDiagnostic => {
    const raw = findRawMetricValue(views, endpointIds, keys, pattern);
    const mappedResult = mapped(stockField);
    return {
      label,
      stockField,
      sourceKey: raw?.key ?? "--",
      sourceEndpoint: raw?.endpoint ?? "--",
      found: Boolean(raw),
      mappingRule: hasFmpMappingRule(raw?.endpoint, raw?.key),
      stored: mappedResult.mapped,
      rawValue: raw?.rawValue ?? null,
      mappedValue: mappedResult.value
    };
  };

  const revenueFromRatios = findRawMetricValue(views, ["ratios"], ["revenueGrowthTTM"], /revenue.*growth|growth.*revenue/i);
  const incomeGrowth = derivedGrowthValue(views.find((item) => item.id === "income"), "revenue");
  const revenueMapped = mapped("revenue_growth_pct");
  const revenueDiagnostic: FmpMetricDiagnostic = {
    label: "Revenue Growth",
    stockField: "revenue_growth_pct",
    sourceKey: revenueFromRatios?.key ?? (incomeGrowth.found ? "revenue (derived from two periods)" : "--"),
    sourceEndpoint: revenueFromRatios?.endpoint ?? (incomeGrowth.found ? "Income Statement" : "--"),
    found: Boolean(revenueFromRatios) || incomeGrowth.found,
    mappingRule: revenueFromRatios
      ? hasFmpMappingRule(revenueFromRatios.endpoint, revenueFromRatios.key)
      : incomeGrowth.found,
    stored: revenueMapped.mapped,
    rawValue: revenueFromRatios?.rawValue ?? incomeGrowth.value,
    mappedValue: revenueMapped.value
  };

  const fcfDirect = findRawMetricValue(
    views,
    ["profile", "ratios", "income", "historical"],
    ["freeCashFlowGrowth", "freeCashFlowGrowthTTM", "growthFreeCashFlow"],
    /free.*cash.*flow.*growth|growth.*free.*cash.*flow/i
  );
  const fcfIncomeGrowth = derivedGrowthValue(views.find((item) => item.id === "income"), "freeCashFlow");
  const fcfMapped = mapped("fcf_growth_pct");
  const fcfDiagnostic: FmpMetricDiagnostic = {
    label: "FCF Growth",
    stockField: "fcf_growth_pct",
    sourceKey: fcfDirect?.key ?? (fcfIncomeGrowth.found ? "freeCashFlow (derived from two periods)" : "--"),
    sourceEndpoint: fcfDirect?.endpoint ?? (fcfIncomeGrowth.found ? "Income Statement" : "--"),
    found: Boolean(fcfDirect) || fcfIncomeGrowth.found,
    mappingRule: fcfDirect ? hasFmpMappingRule(fcfDirect.endpoint, fcfDirect.key) : false,
    stored: fcfMapped.mapped,
    rawValue: fcfDirect?.rawValue ?? fcfIncomeGrowth.value,
    mappedValue: fcfMapped.value
  };

  return [
    simpleDiagnostic("PE", "pe_ratio", ["profile", "ratios"], ["pe", "peRatio", "trailingPE", "peRatioTTM", "priceToEarningsRatioTTM"], /price.*earnings|^pe.*ratio/i),
    simpleDiagnostic("ROE", "roe_pct", ["ratios", "profile"], ["returnOnEquityTTM", "returnOnEquityRatioTTM", "returnOnEquity", "roe", "roeTTM"], /return.*equity|^roe/i),
    revenueDiagnostic,
    simpleDiagnostic("Dividend Yield", "dividend_yield_pct", ["ratios", "profile"], ["dividendYieldTTM", "dividendYielTTM", "dividendYield"], /dividend.*yield|yield.*dividend/i),
    fcfDiagnostic
  ];
}

type FmpBundleKey = "quote" | "profile" | "ratios" | "income" | "balance" | "cashFlow" | "historical";
const FMP_USABLE_STOCK_FIELDS: Array<keyof StockRecord> = [
  "company_name",
  "sector",
  "industry",
  "current_price",
  "historical_close",
  "market_cap",
  "pe_ratio",
  "revenue_growth_pct",
  "fcf_growth_pct",
  "net_margin_pct",
  "free_cash_flow",
  "debt_to_equity",
  "roe_pct",
  "dividend_yield_pct",
  "volatility_pct",
  "drawdown_52w_pct",
  "shares_outstanding",
  "price_to_sales",
  "ev_to_ebitda"
];

function usableStockFingerprint(stock: StockRecord) {
  return JSON.stringify(FMP_USABLE_STOCK_FIELDS.map((field) => stock[field]));
}

function applyFmpData(
  stock: StockRecord,
  data: Partial<Record<FmpBundleKey, unknown>>,
  sources: Partial<Record<FmpBundleKey, InvestmentDataSource>> = {},
  timestamps: Partial<Record<FmpBundleKey, string>> = {}
) {
  const profile = firstArrayItem(data.profile);
  const quote = firstArrayItem(data.quote);
  const ratios = firstArrayItem(data.ratios);
  const incomeRows = sortFinancialPeriods(recordArray(data.income));
  const income = incomeRows[0];
  const priorIncome = incomeRows[1];
  const balance = firstArrayItem(data.balance);
  const cashFlow = firstArrayItem(data.cashFlow);
  const history = historicalMetrics(data.historical);
  const timestamp = nowIso();
  const incoming: Partial<StockRecord> = {
    company_name: String(profile?.companyName ?? stock.company_name),
    sector: String(profile?.sector ?? stock.sector),
    industry: String(profile?.industry ?? stock.industry),
    source: "FMP + Local/Manual",
    last_updated: timestamp
  };

  const setAuditedNumber = (field: keyof StockRecord, value: unknown, source: InvestmentDataSource | undefined, sourceTimestamp = timestamp) => {
    const parsed = finiteValue(value);
    if (parsed === null || !source) return;
    (incoming as Record<string, unknown>)[field] = parsed;
    setFieldAudit(incoming, String(field), parsed, source, sourceTimestamp);
  };

  const firstAvailable = (...candidates: Array<{ value: unknown; source?: InvestmentDataSource; timestamp?: string }>) =>
    candidates.find((candidate) => finiteValue(candidate.value) !== null && candidate.source);

  const priceCandidate = firstAvailable(
    { value: quote?.price, source: sources.quote, timestamp: timestamps.quote },
    { value: profile?.price, source: sources.profile, timestamp: timestamps.profile },
    { value: history.current_price, source: sources.historical, timestamp: timestamps.historical }
  );
  setAuditedNumber("current_price", priceCandidate?.value, priceCandidate?.source, priceCandidate?.timestamp);

  const marketCapCandidate = firstAvailable(
    { value: quote?.marketCap, source: sources.quote, timestamp: timestamps.quote },
    { value: profile?.mktCap ?? profile?.marketCap, source: sources.profile, timestamp: timestamps.profile }
  );
  setAuditedNumber("market_cap", marketCapCandidate?.value, marketCapCandidate?.source, marketCapCandidate?.timestamp);

  const peCandidate = firstAvailable(
    { value: quote?.pe, source: sources.quote, timestamp: timestamps.quote },
    { value: ratios?.priceToEarningsRatioTTM, source: sources.ratios, timestamp: timestamps.ratios },
    { value: ratios?.peRatioTTM, source: sources.ratios, timestamp: timestamps.ratios }
  );
  setAuditedNumber("pe_ratio", peCandidate?.value, peCandidate?.source, peCandidate?.timestamp);

  const sharesCandidate = firstAvailable(
    { value: quote?.sharesOutstanding, source: sources.quote, timestamp: timestamps.quote },
    { value: profile?.sharesOutstanding, source: sources.profile, timestamp: timestamps.profile }
  );
  setAuditedNumber("shares_outstanding", sharesCandidate?.value, sharesCandidate?.source, sharesCandidate?.timestamp);

  setAuditedNumber("roe_pct", finiteValue(ratios?.returnOnEquityTTM) !== null ? Number(ratios?.returnOnEquityTTM) * 100 : null, sources.ratios, timestamps.ratios);
  setAuditedNumber("dividend_yield_pct", finiteValue(ratios?.dividendYieldTTM ?? ratios?.dividendYielTTM) !== null ? Number(ratios?.dividendYieldTTM ?? ratios?.dividendYielTTM) * 100 : null, sources.ratios, timestamps.ratios);
  setAuditedNumber("debt_to_equity", ratios?.debtEquityRatioTTM ?? ratios?.debtToEquityRatioTTM, sources.ratios, timestamps.ratios);
  setAuditedNumber("price_to_sales", ratios?.priceToSalesRatioTTM, sources.ratios, timestamps.ratios);
  setAuditedNumber("ev_to_ebitda", ratios?.enterpriseValueMultipleTTM, sources.ratios, timestamps.ratios);

  const ratioRevenueGrowth = finiteValue(ratios?.revenueGrowthTTM);
  const currentRevenue = finiteValue(income?.revenue);
  const priorRevenue = finiteValue(priorIncome?.revenue);
  const revenueGrowth = ratioRevenueGrowth !== null
    ? ratioRevenueGrowth * 100
    : currentRevenue !== null && priorRevenue !== null && priorRevenue !== 0
      ? ((currentRevenue - priorRevenue) / Math.abs(priorRevenue)) * 100
      : null;
  setAuditedNumber("revenue_growth_pct", revenueGrowth, ratioRevenueGrowth !== null ? sources.ratios : sources.income, ratioRevenueGrowth !== null ? timestamps.ratios : timestamps.income);

  const ratioMargin = finiteValue(ratios?.netProfitMarginTTM);
  const netIncome = finiteValue(income?.netIncome);
  const netMargin = ratioMargin !== null
    ? ratioMargin * 100
    : currentRevenue !== null && currentRevenue !== 0 && netIncome !== null
      ? (netIncome / currentRevenue) * 100
      : null;
  setAuditedNumber("net_margin_pct", netMargin, ratioMargin !== null ? sources.ratios : sources.income, ratioMargin !== null ? timestamps.ratios : timestamps.income);

  const fcf = finiteValue(cashFlow?.freeCashFlow);
  setAuditedNumber("free_cash_flow", fcf, sources.cashFlow, timestamps.cashFlow);
  setAuditedNumber("fcf_growth_pct", fcfGrowthFromCashFlow(data.cashFlow), sources.cashFlow, timestamps.cashFlow);

  const totalDebt = finiteValue(balance?.totalDebt);
  const totalEquity = finiteValue(balance?.totalStockholdersEquity);
  if (incoming.debt_to_equity === undefined && totalDebt !== null && totalEquity !== null && totalEquity !== 0) {
    setAuditedNumber("debt_to_equity", totalDebt / totalEquity, sources.balance, timestamps.balance);
  }

  setAuditedNumber("drawdown_52w_pct", history.drawdown_52w_pct, sources.historical, timestamps.historical);
  setAuditedNumber("volatility_pct", history.volatility_pct, sources.historical, timestamps.historical);
  if (history.current_price !== null && sources.historical) {
    setAuditedNumber("historical_close", history.current_price, sources.historical, timestamps.historical);
    setFieldAudit(incoming, "historical_close", history.current_price, sources.historical, timestamps.historical ?? timestamp, false);
  }

  return mergeStock(stock, incoming);
}

function repairStockFromFmpCache(stock: StockRecord, cache: InvestmentCache) {
  const views = buildFmpRawPayloadViews(cache, stock.ticker.toUpperCase());
  const ratiosView = views.find((view) => view.id === "ratios");
  const incomeView = views.find((view) => view.id === "income");
  const historicalView = views.find((view) => view.id === "historical");
  const ratios = ratiosView?.records[0];
  const incomeRows = sortFinancialPeriods(incomeView?.records ?? []);
  const historical = historicalMetrics(historicalView?.records ?? []);
  const next: StockRecord = {
    ...stock,
    field_audit: { ...(stock.field_audit ?? {}) }
  };
  const repairedFields: string[] = [];

  const persist = (field: keyof StockRecord, value: unknown, timestamp: string, affectedScore = SCORE_FIELD_KEYS.has(String(field))) => {
    const parsed = finiteValue(value);
    if (parsed === null) return;
    const current = finiteValue((next as unknown as Record<string, unknown>)[String(field)]);
    const audit = next.field_audit?.[String(field)];
    const auditIsPersisted = audit?.source === "cache" && finiteValue(audit.rawValue) === parsed;
    if (current === parsed && auditIsPersisted) return;
    (next as unknown as Record<string, unknown>)[String(field)] = parsed;
    setFieldAudit(next, String(field), parsed, "cache", timestamp, affectedScore);
    repairedFields.push(String(field));
  };

  const ratiosTimestamp = ratiosView?.cacheDate ? `${ratiosView.cacheDate}T00:00:00.000Z` : nowIso();
  const incomeTimestamp = incomeView?.cacheDate ? `${incomeView.cacheDate}T00:00:00.000Z` : nowIso();
  const historicalTimestamp = historicalView?.cacheDate ? `${historicalView.cacheDate}T00:00:00.000Z` : nowIso();

  persist("pe_ratio", ratios?.priceToEarningsRatioTTM ?? ratios?.peRatioTTM, ratiosTimestamp);
  const dividendYield = finiteValue(ratios?.dividendYieldTTM ?? ratios?.dividendYielTTM);
  persist("dividend_yield_pct", dividendYield === null ? null : dividendYield * 100, ratiosTimestamp);

  const currentRevenue = finiteValue(incomeRows[0]?.revenue);
  const priorRevenue = finiteValue(incomeRows[1]?.revenue);
  if (currentRevenue !== null && priorRevenue !== null && priorRevenue !== 0) {
    persist("revenue_growth_pct", ((currentRevenue - priorRevenue) / Math.abs(priorRevenue)) * 100, incomeTimestamp);
  }
  persist("historical_close", historical.current_price, historicalTimestamp, false);

  if (repairedFields.length) {
    next.source = stock.source.includes("FMP") ? stock.source : "FMP cache + Local/Manual";
    next.last_updated = nowIso();
  }
  return { stock: next, repairedFields };
}

function mappingSnapshot(stock: StockRecord | undefined, assumptions: DcfAssumptions): FmpMappingSnapshot {
  if (!stock) {
    return {
      peRatio: null,
      revenueGrowth: null,
      dividendYield: null,
      historicalClose: null,
      peVsIndustry: null,
      peg: null,
      revenueGrowthScore: null,
      realDataPercent: null,
      fallbackPercent: null
    };
  }
  const analysis = analyzeStock(stock, portfolioSummary([], 0), assumptions);
  return {
    peRatio: stock.pe_ratio,
    revenueGrowth: stock.revenue_growth_pct,
    dividendYield: stock.dividend_yield_pct,
    historicalClose: stock.historical_close,
    peVsIndustry: analysis.breakdown.peVsIndustry,
    peg: analysis.valuation.pegRatio,
    revenueGrowthScore: analysis.breakdown.revenueGrowth,
    realDataPercent: analysis.realDataPercent,
    fallbackPercent: analysis.fallbackPercent
  };
}

function repairCachedFmpMappings(stocks: StockRecord[], cache: InvestmentCache, assumptions: DcfAssumptions) {
  const beforeByTicker = new Map(stocks.map((stock) => [stock.ticker.toUpperCase(), stock]));
  const repairs = new Map<string, string[]>();
  const repairedStocks = stocks.map((stock) => {
    const repaired = repairStockFromFmpCache(stock, cache);
    if (repaired.repairedFields.length) repairs.set(stock.ticker.toUpperCase(), repaired.repairedFields);
    return repaired.stock;
  });
  const afterByTicker = new Map(repairedStocks.map((stock) => [stock.ticker.toUpperCase(), stock]));
  const comparisons = FMP_AUDIT_TICKERS.map((ticker) => ({
    ticker,
    before: mappingSnapshot(beforeByTicker.get(ticker), assumptions),
    after: mappingSnapshot(afterByTicker.get(ticker), assumptions),
    fixedFields: repairs.get(ticker) ?? []
  }));
  return { stocks: repairedStocks, comparisons, changed: repairs.size > 0 };
}

function fairValueUpperFromDcf(analysis: StockAnalysis, dcfFairValue: number | null) {
  if (dcfFairValue === null || !Number.isFinite(dcfFairValue) || dcfFairValue <= 0) return null;
  const values = [
    dcfFairValue,
    analysis.stock.target_buy_price > 0 ? analysis.stock.target_buy_price / 0.85 : null
  ].filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);
  if (!values.length) return null;
  return (values.reduce((sum, value) => sum + value, 0) / values.length) * 1.15;
}

function premiumAboveDcfFairValuePct(analysis: StockAnalysis, dcfFairValue: number | null) {
  const fairValueUpper = fairValueUpperFromDcf(analysis, dcfFairValue);
  if (fairValueUpper === null || !Number.isFinite(fairValueUpper) || fairValueUpper <= 0) return null;
  const currentPrice = analysis.stock.current_price;
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return null;
  return ((currentPrice - fairValueUpper) / fairValueUpper) * 100;
}

function fairValuePremiumPct(analysis: StockAnalysis) {
  return premiumAboveDcfFairValuePct(analysis, analysis.valuation.dcfFairValue);
}

function hasMeasurableScenarioRiskReward(analysis: StockAnalysis) {
  const scenario = analysis.valuation.scenarioValuation;
  return scenario.downsideRisk !== null
    && Number.isFinite(scenario.downsideRisk)
    && scenario.downsideRisk > 0
    && scenario.upsidePotential !== null
    && Number.isFinite(scenario.upsidePotential)
    && scenario.upsidePotential > 0
    && scenario.riskRewardRatio !== null
    && Number.isFinite(scenario.riskRewardRatio);
}

function scenarioRiskRewardReviewReason(analysis: StockAnalysis) {
  const scenario = analysis.valuation.scenarioValuation;
  if (scenario.downsideRisk === null) return "Downside to Bear Case is missing.";
  if (scenario.downsideRisk <= 0) return "Bear fair value is at or above current price, so modeled downside is not measurable.";
  if (scenario.upsidePotential === null) return "Upside to Bull Case is missing.";
  if (scenario.upsidePotential <= 0) return "Bull fair value does not provide positive modeled upside.";
  if (scenario.riskRewardRatio === null || !Number.isFinite(scenario.riskRewardRatio)) return "Risk/reward ratio could not be calculated from positive upside and downside.";
  return "Scenario metrics need review.";
}

function buildRankingAuditRows(
  rankings: {
    top: StockAnalysis[];
    reliable: StockAnalysis[];
    incomplete: StockAnalysis[];
    value: StockAnalysis[];
    quality: StockAnalysis[];
    lowRisk: StockAnalysis[];
    highRisk: StockAnalysis[];
    avoid: StockAnalysis[];
    wait: StockAnalysis[];
  },
  labels: {
    top: string;
    reliable: string;
    incomplete: string;
    value: string;
    quality: string;
    lowRisk: string;
    highRisk: string;
    avoid: string;
    wait: string;
  }
) {
  const rows: RankingAuditRow[] = [];
  const append = (
    section: string,
    analyses: StockAnalysis[],
    sortMetric: string,
    metricValue: (analysis: StockAnalysis) => string,
    rankSource: string
  ) => {
    analyses.forEach((analysis, index) => {
      rows.push({
        section,
        rank: index + 1,
        stock: analysis.stock.ticker,
        sortMetric,
        metricValue: metricValue(analysis),
        rankSource
      });
    });
  };

  append(labels.top, rankings.top, "Final score DESC", (analysis) => `${analysis.totalScore}`, "Buy/Strong Buy + reliable data");
  append(labels.reliable, rankings.reliable, "Final score DESC", (analysis) => `${analysis.totalScore}`, "Reliable candidates");
  append(labels.incomplete, rankings.incomplete, "Real data % DESC, Base score DESC", (analysis) => `${analysis.realDataPercent}% / ${analysis.baseScore}`, "Incomplete or insufficient data");
  append(labels.value, rankings.value, "Valuation score DESC", (analysis) => `${analysis.breakdown.valuation}`, "Valuation breakdown");
  append(labels.quality, rankings.quality, "Quality score DESC", (analysis) => `${analysis.breakdown.quality}`, "Quality breakdown");
  append(labels.lowRisk, rankings.lowRisk, "Risk safety score DESC", (analysis) => `${analysis.breakdown.risk}`, "Complete volatility, drawdown, and debt risk data");
  append(labels.highRisk, rankings.highRisk, "Risk safety score ASC", (analysis) => `${analysis.breakdown.risk}`, "Inverse of Lowest Risk");
  append(labels.wait, rankings.wait, "Premium above fair value upper DESC", (analysis) => `${comparisonValue(fairValuePremiumPct(analysis), "%")}`, "Current price > fair value upper");
  append(labels.avoid, rankings.avoid, "Final score DESC", (analysis) => `${analysis.totalScore}`, "Recommendation label = Avoid");
  return rows;
}

export function InvestmentLab() {
  const [language, setLanguage] = useState<Language>("en");
  const [activeTab, setActiveTab] = useState<InvestmentTab>("overview");
  const [stocks, setStocks] = useState<StockRecord[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [allocation, setAllocation] = useState<AllocationPlan>(defaultAllocation());
  const [assumptions, setAssumptions] = useState<DcfAssumptions>(defaultDcfAssumptions());
  const [scenarioProbabilities, setScenarioProbabilities] = useState<ScenarioProbabilities>(defaultScenarioProbabilities());
  const [draft, setDraft] = useState<StockRecord>(emptyStock());
  const [holdingDraft, setHoldingDraft] = useState<Holding>({ id: uid("holding"), ticker: "", shares: 0, average_cost: 0, current_price: 0, sector: "Technology", risk_label: "Medium Risk" });
  const [watchDraft, setWatchDraft] = useState<WatchlistItem>({ id: uid("watch"), ticker: "", target_buy_price: 0, reason: "", risk_level: "Medium Risk", notes: "", last_updated: nowIso() });
  const [status, setStatus] = useState("Local storage ready");
  const [fmpTestStatus, setFmpTestStatus] = useState("");
  const [fmpCapabilities, setFmpCapabilities] = useState<Record<FmpCapabilityId, FmpCapabilityResult>>(defaultFmpCapabilities());
  const [cacheInfo, setCacheInfo] = useState<InvestmentCache>({});
  const [mappingComparisons, setMappingComparisons] = useState<FmpMappingComparisonRow[]>([]);
  const [coverageManualDrafts, setCoverageManualDrafts] = useState<Record<string, CoverageManualDraft>>({});
  const [scanPrioritySettings, setScanPrioritySettings] = useState<ScanPrioritySettings>(defaultScanPrioritySettings());
  const [scanRoiHistory, setScanRoiHistory] = useState<ScanRoiBatch[]>([]);
  const [coverageScanPreview, setCoverageScanPreview] = useState<CoverageScanPreview | null>(null);
  const [cacheRepairSummary, setCacheRepairSummary] = useState<FmpCacheRepairSummary | null>(null);
  const [secInspectorTicker, setSecInspectorTicker] = useState("AAPL");
  const [busy, setBusy] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [autoLocalScanRequested, setAutoLocalScanRequested] = useState(false);
  const runLocalStage1Ref = useRef<(() => Promise<StockRecord[]>) | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLanguage(getStoredLanguage());
    const storedTab = window.localStorage.getItem(INVESTMENT_TAB_KEY) as InvestmentTab | null;
    if (storedTab && INVESTMENT_TABS.some((tab) => tab.id === storedTab)) setActiveTab(storedTab);
    const url = new URL(window.location.href);
    if (url.searchParams.get("autoscan") === "local") {
      setActiveTab("scanner");
      window.localStorage.setItem(INVESTMENT_TAB_KEY, "scanner");
      url.searchParams.delete("autoscan");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      setAutoLocalScanRequested(true);
    }
    const storedStocks = readJson<StockRecord[]>(STOCKS_KEY, []);
    setHoldings(readJson<Holding[]>(HOLDINGS_KEY, []));
    setWatchlist(readJson<WatchlistItem[]>(WATCHLIST_KEY, []));
    setAllocation(readJson<AllocationPlan>(ALLOCATION_KEY, defaultAllocation()));
    setScanPrioritySettings(normalizeScanPrioritySettings(readJson<ScanPrioritySettings>(SCAN_PRIORITY_SETTINGS_KEY, defaultScanPrioritySettings())));
    setScanRoiHistory(readJson<ScanRoiBatch[]>(SCAN_ROI_HISTORY_KEY, []));
    const storedAssumptions = readJson<DcfAssumptions>(ASSUMPTIONS_KEY, defaultDcfAssumptions());
    setAssumptions(storedAssumptions);
    setScenarioProbabilities(readJson<ScenarioProbabilities>(SCENARIO_PROBABILITIES_KEY, defaultScenarioProbabilities()));
    const cache = normalizeFmpDailyUsage(getCache());
    setCache(cache);
    const repaired = repairCachedFmpMappings(storedStocks, cache, storedAssumptions);
    const secRepaired = repairCachedSecCashFlows(repaired.stocks, cache);
    setStocks(secRepaired.stocks);
    if (repaired.changed || secRepaired.changed) {
      writeJson(STOCKS_KEY, secRepaired.stocks);
      writeJson(FMP_MAPPING_COMPARISON_KEY, repaired.comparisons);
      setMappingComparisons(repaired.comparisons);
    } else {
      setMappingComparisons(readJson<FmpMappingComparisonRow[]>(FMP_MAPPING_COMPARISON_KEY, repaired.comparisons));
    }
    setCacheInfo(cache);
    setFmpCapabilities(capabilitiesFromCache(cache));
    void backendIsOnline().then((online) => {
      if (cancelled) return;
      setBackendOnline(online);
      if (!online) setStatus(BACKEND_OFFLINE_MESSAGE);
    });
    function handleLanguageChange(event: Event) {
      setLanguage((event as CustomEvent<Language>).detail ?? getStoredLanguage());
    }
    window.addEventListener("fabio-language-change", handleLanguageChange);
    return () => {
      cancelled = true;
      window.removeEventListener("fabio-language-change", handleLanguageChange);
    };
  }, []);

  const t = copy[language === "zh" ? "zh" : "en"];
  const portfolio = useMemo(() => portfolioSummary(holdings, allocation.portfolio_cash), [allocation.portfolio_cash, holdings]);
  const normalizedFcfByTicker = useMemo(() => new Map(
    stocks.map((stock) => [
      stock.ticker.toUpperCase(),
      averageFcf(combinedCashFlowHistoryForTicker(cacheInfo, stock.ticker), 3)
    ])
  ), [cacheInfo, stocks]);
  const analyses = useMemo(
    () => stocks
      .map((stock) => analyzeStock(stock, portfolio, assumptions, {
        normalizedFcf3y: normalizedFcfByTicker.get(stock.ticker.toUpperCase()) ?? null,
        scenarioProbabilities
      }))
      .sort((a, b) => b.totalScore - a.totalScore),
    [assumptions, normalizedFcfByTicker, portfolio, scenarioProbabilities, stocks]
  );
  const broadScan = useMemo(
    () => broadScanCandidates(stocks, portfolio, assumptions, normalizedFcfByTicker, scenarioProbabilities),
    [assumptions, normalizedFcfByTicker, portfolio, scenarioProbabilities, stocks]
  );
  const coverageRows = useMemo(
    () => coverageRowsFor(analyses, cacheInfo, watchlist, scanPrioritySettings),
    [analyses, cacheInfo, scanPrioritySettings, watchlist]
  );
  const secCoverageRows = coverageRows
    .filter((row) =>
      (row.reasons.includes("missing FCF") || row.reasons.includes("missing 3-year FCF history"))
      && !row.secFcfAvailable
    )
    .sort((left, right) =>
      right.analysis.realDataPercent - left.analysis.realDataPercent
      || left.reasons.length - right.reasons.length
      || right.analysis.stock.market_cap - left.analysis.stock.market_cap
    );
  const secCoverageStats = cacheInfo.secCoverageStats ?? {
    requestsMade: 0,
    cacheHits: 0,
    extractionSuccesses: 0,
    extractionFailures: 0,
    stocksMadeValid: 0,
    lastRunAt: "",
    lastRunSymbols: []
  };
  const validScenarioCount = analyses.length - coverageRows.length;
  const coverageDistribution = [
    { label: "0-25%", count: analyses.filter((analysis) => analysis.realDataPercent <= 25).length },
    { label: "26-50%", count: analyses.filter((analysis) => analysis.realDataPercent > 25 && analysis.realDataPercent <= 50).length },
    { label: "51-75%", count: analyses.filter((analysis) => analysis.realDataPercent > 50 && analysis.realDataPercent <= 75).length },
    { label: "76-100%", count: analyses.filter((analysis) => analysis.realDataPercent > 75).length }
  ];
  const reconciledQuota = normalizeFmpDailyUsage(cacheInfo);
  const dailyFmpCalls = reconciledQuota.fmpCalls ?? 0;
  const officialFmpUsed = reconciledQuota.officialFmpUsed ?? dailyFmpCalls;
  const officialFmpLimit = reconciledQuota.officialFmpLimit ?? 250;
  const fmpSafetyBuffer = reconciledQuota.fmpSafetyBuffer ?? 10;
  const remainingFmpQuota = safeFmpRemaining(reconciledQuota);
  const fmpAttemptStats = reconciledQuota.fmpAttemptStats ?? defaultFmpAttemptStats();
  const permanentlyBlockedEndpointIds = Object.keys(reconciledQuota.fmpPremiumBlocked ?? {}) as FmpCapabilityId[];
  const fmpCacheAudit = useMemo(() => auditFmpCaches(cacheInfo), [cacheInfo]);
  const scannedToday = scannedTickersToday(cacheInfo);
  const pendingCoverageCalls = coverageRows.filter((row) => row.scannable).reduce((sum, row) => sum + row.endpointIds.filter((endpointId) => {
    if (fmpCapabilities[endpointId]?.status === "premium blocked") return false;
    const audit = fmpCacheAuditForEndpoint(cacheInfo, endpointId, row.analysis.stock.ticker);
    return audit?.category !== "valid data cache";
  }).length, 0);
  const estimatedCoverageDays =
    pendingCoverageCalls <= 0
      ? 0
      : pendingCoverageCalls <= remainingFmpQuota
        ? 1
        : 1 + Math.ceil((pendingCoverageCalls - remainingFmpQuota) / Math.max(1, officialFmpLimit - fmpSafetyBuffer));
  const stale = analyses.some((analysis) => isStale(analysis.stock.last_updated));
  const scenarioProbabilitiesValid = scenarioProbabilitiesAreValid(scenarioProbabilities);
  const effectiveScenarioProbabilities = scenarioProbabilitiesValid ? scenarioProbabilities : defaultScenarioProbabilities();
  const todaysScanRoiBatches = scanRoiHistory.filter((batch) => batch.localDate === todayKey());
  const todaysScanRoi = scanRoiSummary(todaysScanRoiBatches);
  const lastScanRoiBatch = scanRoiHistory[0] ?? null;
  const modeRoiRows = priorityModeRoi(scanRoiHistory);
  const bestPriorityModeRoi = modeRoiRows[0] ?? null;
  const worstPriorityModeRoi = modeRoiRows.length ? modeRoiRows[modeRoiRows.length - 1] : null;
  const lifetimeScanRoi = scanRoiSummary(scanRoiHistory);
  const analyzeRowsForCache = (stockRows: StockRecord[], cache: InvestmentCache) => {
    const normalizedByTicker = new Map(
      stockRows.map((stock) => [
        stock.ticker.toUpperCase(),
        averageFcf(combinedCashFlowHistoryForTicker(cache, stock.ticker), 3)
      ])
    );
    return stockRows
      .map((stock) => analyzeStock(stock, portfolio, assumptions, {
        normalizedFcf3y: normalizedByTicker.get(stock.ticker.toUpperCase()) ?? null,
        scenarioProbabilities
      }))
      .sort((a, b) => b.totalScore - a.totalScore);
  };
  const coverageRowsForCache = (stockRows: StockRecord[], cache: InvestmentCache) =>
    coverageRowsFor(analyzeRowsForCache(stockRows, cache), cache, watchlist, scanPrioritySettings);

  function saveStocks(next: StockRecord[]) {
    setStocks(next);
    writeJson(STOCKS_KEY, next);
  }

  function changeActiveTab(tab: InvestmentTab) {
    setActiveTab(tab);
    window.localStorage.setItem(INVESTMENT_TAB_KEY, tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveHoldings(next: Holding[]) {
    setHoldings(next);
    writeJson(HOLDINGS_KEY, next);
  }

  function saveWatchlist(next: WatchlistItem[]) {
    setWatchlist(next);
    writeJson(WATCHLIST_KEY, next);
  }

  function saveAllocation(next: AllocationPlan) {
    setAllocation(next);
    writeJson(ALLOCATION_KEY, next);
  }

  function saveAssumptions(next: DcfAssumptions) {
    setAssumptions(next);
    writeJson(ASSUMPTIONS_KEY, next);
  }

  function saveScenarioProbabilities(next: ScenarioProbabilities) {
    setScenarioProbabilities(next);
    writeJson(SCENARIO_PROBABILITIES_KEY, next);
  }

  function saveScanPrioritySettings(next: ScanPrioritySettings) {
    const normalized = normalizeScanPrioritySettings(next);
    setScanPrioritySettings(normalized);
    writeJson(SCAN_PRIORITY_SETTINGS_KEY, normalized);
    setCoverageScanPreview(null);
  }

  function saveScanRoiBatch(batch: ScanRoiBatch) {
    setScanRoiHistory((current) => {
      const next = [batch, ...current].slice(0, 500);
      writeJson(SCAN_ROI_HISTORY_KEY, next);
      return next;
    });
  }

  function saveFmpQuotaReconciliation(fields: Partial<Pick<InvestmentCache, "officialFmpUsed" | "officialFmpLimit" | "fmpSafetyBuffer">>) {
    const current = normalizeFmpDailyUsage(getCache());
    const next = {
      ...current,
      ...fields,
      officialFmpUsageDate: todayKey(),
      officialFmpUsed: Math.max(0, fields.officialFmpUsed ?? current.officialFmpUsed ?? 0),
      officialFmpLimit: Math.max(1, fields.officialFmpLimit ?? current.officialFmpLimit ?? 250),
      fmpSafetyBuffer: Math.max(0, fields.fmpSafetyBuffer ?? current.fmpSafetyBuffer ?? 10)
    };
    setCache(next);
    setCacheInfo(next);
    setCoverageScanPreview(null);
  }

  function resetFmpDailyUsage() {
    const current = normalizeFmpDailyUsage(getCache());
    const next = {
      ...current,
      fmpUsageDate: todayKey(),
      fmpCalls: 0,
      fmpAttemptStats: defaultFmpAttemptStats(),
      officialFmpUsageDate: todayKey(),
      officialFmpUsed: 0
    };
    setCache(next);
    setCacheInfo(next);
    setCoverageScanPreview(null);
    setStatus("FMP daily usage counters were manually reset for the local date.");
  }

  function repairFmpCaches(action: FmpCacheRepairSummary["action"]) {
    const current = normalizeFmpDailyUsage(getCache());
    const repaired = repairFmpCacheEntries(current, action);
    const nextCoverageRows = coverageRowsFor(analyses, repaired.cache, watchlist, scanPrioritySettings);
    const nextRecommendedBatch = nextCoverageRows
      .filter((row) => row.scannable)
      .slice(0, 5)
      .map((row) => row.analysis.stock.ticker);
    const summary: FmpCacheRepairSummary = {
      repairedAt: nowIso(),
      action,
      emptyCachesFound: repaired.emptyCachesFound,
      failedCachesFound: repaired.failedCachesFound,
      cachesCleared: repaired.selected.length,
      symbolsAffected: [...new Set(repaired.selected.flatMap((row) => row.symbols))].sort(),
      endpointsAffected: [...new Set(repaired.selected.map((row) => row.capabilityId ?? cacheKeyPath(row.cacheKey)))].sort(),
      nextRecommendedBatch
    };
    setCache(repaired.cache);
    setCacheInfo(repaired.cache);
    setFmpCapabilities(capabilitiesFromCache(repaired.cache));
    setCoverageScanPreview(null);
    setCacheRepairSummary(summary);
    setStatus(
      `FMP cache repair cleared ${summary.cachesCleared} ${action} cache entr${summary.cachesCleared === 1 ? "y" : "ies"}. `
      + "Valid FMP caches, premium-blocked endpoint memory, SEC FCF cache, and quota counters were preserved."
    );
  }

  function saveFmpCapabilities(next: Record<FmpCapabilityId, FmpCapabilityResult>) {
    const cache = getCache();
    const blockedMemory = premiumBlockMemoryFromCache(cache);
    const protectedNext = { ...next };
    for (const definition of FMP_CAPABILITY_DEFINITIONS) {
      const blocked = blockedMemory[definition.id];
      if (!blocked) continue;
      protectedNext[definition.id] = {
        id: definition.id,
        label: definition.label,
        status: "premium blocked",
        httpStatus: blocked.httpStatus,
        preview: blocked.message,
        testedAt: blocked.lastBlockedAt
      };
    }
    setFmpCapabilities(protectedNext);
    const nextCache = { ...cache, fmpCapabilities: protectedNext, fmpPremiumBlocked: blockedMemory };
    setCache(nextCache);
    setCacheInfo(nextCache);
  }

  function updateFmpCapability(result: FmpCapabilityResult) {
    if (result.status === "premium blocked") {
      const blockedCache = rememberPremiumBlocked(getCache(), result.id, result.preview || "Premium blocked by current FMP plan.", result.httpStatus ?? 402);
      const next = capabilitiesFromCache(blockedCache);
      setFmpCapabilities(next);
      setCacheInfo(blockedCache);
      return next;
    }
    const next = { ...capabilitiesFromCache(getCache()), [result.id]: result };
    saveFmpCapabilities(next);
    return next;
  }

  function saveStock(event: FormEvent) {
    event.preventDefault();
    const normalized = withManualFieldAudit({ ...draft, ticker: draft.ticker.toUpperCase(), last_updated: nowIso(), source: "Manual" });
    const existing = stocks.find((stock) => stock.id === normalized.id || stock.ticker === normalized.ticker);
    const next = existing ? stocks.map((stock) => stock.id === existing.id ? { ...normalized, id: existing.id } : stock) : [normalized, ...stocks];
    saveStocks(next);
    setDraft(emptyStock());
  }

  async function ensureBackendOnline() {
    const online = await backendIsOnline();
    setBackendOnline(online);
    if (!online) setStatus(BACKEND_OFFLINE_MESSAGE);
    return online;
  }

  function saveHolding(event: FormEvent) {
    event.preventDefault();
    if (!holdingDraft.ticker.trim()) return;
    saveHoldings([{ ...holdingDraft, id: uid("holding"), ticker: holdingDraft.ticker.toUpperCase() }, ...holdings]);
    setHoldingDraft({ id: uid("holding"), ticker: "", shares: 0, average_cost: 0, current_price: 0, sector: "Technology", risk_label: "Medium Risk" });
  }

  function saveWatch(event: FormEvent) {
    event.preventDefault();
    if (!watchDraft.ticker.trim()) return;
    saveWatchlist([{ ...watchDraft, id: uid("watch"), ticker: watchDraft.ticker.toUpperCase(), last_updated: nowIso() }, ...watchlist]);
    setWatchDraft({ id: uid("watch"), ticker: "", target_buy_price: 0, reason: "", risk_level: "Medium Risk", notes: "", last_updated: nowIso() });
  }

  async function runLocalStage1() {
    setBusy(true);
    try {
      const tickers = [...new Set([...DEFAULT_UNIVERSE, ...stocks.map((stock) => stock.ticker), ...watchlist.map((item) => item.ticker)].filter(Boolean))];
      let next = mergeStockRows(stocks, localUniverseRows(stocks));
      let statusText = `Loaded local stock universe: ${DEFAULT_UNIVERSE.length} tickers.`;

      if (allocation.fmp_api_key.trim() && safeFmpRemaining(getCache()) > 0) {
        const capabilities = await ensureFmpCapabilities();
        const fmpResult = await fetchFmpStage1(tickers, allocation.fmp_api_key.trim(), capabilities, updateFmpCapability);
        next = mergeStockRows(next, fmpResult.rows);
        const finalCapabilities = capabilitiesFromCache(getCache());
        const blockedMessage = blockedCapabilityMessage(finalCapabilities);
        statusText = `FMP-free-plan Stage 1 completed: local universe loaded, ${fmpResult.rows.length} FMP records enriched, ${fmpResult.calls} new FMP calls used today.`;
        if (fmpResult.usedAvailableOnly || blockedMessage) statusText += ` ${blockedMessage || "Investment Lab used available FMP data only."}`;
      } else if (!allocation.fmp_api_key.trim()) {
        statusText += " No FMP key found. Manual metrics input is available; data reliability remains Low until price, PE, FCF, debt, and revenue growth are filled.";
      } else {
        statusText += " FMP enrichment skipped because safe remaining calls are zero. Local universe loading still completed.";
      }

      saveStocks(next);
      const finalCache = getCache();
      setCacheInfo(finalCache);
      setFmpCapabilities(capabilitiesFromCache(finalCache));
      setStatus(statusText);
      return next;
    } catch (error) {
      const next = mergeStockRows(stocks, localUniverseRows(stocks));
      saveStocks(next);
      const finalCache = getCache();
      setCacheInfo(finalCache);
      setFmpCapabilities(capabilitiesFromCache(finalCache));
      setStatus(error instanceof Error ? `Loaded local universe, but FMP Stage 1 failed. ${error.message}` : "Loaded local universe, but FMP Stage 1 failed.");
      return next;
    } finally {
      setBusy(false);
    }
  }
  runLocalStage1Ref.current = runLocalStage1;

  useEffect(() => {
    if (!autoLocalScanRequested) return;
    setAutoLocalScanRequested(false);
    setStatus("One-click local scan started. Loading the local universe and available cached/FMP-free-plan data...");
    void runLocalStage1Ref.current?.();
  }, [autoLocalScanRequested]);

  async function runExperimentalYahooFallback() {
    if (!(await ensureBackendOnline())) return;
    setBusy(true);
    try {
      const tickers = [...new Set([...stocks.map((stock) => stock.ticker), ...watchlist.map((item) => item.ticker), ...DEFAULT_UNIVERSE].filter(Boolean))].slice(0, 120);
      const quoteResult = await fetchYahooQuotes(tickers);
      const quotes = quoteResult.rows;
      const next = mergeStockRows(stocks, quotes);
      saveStocks(next);
      setStatus(
        quoteResult.fromCache
          ? `Experimental Yahoo fallback failed. Using local Yahoo cache: ${quotes.length} quotes loaded. ${quoteResult.errorMessage ?? ""}`
          : `Experimental Yahoo fallback completed through backend proxy: ${quotes.length} quotes loaded.`
      );
    } catch (error) {
      setStatus(error instanceof Error ? `Experimental Yahoo fallback failed. ${error.message}` : "Experimental Yahoo fallback failed. No local Yahoo cache available.");
    } finally {
      setBusy(false);
    }
  }

  async function testFmpApiKey(showBusy = true, onlyUntested = false, requiredIds?: Set<FmpCapabilityId>) {
    const apiKey = allocation.fmp_api_key.trim();
    if (!apiKey) {
      setFmpTestStatus("Enter an FMP API key first.");
      return fmpCapabilities;
    }
    if (showBusy) setBusy(true);
    let cacheState = getCache();
    const remembered = capabilitiesFromCache(cacheState);
    const next = onlyUntested ? { ...remembered } : { ...defaultFmpCapabilities() };
    try {
      for (const definition of FMP_CAPABILITY_DEFINITIONS) {
        if (requiredIds && !requiredIds.has(definition.id)) {
          next[definition.id] = remembered[definition.id];
          continue;
        }
        if (remembered[definition.id].status === "premium blocked") {
          next[definition.id] = remembered[definition.id];
          continue;
        }
        if (onlyUntested && next[definition.id].status !== "untested") continue;
        const tested = await testFmpCapabilityDefinition(definition, apiKey, cacheState);
        cacheState = tested.cache;
        next[definition.id] = tested.result;
        if (tested.result.status === "premium blocked") {
          cacheState = rememberPremiumBlocked(cacheState, definition.id, tested.result.preview, tested.result.httpStatus ?? 402);
          next[definition.id] = capabilitiesFromCache(cacheState)[definition.id];
        }
      }
      saveFmpCapabilities(next);
      const available = Object.values(next).filter((item) => item.status === "available").length;
      const blocked = Object.values(next).filter((item) => item.status === "premium blocked").length;
      setFmpTestStatus(`FMP capability test finished for key ${maskApiKey(apiKey)}: ${available} available, ${blocked} premium blocked.`);
      return next;
    } catch (error) {
      setFmpTestStatus(error instanceof Error ? maskFmpText(error.message, apiKey) : "FMP key test failed.");
      return capabilitiesFromCache(getCache());
    } finally {
      if (showBusy) setBusy(false);
    }
  }

  async function ensureFmpCapabilities(requiredIds?: Set<FmpCapabilityId>) {
    const current = capabilitiesFromCache(getCache());
    const needsTest = FMP_CAPABILITY_DEFINITIONS.some((definition) =>
      (!requiredIds || requiredIds.has(definition.id)) && current[definition.id].status === "untested"
    );
    if (needsTest) {
      return testFmpApiKey(false, true, requiredIds);
    }
    return current;
  }

  function previewCoverageBatch(batchSize: number) {
    if (!allocation.fmp_api_key.trim()) {
      setStatus(t.noKey);
      return;
    }
    const cache = normalizeFmpDailyUsage(getCache());
    const preview = buildCoverageScanPreview(coverageRows, batchSize, cache, capabilitiesFromCache(cache), scanPrioritySettings);
    setCacheInfo(cache);
    setCoverageScanPreview(preview);
    if (!preview.selectedSymbols.length) {
      const reason = !stocks.length
        ? "No stocks are loaded yet. Run Free/Local Stage 1 first."
        : !coverageRows.length
          ? "No insufficient-data stocks are currently queued. Review Data Coverage or load more data."
          : "Insufficient-data stocks exist, but none are currently scannable with the current plan/cache state.";
      setStatus(`Make Valid preview has 0 selected symbols. ${reason}`);
      return;
    }
    setStatus(
      `Make Valid preview created for ${preview.selectedSymbols.length} stocks. `
      + `${preview.estimatedCalls} calls estimated; ${preview.safeRemaining} safe calls remain. Confirm the preview before any request is sent.`
    );
    requestAnimationFrame(() => {
      document.getElementById("make-valid-scan-preview")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  async function confirmCoverageBatch() {
    if (!coverageScanPreview) return;
    const cache = normalizeFmpDailyUsage(getCache());
    const refreshed = buildCoverageScanPreview(coverageRows, coverageScanPreview.batchSize, cache, capabilitiesFromCache(cache), scanPrioritySettings);
    const selectionChanged = refreshed.selectedSymbols.join(",") !== coverageScanPreview.selectedSymbols.join(",");
    const budgetChanged =
      refreshed.estimatedCalls !== coverageScanPreview.estimatedCalls ||
      refreshed.safeRemaining !== coverageScanPreview.safeRemaining;
    if (selectionChanged || budgetChanged) {
      setCacheInfo(cache);
      setCoverageScanPreview(refreshed);
      setStatus("The queue or quota changed after the preview was created. Review the refreshed preview and confirm again.");
      return;
    }
    if (!refreshed.isSafe) {
      setStatus("Scan not started. Estimated calls exceed the current safe remaining calls.");
      return;
    }
    await runCoverageBatch(refreshed.batchSize, refreshed.selectedSymbols, refreshed);
  }

  async function runCoverageBatch(
    batchSize: number,
    selectedSymbols?: string[],
    scanPreview?: CoverageScanPreview,
    coverageRowsOverride = coverageRows,
    stockBase = stocks
  ) {
    if (!allocation.fmp_api_key.trim()) {
      setStatus(t.noKey);
      return;
    }
    if (safeFmpRemaining(getCache()) <= 0) {
      setStatus("FMP safe remaining calls are zero. Update the official FMP dashboard usage or safety buffer before scanning.");
      return;
    }
    setBusy(true);
    const roiBeforeCache = normalizeFmpDailyUsage(getCache());
    const roiBeforeStats = roiBeforeCache.fmpAttemptStats ?? defaultFmpAttemptStats();
    const validBefore = validScenarioTickerSet(stockBase, roiBeforeCache, portfolio, assumptions, effectiveScenarioProbabilities);
    let cacheState: InvestmentCache = roiBeforeCache;
    let updated = [...stockBase];
    let calls = 0;
    let usedAvailableOnly = false;
    const scannedSymbols: string[] = [];
    let quotaStopped = false;
    const endpointRoi = defaultEndpointRoi();
    try {
      const selectedCoverageRows = selectedSymbols !== undefined
        ? selectedSymbols
          .map((ticker) => coverageRowsOverride.find((row) => row.analysis.stock.ticker === ticker))
          .filter((row): row is CoverageRow => Boolean(row))
        : coverageRowsOverride.filter((row) => row.scannable).slice(0, batchSize);
      const requiredCapabilityIds = new Set(
        selectedCoverageRows.flatMap((row) => row.endpointIds)
      );
      const capabilitiesBefore = capabilitiesFromCache(getCache());
      let capabilities = await ensureFmpCapabilities(requiredCapabilityIds);
      cacheState = getCache();
      for (const capabilityId of requiredCapabilityIds) {
        if (capabilitiesBefore[capabilityId].status !== "untested" || capabilities[capabilityId].status === "untested") continue;
        const endpointStats = endpointRoi[capabilityId];
        endpointStats.calls += 1;
        if (capabilities[capabilityId].status === "available") {
          endpointStats.successfulCalls += 1;
          endpointStats.callsNoUsableData += 1;
        } else if (capabilities[capabilityId].status === "premium blocked") {
          endpointStats.premiumBlockedCalls += 1;
        } else {
          endpointStats.failedCalls += 1;
        }
      }
      const pull = async (capabilityId: FmpCapabilityId, endpoint: FmpEndpoint) => {
        const capability = capabilities[capabilityId];
        if (capability.status === "premium blocked" || capability.status === "untested") {
          usedAvailableOnly = true;
          return null;
        }
        const liveCache = getCache();
        const cached = liveCache.fmp?.[fmpEndpointKey(endpoint)];
        const cachedAudit = cached ? classifyFmpCacheEntry(fmpEndpointKey(endpoint), cached) : null;
        const canUseCached =
          cachedAudit?.category === "valid data cache"
          || cachedAudit?.category === "stale cache";
        if (safeFmpRemaining(liveCache) <= 0 && !canUseCached) {
          quotaStopped = true;
          return null;
        }
        try {
          const response = await fmpFetch(endpoint, allocation.fmp_api_key, cacheState);
          cacheState = response.cache;
          if (capability.status === "error" && response.attemptResult === "success") {
            capabilities = updateFmpCapability({
              ...capability,
              status: "available",
              httpStatus: 200,
              preview: "Endpoint refetch succeeded after a previous failure.",
              testedAt: nowIso()
            });
          }
          if (response.attempted) {
            calls += 1;
            endpointRoi[capabilityId].calls += 1;
            if (response.attemptResult === "success") endpointRoi[capabilityId].successfulCalls += 1;
            else if (response.attemptResult === "premiumBlocked") endpointRoi[capabilityId].premiumBlockedCalls += 1;
            else endpointRoi[capabilityId].failedCalls += 1;
          }
          return {
            data: response.data,
            source: capabilitySource(capabilityId, response.fromCache),
            timestamp: response.timestamp,
            fromCache: response.fromCache,
            attemptResult: response.attemptResult
          };
        } catch (error) {
          if (error instanceof FmpQuotaError) {
            quotaStopped = true;
            return null;
          }
          const message = error instanceof Error ? maskFmpText(error.message, allocation.fmp_api_key) : "FMP endpoint failed.";
          const attempted = error instanceof FmpRequestError && error.status === 402 && getCache().fmpPremiumBlocked?.[capabilityId]
            ? 1
            : 0;
          if (attempted) {
            endpointRoi[capabilityId].calls += 1;
            endpointRoi[capabilityId].premiumBlockedCalls += 1;
          } else if (!(error instanceof FmpRequestError && error.status === 402)) {
            endpointRoi[capabilityId].calls += 1;
            endpointRoi[capabilityId].failedCalls += 1;
          }
          const result: FmpCapabilityResult = {
            ...capability,
            status: classifyFmpFailure(error instanceof FmpRequestError ? error.status : null, message),
            httpStatus: error instanceof FmpRequestError ? error.status : null,
            preview: message.slice(0, 400),
            testedAt: nowIso()
          };
          capabilities = updateFmpCapability(result);
          usedAvailableOnly = true;
          return null;
        }
      };
      for (const candidate of selectedCoverageRows) {
        const stock = updated.find((row) => row.id === candidate.analysis.stock.id) ?? candidate.analysis.stock;
        const ticker = stock.ticker;
        let enriched = stock;
        for (const capabilityId of candidate.endpointIds) {
          const result = await pull(capabilityId, fmpEndpointForTicker(capabilityId, ticker));
          if (!result) continue;
          const bundleKey: FmpBundleKey =
            capabilityId === "cashFlow" ? "cashFlow" :
              capabilityId === "historical" ? "historical" :
                capabilityId;
          const beforeFingerprint = usableStockFingerprint(enriched);
          enriched = applyFmpData(
            enriched,
            { [bundleKey]: result.data },
            { [bundleKey]: result.source },
            { [bundleKey]: result.timestamp }
          );
          if (result.attemptResult !== "cache") {
            if (result.attemptResult === "success" && usableStockFingerprint(enriched) !== beforeFingerprint) {
              endpointRoi[capabilityId].callsAddedFields += 1;
            } else {
              endpointRoi[capabilityId].callsNoUsableData += 1;
            }
          }
        }
        updated = updated.map((row) => row.ticker === ticker ? enriched : row);
        scannedSymbols.push(ticker);
        if (quotaStopped) break;
      }
      saveStocks(updated);
      setCacheInfo(getCache());
      const blockedMessage = blockedCapabilityMessage(capabilitiesFromCache(getCache()));
      setStatus(
        `Coverage batch completed: ${scannedSymbols.length}/${batchSize} stocks processed, ${calls} new FMP calls used, cached responses reused when fresh.`
        + (quotaStopped ? " Daily quota reached before the full batch completed." : "")
        + (usedAvailableOnly || blockedMessage ? ` ${blockedMessage || "Investment Lab used available FMP data only."}` : "")
      );
    } catch (error) {
      setStatus(error instanceof Error ? `Coverage scan stopped. Cached data used where possible. ${error.message}` : "Coverage scan stopped. Cached data used where possible.");
      saveStocks(updated);
      setCacheInfo(getCache());
    } finally {
      const roiAfterCache = normalizeFmpDailyUsage(getCache());
      const roiAfterStats = roiAfterCache.fmpAttemptStats ?? defaultFmpAttemptStats();
      const attemptDelta = fmpAttemptDelta(roiAfterStats, roiBeforeStats);
      const validAfter = validScenarioTickerSet(updated, roiAfterCache, portfolio, assumptions, effectiveScenarioProbabilities);
      const newValidSymbols = [...validAfter].filter((ticker) => !validBefore.has(ticker));
      const hybridCompletedSymbols = newValidSymbols.filter(
        (ticker) => secCashFlowEntry(roiAfterCache, ticker)?.data.status === "success"
      );
      const remainingMissingFields = Object.fromEntries(
        scannedSymbols.map((ticker) => {
          const stock = updated.find((row) => row.ticker === ticker);
          if (!stock) return [ticker, ["stock record missing"]];
          const analysis = analyzeStock(stock, portfolio, assumptions, {
            normalizedFcf3y: averageFcf(combinedCashFlowHistoryForTicker(roiAfterCache, ticker), 3),
            scenarioProbabilities: effectiveScenarioProbabilities
          });
          return [ticker, coverageReasons(stock, analysis, roiAfterCache)];
        })
      );
      const actualCallsUsed = Math.max(0, (roiAfterCache.fmpCalls ?? 0) - (roiBeforeCache.fmpCalls ?? 0));
      const endpointTotals = Object.values(endpointRoi);
      const successfulEndpoints = endpointTotals.reduce((sum, endpoint) => sum + endpoint.successfulCalls, 0);
      const failedEndpoints = endpointTotals.reduce((sum, endpoint) => sum + endpoint.failedCalls, 0);
      const premiumBlockedEndpoints = endpointTotals.reduce((sum, endpoint) => sum + endpoint.premiumBlockedCalls, 0);
      const callsAddedFields = endpointTotals.reduce((sum, endpoint) => sum + endpoint.callsAddedFields, 0);
      const callsNoUsableData = endpointTotals.reduce((sum, endpoint) => sum + endpoint.callsNoUsableData, 0);
      const roiBatch: ScanRoiBatch = {
        id: uid("scan-roi"),
        batchTime: nowIso(),
        localDate: todayKey(),
        priorityMode: scanPreview?.priorityMode ?? scanPrioritySettings.mode,
        symbolsScanned: scannedSymbols,
        estimatedCalls: scanPreview?.estimatedCalls ?? 0,
        actualCallsUsed,
        successfulEndpoints: Math.max(successfulEndpoints, attemptDelta.success),
        failedEndpoints: Math.max(failedEndpoints, attemptDelta.unauthorized + attemptDelta.rateLimited + attemptDelta.networkErrors + attemptDelta.otherErrors),
        premiumBlockedEndpoints: Math.max(premiumBlockedEndpoints, attemptDelta.premiumBlocked),
        callsWastedOnBlockedEndpoints: Math.max(premiumBlockedEndpoints, attemptDelta.premiumBlocked),
        callsAddedFields,
        callsNoUsableData,
        endpointRoi,
        stocksValidBefore: validBefore.size,
        stocksValidAfter: validAfter.size,
        newValidStocksGained: newValidSymbols.length,
        newValidSymbols,
        callsPerNewValidStock: newValidSymbols.length > 0 ? actualCallsUsed / newValidSymbols.length : null,
        hybridCompletedSymbols,
        secFcfSymbols: scannedSymbols.filter(
          (ticker) => secCashFlowEntry(roiAfterCache, ticker)?.data.status === "success"
        ),
        remainingMissingFields
      };
      saveScanRoiBatch(roiBatch);
      setCacheInfo(roiAfterCache);
      setFmpCapabilities(capabilitiesFromCache(roiAfterCache));
      if (actualCallsUsed > 0 && newValidSymbols.length === 0) {
        setStatus((current) => `${current} If a scan batch uses calls but creates 0 new valid stocks, review missing endpoints before scanning more.`);
      } else if (hybridCompletedSymbols.length) {
        setStatus((current) => `${current} Hybrid completion made valid: ${hybridCompletedSymbols.join(", ")}.`);
      }
      setBusy(false);
      setCoverageScanPreview(null);
    }
  }

  async function runAutoCompleteAvailableData() {
    setStatus("Auto data completion started: local universe, SEC EDGAR FCF/fundamentals fallback, then safe FMP Make Valid scan.");
    const stage1Stocks = await runLocalStage1();
    const afterStage1Cache = getCache();
    const stage1Coverage = coverageRowsForCache(stage1Stocks, afterStage1Cache);
    const secTickers = stage1Coverage
      .filter((row) =>
        (row.reasons.includes("missing FCF") || row.reasons.includes("missing 3-year FCF history"))
        && !row.secFcfAvailable
        && secCashFlowEntry(afterStage1Cache, row.analysis.stock.ticker)?.date !== todayKey()
      )
      .map((row) => row.analysis.stock.ticker);
    const afterSecStocks = secTickers.length
      ? await runSecBackfillBatches(secTickers, stage1Stocks)
      : stage1Stocks;
    const latestCache = normalizeFmpDailyUsage(getCache());
    const latestCoverageRows = coverageRowsForCache(afterSecStocks, latestCache);
    const fmpPreview = buildCoverageScanPreview(
      latestCoverageRows,
      50,
      latestCache,
      capabilitiesFromCache(latestCache),
      scanPrioritySettings
    );
    setCoverageScanPreview(fmpPreview);

    if (!allocation.fmp_api_key.trim()) {
      setStatus(
        `Auto data completion finished local + SEC steps. Add an FMP key to fill profile, price, ratios, income, and historical price fields. `
        + `${secTickers.length} SEC FCF/fundamental candidate${secTickers.length === 1 ? "" : "s"} checked in free official-data batches.`
      );
      return;
    }
    if (!fmpPreview.selectedSymbols.length) {
      const blockedCount = latestCoverageRows.filter((row) => row.blockedFromValidity).length;
      const missingFcfCount = latestCoverageRows.filter((row) => !row.hybridChecklist.fcf.available).length;
      const noEndpointCount = latestCoverageRows.filter((row) =>
        row.hybridChecklist.fcf.available
        && !row.blockedFromValidity
        && !row.estimatedAvailableCalls
      ).length;
      const diagnosticSummary = latestCoverageRows.length
        ? ` Diagnosed ${latestCoverageRows.length} insufficient record${latestCoverageRows.length === 1 ? "" : "s"}: ${blockedCount} blocked, ${missingFcfCount} missing FCF source, ${noEndpointCount} already have no remaining requestable endpoint.`
        : " No insufficient scenario records are currently queued; loaded stocks may already be analyzable or need different filters/manual review.";
      setStatus(
        `Auto data completion finished. No FMP-scannable symbols are currently queued.${diagnosticSummary} `
        + `Open Data Coverage to review blocked endpoints, manual fixes, or already-complete records.`
      );
      return;
    }
    if (!fmpPreview.isSafe) {
      setStatus(
        `Auto data completion paused before FMP scan. Estimated ${fmpPreview.estimatedCalls} calls exceeds safe remaining ${fmpPreview.safeRemaining}. `
        + "Update quota reconciliation or run a smaller preview."
      );
      return;
    }
    await runCoverageBatch(50, fmpPreview.selectedSymbols, fmpPreview, latestCoverageRows, afterSecStocks);
    setStatus((current) =>
      `${current} Auto completion used every currently available safe source. Some stocks may still be incomplete if data is unavailable, premium-blocked, or requires manual input.`
    );
  }

  async function runSecBackfillBatches(selectedTickers: string[], stockBase = stocks) {
    const uniqueTickers = [...new Set(selectedTickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))];
    if (!uniqueTickers.length) return stockBase;
    let updated = stockBase;
    const batchSize = 25;
    for (let index = 0; index < uniqueTickers.length; index += batchSize) {
      const batch = uniqueTickers.slice(index, index + batchSize);
      setStatus(
        `SEC EDGAR free backfill running: ${index + 1}-${index + batch.length} of ${uniqueTickers.length}. `
        + "This uses official SEC data, not FMP quota."
      );
      updated = await runSecCoverageBatch(batch.length, batch, false, updated);
    }
    const latestCache = getCache();
    const remainingMissingFcf = coverageRowsForCache(updated, latestCache)
      .filter((row) => !row.hybridChecklist.fcf.available).length;
    setStatus(
      `SEC EDGAR free backfill finished for ${uniqueTickers.length} symbol${uniqueTickers.length === 1 ? "" : "s"}. `
      + `${remainingMissingFcf} insufficient record${remainingMissingFcf === 1 ? "" : "s"} still lack a usable FCF source. `
      + "Remaining gaps may require FMP historical/price data or manual input."
    );
    return updated;
  }

  async function runAllSecCoverageBackfill() {
    const cache = getCache();
    const rows = coverageRowsForCache(stocks, cache);
    const tickers = rows
      .filter((row) =>
        (row.reasons.includes("missing FCF") || row.reasons.includes("missing 3-year FCF history"))
        && !row.secFcfAvailable
        && secCashFlowEntry(cache, row.analysis.stock.ticker)?.date !== todayKey()
      )
      .map((row) => row.analysis.stock.ticker);
    if (!tickers.length) {
      setStatus("No fresh SEC EDGAR backfill candidates are available today. Review cached SEC results or use manual fixes.");
      return;
    }
    await runSecBackfillBatches(tickers, stocks);
  }

  function runFmpScan() {
    previewCoverageBatch(50);
  }

  async function runSecCoverageBatch(limit: number, selectedTickers?: string[], forceRefresh = false, stockBase = stocks) {
    if (!(await ensureBackendOnline())) {
      setStatus("Backend is offline. Start backend before running SEC EDGAR FCF fallback.");
      return stockBase;
    }
    const cacheForSelection = getCache();
    const baseCoverageRows = selectedTickers?.length
      ? secCoverageRows
      : coverageRowsForCache(stockBase, cacheForSelection)
        .filter((row) =>
          (row.reasons.includes("missing FCF") || row.reasons.includes("missing 3-year FCF history"))
          && !row.secFcfAvailable
        )
        .sort((left, right) =>
          right.analysis.realDataPercent - left.analysis.realDataPercent
          || left.reasons.length - right.reasons.length
          || right.analysis.stock.market_cap - left.analysis.stock.market_cap
        );
    const requested = selectedTickers?.length
      ? selectedTickers.map((ticker) => ticker.toUpperCase())
      : baseCoverageRows
        .filter((row) => forceRefresh || secCashFlowEntry(cacheForSelection, row.analysis.stock.ticker)?.date !== todayKey())
        .slice(0, limit)
        .map((row) => row.analysis.stock.ticker);
    if (!requested.length) {
      setStatus("No SEC FCF candidates need a new request today. Cached SEC results remain available.");
      return stockBase;
    }

    setBusy(true);
    const beforeCache = getCache();
    const validBefore = validScenarioTickerSet(stockBase, beforeCache, portfolio, assumptions, effectiveScenarioProbabilities);
    try {
      const response = await fetchSecCashFlowBatch(requested, beforeCache, forceRefresh);
      let nextCache = storeSecResponse(beforeCache, response);
      const resultByTicker = new Map(response.results.map((result) => [result.ticker.toUpperCase(), result]));
      const updated = stockBase.map((stock) => {
        const result = resultByTicker.get(stock.ticker.toUpperCase());
        return result ? applySecCashFlow(stock, result) : stock;
      });
      const validAfter = validScenarioTickerSet(updated, nextCache, portfolio, assumptions, effectiveScenarioProbabilities);
      const newlyValid = [...validAfter].filter((ticker) => !validBefore.has(ticker));
      const previousStats = nextCache.secCoverageStats ?? {
        requestsMade: 0,
        cacheHits: 0,
        extractionSuccesses: 0,
        extractionFailures: 0,
        stocksMadeValid: 0,
        lastRunAt: "",
        lastRunSymbols: []
      };
      nextCache = {
        ...nextCache,
        secCoverageStats: {
          requestsMade: previousStats.requestsMade + response.requests_made,
          cacheHits: previousStats.cacheHits + response.cache_hits,
          extractionSuccesses: previousStats.extractionSuccesses + response.successes,
          extractionFailures: previousStats.extractionFailures + response.failures,
          stocksMadeValid: previousStats.stocksMadeValid + newlyValid.length,
          lastRunAt: response.fetched_at ?? nowIso(),
          lastRunSymbols: response.requested_symbols
        }
      };
      setCache(nextCache);
      setCacheInfo(nextCache);
      saveStocks(updated);
      if (response.results[0]?.ticker) setSecInspectorTicker(response.results[0].ticker);
      const missingSymbols = response.results
        .filter((result) => result.status !== "success")
        .map((result) => result.ticker);
      setStatus(
        `SEC EDGAR FCF fallback completed: ${response.successes} extracted, ${response.failures} missing/ambiguous, `
        + `${response.requests_made} SEC requests, ${response.cache_hits} cache hits, ${newlyValid.length} stocks became valid.`
        + (response.local_cache_fallback ? " Backend request failed; local SEC cache was used." : "")
        + (missingSymbols.length ? ` Missing or ambiguous: ${missingSymbols.join(", ")}.` : "")
      );
      return updated;
    } catch (error) {
      setStatus(error instanceof Error ? `SEC EDGAR FCF fallback failed. ${error.message}` : "SEC EDGAR FCF fallback failed.");
      return stockBase;
    } finally {
      setBusy(false);
    }
  }

  function updateCoverageManualDraft(ticker: string, field: CoverageManualField, value: number | null) {
    setCoverageManualDrafts((current) => ({
      ...current,
      [ticker]: { ...(current[ticker] ?? {}), [field]: value }
    }));
  }

  function saveCoverageManualFix(stock: StockRecord) {
    const draftValues = coverageManualDrafts[stock.ticker] ?? {};
    const timestamp = nowIso();
    const nextStock: StockRecord = {
      ...stock,
      field_audit: { ...(stock.field_audit ?? {}) },
      source: stock.source.includes("Manual") ? stock.source : `${stock.source} + Manual`,
      last_updated: timestamp
    };
    let changed = false;
    for (const [field, value] of Object.entries(draftValues) as Array<[CoverageManualField, number | null | undefined]>) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      if (field !== "revenue_growth_pct" && value <= 0) continue;
      nextStock[field] = value;
      nextStock.field_audit![field] = auditEntry(value, "manual", timestamp, true);
      changed = true;
    }
    if (!changed) {
      setStatus(`No valid manual coverage values entered for ${stock.ticker}.`);
      return;
    }
    saveStocks(stocks.map((row) => row.id === stock.id ? nextStock : row));
    setCoverageManualDrafts((current) => {
      const next = { ...current };
      delete next[stock.ticker];
      return next;
    });
    setStatus(`${stock.ticker} manual coverage fields saved and data audit updated.`);
  }

  const reliableAnalyses = analyses.filter((item) => item.scoreReliable);
  const riskComplete = (analysis: StockAnalysis) => ["volatility", "drawdown", "debtRisk"].every((key) => {
    const source = analysis.componentAudit.find((item) => item.key === key)?.source;
    return source !== undefined && source !== "missing" && source !== "fallback";
  });
  const rankings = {
    top: reliableAnalyses
      .filter((item) => item.recommendation === "Strong Buy Candidate" || item.recommendation === "Buy Candidate")
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 20),
    reliable: [...reliableAnalyses].sort((a, b) => b.totalScore - a.totalScore).slice(0, 20),
    incomplete: analyses
      .filter((item) => !item.scoreReliable || item.recommendation === "Insufficient Data")
      .sort((a, b) => b.realDataPercent - a.realDataPercent || b.baseScore - a.baseScore)
      .slice(0, 20),
    value: [...reliableAnalyses].sort((a, b) => b.breakdown.valuation - a.breakdown.valuation).slice(0, 10),
    quality: [...reliableAnalyses].sort((a, b) => b.breakdown.quality - a.breakdown.quality).slice(0, 10),
    lowRisk: reliableAnalyses.filter(riskComplete).sort((a, b) => b.breakdown.risk - a.breakdown.risk).slice(0, 10),
    highRisk: reliableAnalyses.filter(riskComplete).sort((a, b) => a.breakdown.risk - b.breakdown.risk).slice(0, 10),
    avoid: reliableAnalyses
      .filter((item) => item.recommendation === "Avoid")
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 10),
    wait: reliableAnalyses
      .filter((item) => {
        const premium = fairValuePremiumPct(item);
        return premium !== null && premium > 0;
      })
      .sort((a, b) => (fairValuePremiumPct(b) ?? Number.NEGATIVE_INFINITY) - (fairValuePremiumPct(a) ?? Number.NEGATIVE_INFINITY))
      .slice(0, 10)
  };
  const rankingAuditRows = buildRankingAuditRows(rankings, {
    top: t.topRecommended,
    reliable: t.reliableCandidates,
    incomplete: t.incompleteCandidates,
    value: t.bestValue,
    quality: t.highestQuality,
    lowRisk: t.lowestRisk,
    highRisk: t.highestRisk,
    avoid: t.avoidList,
    wait: t.waitList
  });
  const validScenarioAnalyses = analyses.filter((analysis) => analysis.valuation.scenarioValuation.decisionLabel !== "Insufficient Scenario Data");
  const measurableRiskRewardAnalyses = validScenarioAnalyses.filter(hasMeasurableScenarioRiskReward);
  const scenarioRankings = {
    bestRiskReward: [...measurableRiskRewardAnalyses]
      .filter((analysis) => analysis.valuation.scenarioValuation.riskRewardLabel !== "Speculative Premium")
      .sort((left, right) => (right.valuation.scenarioValuation.riskRewardRatio ?? 0) - (left.valuation.scenarioValuation.riskRewardRatio ?? 0))
      .slice(0, 10),
    bestWeightedUpside: [...validScenarioAnalyses]
      .filter((analysis) => analysis.valuation.scenarioValuation.weightedUpsideDownsidePct !== null && Number.isFinite(analysis.valuation.scenarioValuation.weightedUpsideDownsidePct))
      .sort((left, right) => (right.valuation.scenarioValuation.weightedUpsideDownsidePct ?? Number.NEGATIVE_INFINITY) - (left.valuation.scenarioValuation.weightedUpsideDownsidePct ?? Number.NEGATIVE_INFINITY))
      .slice(0, 10),
    worstRiskReward: [...measurableRiskRewardAnalyses]
      .sort((left, right) => (left.valuation.scenarioValuation.riskRewardRatio ?? Number.POSITIVE_INFINITY) - (right.valuation.scenarioValuation.riskRewardRatio ?? Number.POSITIVE_INFINITY))
      .slice(0, 10),
    noModeledDownside: validScenarioAnalyses
      .filter((analysis) => !hasMeasurableScenarioRiskReward(analysis))
      .sort((left, right) => left.stock.ticker.localeCompare(right.stock.ticker))
      .slice(0, 20),
    requiresBull: validScenarioAnalyses
      .filter((analysis) => analysis.valuation.scenarioValuation.decisionLabel === "Requires Bull Case")
      .sort((left, right) => (right.valuation.scenarioValuation.weightedUpsideDownsidePct ?? Number.NEGATIVE_INFINITY) - (left.valuation.scenarioValuation.weightedUpsideDownsidePct ?? Number.NEGATIVE_INFINITY))
      .slice(0, 10),
    aboveBull: validScenarioAnalyses
      .filter((analysis) => analysis.valuation.scenarioValuation.decisionLabel === "Above Bull Case" || analysis.valuation.scenarioValuation.decisionLabel === "Speculative Premium")
      .filter((analysis) => analysis.valuation.scenarioValuation.upsideToBullPct !== null && Number.isFinite(analysis.valuation.scenarioValuation.upsideToBullPct))
      .sort((left, right) => (left.valuation.scenarioValuation.upsideToBullPct ?? Number.POSITIVE_INFINITY) - (right.valuation.scenarioValuation.upsideToBullPct ?? Number.POSITIVE_INFINITY))
      .slice(0, 10)
  };
  const overviewWarnings = [
    backendOnline === false ? BACKEND_OFFLINE_MESSAGE : "",
    stale ? t.stale : "",
    fmpCacheAudit.filter((row) => row.category === "empty cache" || row.category === "failed cache").length
      ? `${fmpCacheAudit.filter((row) => row.category === "empty cache" || row.category === "failed cache").length} FMP cache entries need repair.`
      : "",
    coverageRows.length ? `${coverageRows.length} stocks still have insufficient scenario data.` : "",
    ...portfolio.warnings.slice(0, 3)
  ].filter(Boolean);
  const workflowSteps = [
    { label: "Load Universe", complete: stocks.length > 0 },
    { label: "Check Data Coverage", complete: analyses.length > 0 },
    { label: "Preview Scan", complete: Boolean(coverageScanPreview) || scanRoiHistory.length > 0 },
    { label: "Confirm Scan", complete: scanRoiHistory.length > 0 },
    { label: "Review Candidates", complete: reliableAnalyses.length > 0 },
    { label: "Review Valuation / Scenario", complete: validScenarioAnalyses.length > 0 },
    { label: "Add to Watchlist or Portfolio", complete: watchlist.length > 0 || holdings.length > 0 }
  ];

  return (
    <div className="grid min-w-0 gap-5 sm:gap-6">
      <SectionHeader
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.subtitle}
        action={<StatusBadge tone="positive">{t.researchOnly}</StatusBadge>}
      />

      <nav
        aria-label="Investment Lab sections"
        className="sticky top-[73px] z-[5] flex min-w-0 gap-1 overflow-x-auto rounded-lg border border-stroke bg-panel/95 p-1.5 shadow-soft backdrop-blur [scrollbar-width:none] xl:top-3 [&::-webkit-scrollbar]:hidden"
      >
        {INVESTMENT_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => changeActiveTab(tab.id)}
              className={cn(
                "focus-ring flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted transition",
                active ? "bg-canvas text-ink shadow-sm" : "hover:bg-canvas/60 hover:text-ink"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {busy ? <LoadingState label="Investment Lab is updating local research data..." /> : null}
      {!busy && backendOnline === false && (activeTab === "scanner" || activeTab === "coverage") ? (
        <ErrorState title="Backend offline" description={BACKEND_OFFLINE_MESSAGE} />
      ) : null}

      {activeTab === "overview" ? (
        <>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Valid Stocks" value={validScenarioCount} helper={`${analyses.length} total universe records`} icon={<DatabaseZap className="h-4 w-4" />} tone="positive" />
            <MetricCard label="Insufficient Data" value={coverageRows.length} helper={`${coverageRows.filter((row) => row.secFcfAvailable).length} already have SEC FCF`} icon={<AlertTriangle className="h-4 w-4" />} tone={coverageRows.length ? "caution" : "positive"} />
            <MetricCard label="Safe FMP Calls" value={remainingFmpQuota} helper={`${officialFmpUsed} of ${officialFmpLimit} official calls used`} icon={<DownloadCloud className="h-4 w-4" />} />
            <MetricCard label="Scan ROI" value={lifetimeScanRoi.callsPerNewValidStock === null ? "--" : lifetimeScanRoi.callsPerNewValidStock.toFixed(1)} helper="Average calls per new valid stock" icon={<TrendingUp className="h-4 w-4" />} />
          </div>

          <InvestmentWorkflow steps={workflowSteps} onSelect={changeActiveTab} />

          <div className="grid min-w-0 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <DashboardCard className="p-4 sm:p-5">
              <SectionHeader title="Decision Snapshot" description="Reliable candidates and scenario conclusions first." />
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <OverviewList title="Best Candidates" rows={rankings.top.length ? rankings.top.slice(0, 5) : rankings.reliable.slice(0, 5)} language={language} empty="No reliable buy candidates yet." />
                <OverviewList title="Best Scenario Risk / Reward" rows={scenarioRankings.bestRiskReward.slice(0, 5)} language={language} empty="No measurable scenario risk/reward yet." showScenario />
              </div>
            </DashboardCard>

            <DashboardCard className="p-4 sm:p-5">
              <SectionHeader title="Top Warnings" description="Items most likely to block a useful decision." />
              <div className="mt-4 grid gap-2">
                {overviewWarnings.length ? overviewWarnings.slice(0, 6).map((warning) => (
                  <div key={warning} className="flex min-w-0 items-start gap-2 rounded-md border border-stroke bg-canvas px-3 py-2 text-sm text-muted">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-caution" />
                    <span className="break-words">{warning}</span>
                  </div>
                )) : (
                  <EmptyState title="No major warnings" description="Current research data has no high-priority workflow warnings." />
                )}
              </div>
            </DashboardCard>
          </div>
        </>
      ) : null}

      {activeTab === "coverage" ? <FmpQuotaReconciliation
        appTrackedCalls={dailyFmpCalls}
        officialUsed={officialFmpUsed}
        officialLimit={officialFmpLimit}
        safetyBuffer={fmpSafetyBuffer}
        safeRemaining={remainingFmpQuota}
        stats={fmpAttemptStats}
        onChange={saveFmpQuotaReconciliation}
        onReset={resetFmpDailyUsage}
      /> : null}

      {activeTab === "scanner" ? <>
      <ScanRoiDashboard
        history={scanRoiHistory}
        today={todaysScanRoi}
        lastBatch={lastScanRoiBatch}
        bestMode={bestPriorityModeRoi}
        worstMode={worstPriorityModeRoi}
        lifetime={lifetimeScanRoi}
        permanentlyBlockedEndpointIds={permanentlyBlockedEndpointIds}
      />
      <InvestmentScannerDiagnostics
        stockCount={stocks.length}
        broadScanCount={broadScan.length}
        coverageRows={coverageRows}
        validScenarioCount={validScenarioCount}
        backendOnline={backendOnline}
        hasApiKey={Boolean(allocation.fmp_api_key.trim())}
        remainingQuota={remainingFmpQuota}
        officialUsed={officialFmpUsed}
        officialLimit={officialFmpLimit}
        capabilities={fmpCapabilities}
        attemptStats={fmpAttemptStats}
        cacheAudit={fmpCacheAudit}
        preview={coverageScanPreview}
        lastBatch={lastScanRoiBatch}
        status={status}
        fmpTestStatus={fmpTestStatus}
      />
      <DataCoverageManager
        view="scanner"
        totalStocks={analyses.length}
        validStocks={validScenarioCount}
        coverageRows={coverageRows}
        distribution={coverageDistribution}
        scannedToday={scannedToday.size}
        remainingQuota={remainingFmpQuota}
        estimatedDays={estimatedCoverageDays}
        pendingCalls={pendingCoverageCalls}
        cacheAudit={fmpCacheAudit}
        cacheRepairSummary={cacheRepairSummary}
        onRepairCaches={repairFmpCaches}
        busy={busy}
        hasApiKey={Boolean(allocation.fmp_api_key.trim())}
        prioritySettings={scanPrioritySettings}
        onPrioritySettingsChange={saveScanPrioritySettings}
        preview={coverageScanPreview}
        onPreview={previewCoverageBatch}
        onConfirm={() => void confirmCoverageBatch()}
        onCancel={() => {
          setCoverageScanPreview(null);
          setStatus("Make Valid scan preview cancelled. No FMP requests were sent.");
        }}
        onRunLocalStage1={() => void runLocalStage1()}
        onOpenCoverage={() => changeActiveTab("coverage")}
        manualDrafts={coverageManualDrafts}
        onManualChange={updateCoverageManualDraft}
        onManualSave={saveCoverageManualFix}
        lastHybridBatch={lastScanRoiBatch}
      />
      </> : null}

      {activeTab === "coverage" ? <>
      <SecCoverageManager
        rows={secCoverageRows}
        cache={cacheInfo}
        stats={secCoverageStats}
        busy={busy}
        backendOnline={backendOnline}
        onScan={(limit) => void runSecCoverageBatch(limit)}
        onScanAll={() => void runAllSecCoverageBackfill()}
      />
      <FmpCapabilityPanel
        capabilities={fmpCapabilities}
        testStatus={fmpTestStatus}
        disabled={busy || !allocation.fmp_api_key.trim() || remainingFmpQuota <= 0}
        onTest={() => void testFmpApiKey()}
      />
      </> : null}

      {activeTab === "diagnostics" ? <SecRawInspector
        cache={cacheInfo}
        ticker={secInspectorTicker}
        busy={busy}
        backendOnline={backendOnline}
        onTickerChange={setSecInspectorTicker}
        onLoad={() => void runSecCoverageBatch(1, [secInspectorTicker])}
        onRefresh={() => void runSecCoverageBatch(1, [secInspectorTicker], true)}
      /> : null}

      {activeTab === "coverage" ? <DataCoverageManager
        view="coverage"
        totalStocks={analyses.length}
        validStocks={validScenarioCount}
        coverageRows={coverageRows}
        distribution={coverageDistribution}
        scannedToday={scannedToday.size}
        remainingQuota={remainingFmpQuota}
        estimatedDays={estimatedCoverageDays}
        pendingCalls={pendingCoverageCalls}
        cacheAudit={fmpCacheAudit}
        cacheRepairSummary={cacheRepairSummary}
        onRepairCaches={repairFmpCaches}
        busy={busy}
        hasApiKey={Boolean(allocation.fmp_api_key.trim())}
        prioritySettings={scanPrioritySettings}
        onPrioritySettingsChange={saveScanPrioritySettings}
        preview={coverageScanPreview}
        onPreview={previewCoverageBatch}
        onConfirm={() => void confirmCoverageBatch()}
        onCancel={() => {
          setCoverageScanPreview(null);
          setStatus("Make Valid scan preview cancelled. No FMP requests were sent.");
        }}
        onRunLocalStage1={() => void runLocalStage1()}
        onOpenCoverage={() => changeActiveTab("coverage")}
        manualDrafts={coverageManualDrafts}
        onManualChange={updateCoverageManualDraft}
        onManualSave={saveCoverageManualFix}
        lastHybridBatch={lastScanRoiBatch}
      /> : null}

      {activeTab === "valuation" ? <CollapsibleCard
        title={language === "zh" ? "DCF 假设控制" : "DCF Assumption Controls"}
        badge={<Badge>{language === "zh" ? "全局模型输入" : "Global model inputs"}</Badge>}
        defaultOpen
        contentClassName="grid gap-4"
      >
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <NumberField label={language === "zh" ? "折现率 %" : "Discount Rate %"} value={assumptions.discount_rate_pct} onChange={(value) => saveAssumptions({ ...assumptions, discount_rate_pct: value ?? 10 })} />
            <NumberField label={language === "zh" ? "永续增长率 %" : "Terminal Growth %"} value={assumptions.terminal_growth_pct} onChange={(value) => saveAssumptions({ ...assumptions, terminal_growth_pct: value ?? 2.5 })} />
            <NumberField label={language === "zh" ? "预测年数" : "Projection Years"} value={assumptions.projection_years} onChange={(value) => saveAssumptions({ ...assumptions, projection_years: value ?? 5 })} />
            <NumberField label={language === "zh" ? "基础 FCF 增长 %" : "Base FCF Growth %"} value={assumptions.base_fcf_growth_pct} onChange={(value) => saveAssumptions({ ...assumptions, base_fcf_growth_pct: value ?? 5 })} />
          </div>
          <div className="break-words rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm leading-6 text-muted">
            {language === "zh"
              ? "这些假设会影响 DCF、公允价值区间、保守买入价、推荐信心和警告。折现率必须高于永续增长率；系统会自动限制极端输入。"
              : "These assumptions affect DCF, fair value range, conservative buy price, recommendation confidence, and warnings. Discount rate must stay above terminal growth; extreme inputs are bounded by the model."}
          </div>
      </CollapsibleCard> : null}

      {activeTab === "scenario" ? <CollapsibleCard
        title="Scenario Probability Controls"
        badge={<Badge>{scenarioProbabilitiesValid ? "Valid: 100%" : "Using default 25 / 50 / 25"}</Badge>}
        defaultOpen
        contentClassName="grid gap-4"
      >
        <div className="grid min-w-0 gap-3 sm:grid-cols-3">
          <NumberField
            label="Bear Probability %"
            value={scenarioProbabilities.bear}
            onChange={(value) => saveScenarioProbabilities({ ...scenarioProbabilities, bear: value ?? 0 })}
          />
          <NumberField
            label="Base Probability %"
            value={scenarioProbabilities.base}
            onChange={(value) => saveScenarioProbabilities({ ...scenarioProbabilities, base: value ?? 0 })}
          />
          <NumberField
            label="Bull Probability %"
            value={scenarioProbabilities.bull}
            onChange={(value) => saveScenarioProbabilities({ ...scenarioProbabilities, bull: value ?? 0 })}
          />
        </div>
        <div className={`rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm leading-6 ${scenarioProbabilitiesValid ? "text-muted" : "font-medium text-ink"}`}>
          Entered total: {comparisonValue(scenarioProbabilities.bear + scenarioProbabilities.base + scenarioProbabilities.bull, "%")}.
          {scenarioProbabilitiesValid
            ? ` Weighted valuation uses Bear ${effectiveScenarioProbabilities.bear}%, Base ${effectiveScenarioProbabilities.base}%, Bull ${effectiveScenarioProbabilities.bull}%.`
            : " Probabilities must be non-negative and add to 100%. Calculations are using the default Bear 25%, Base 50%, Bull 25% until the inputs are valid."}
        </div>
      </CollapsibleCard> : null}

      {activeTab === "scanner" ? <div className="grid min-w-0 gap-4 sm:gap-6 2xl:grid-cols-[1fr_0.85fr]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t.stockInput}</CardTitle>
            <Badge>{stocks.length} stocks</Badge>
          </CardHeader>
          <CardContent className="min-w-0 p-3 sm:p-5">
            <form onSubmit={saveStock} className="grid gap-4">
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                <TextField label="Ticker / 代码" value={draft.ticker} onChange={(value) => setDraft({ ...draft, ticker: value.toUpperCase() })} />
                <TextField label="Company / 公司" value={draft.company_name} onChange={(value) => setDraft({ ...draft, company_name: value })} />
                <Field label="Sector / 行业">
                  <Select value={draft.sector} options={SECTORS} onChange={(event) => setDraft({ ...draft, sector: event.target.value })} />
                </Field>
                <TextField label="Industry / 细分行业" value={draft.industry} onChange={(value) => setDraft({ ...draft, industry: value })} />
                <NumberField label="Current Price / 当前价格" value={draft.current_price} onChange={(value) => setDraft({ ...draft, current_price: value ?? 0 })} />
                <NumberField label="Target Buy / 目标买入价" value={draft.target_buy_price} onChange={(value) => setDraft({ ...draft, target_buy_price: value ?? 0 })} />
                <NumberField label="Market Cap / 市值" value={draft.market_cap} onChange={(value) => setDraft({ ...draft, market_cap: value ?? 0 })} />
                <NumberField label="PE Ratio / 市盈率" value={draft.pe_ratio} onChange={(value) => setDraft({ ...draft, pe_ratio: value })} />
                <NumberField label="Revenue Growth % / 收入增长" value={draft.revenue_growth_pct} onChange={(value) => setDraft({ ...draft, revenue_growth_pct: value })} />
                <NumberField label="FCF Growth % / 自由现金流增长" value={draft.fcf_growth_pct} onChange={(value) => setDraft({ ...draft, fcf_growth_pct: value })} />
                <NumberField label="Net Margin % / 净利率" value={draft.net_margin_pct} onChange={(value) => setDraft({ ...draft, net_margin_pct: value })} />
                <NumberField label="Free Cash Flow / 自由现金流" value={draft.free_cash_flow} onChange={(value) => setDraft({ ...draft, free_cash_flow: value })} />
                <NumberField label="Debt / Equity / 负债权益比" value={draft.debt_to_equity} onChange={(value) => setDraft({ ...draft, debt_to_equity: value })} />
                <NumberField label="ROE % / 净资产收益率" value={draft.roe_pct} onChange={(value) => setDraft({ ...draft, roe_pct: value })} />
                <NumberField label="Dividend % / 股息率" value={draft.dividend_yield_pct} onChange={(value) => setDraft({ ...draft, dividend_yield_pct: value })} />
                <NumberField label="Volatility % / 波动率" value={draft.volatility_pct} onChange={(value) => setDraft({ ...draft, volatility_pct: value })} />
                <NumberField label="52w Drawdown % / 52周回撤" value={draft.drawdown_52w_pct} onChange={(value) => setDraft({ ...draft, drawdown_52w_pct: value })} />
              </div>
              <Field label="Notes / 备注">
                <Textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
              </Field>
              <Button type="submit" variant="primary" disabled={!draft.ticker.trim()}>
                <Plus className="h-4 w-4" />
                {t.addStock}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t.scanner}</CardTitle>
            <Badge>Top {broadScan.length}/100</Badge>
          </CardHeader>
          <CardContent className="grid min-w-0 gap-4 p-3 sm:p-5">
            <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm leading-6 text-muted">{t.localOnly}</div>
            <div className="grid gap-3 rounded-lg border border-stroke bg-canvas p-3 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2 font-medium text-ink">Using Free Plan Compatible Mode</div>
              <div className="rounded-md border border-stroke bg-panel px-3 py-2">Universe Loaded: S&amp;P500: {UNIVERSE_DIAGNOSTICS.sp500}</div>
              <div className="rounded-md border border-stroke bg-panel px-3 py-2">Nasdaq100: {UNIVERSE_DIAGNOSTICS.nasdaq100}</div>
              <div className="rounded-md border border-stroke bg-panel px-3 py-2">Dow30: {UNIVERSE_DIAGNOSTICS.dow30}</div>
              <div className="rounded-md border border-stroke bg-panel px-3 py-2">Total Tickers: {UNIVERSE_DIAGNOSTICS.total}</div>
            </div>
            <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm leading-6 text-muted">
              {backendOnline === null
                ? `Checking optional backend: ${API_BASE}/health`
                : backendOnline
                  ? `Optional backend online for Yahoo fallback: ${API_BASE}`
                  : BACKEND_OFFLINE_MESSAGE}
            </div>
            <Button type="button" variant="primary" onClick={() => void runLocalStage1()} disabled={busy}>
              <RefreshCcw className="h-4 w-4" />
              {t.runYahoo}
            </Button>
            <Button type="button" variant="primary" onClick={() => void runAutoCompleteAvailableData()} disabled={busy}>
              <DownloadCloud className="h-4 w-4" />
              One-Click Data Completion / 一键补全数据
            </Button>
            <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm leading-6 text-muted">
              Runs local universe, SEC FCF/fundamentals fallback, and a safe FMP Make Valid batch in one flow. It cannot bypass
              premium-blocked endpoints or missing company disclosures; remaining gaps stay visible in Data Coverage.
              一键运行本地股票池、SEC FCF/基本面备用数据和安全 FMP 补全扫描；如果接口被套餐限制或公司没有披露数据，系统会保留缺口原因。
            </div>
            <Field label="FMP API Key / FMP 密钥">
              <Input type="password" value={allocation.fmp_api_key} onChange={(event) => saveAllocation({ ...allocation, fmp_api_key: event.target.value })} placeholder="Optional" />
            </Field>
            <Button type="button" variant="ghost" onClick={() => void testFmpApiKey()} disabled={busy || !allocation.fmp_api_key.trim() || remainingFmpQuota <= 0}>
              Test FMP Endpoint Capabilities
            </Button>
            {fmpTestStatus ? (
              <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm leading-6 text-muted">{fmpTestStatus}</div>
            ) : null}
            <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm leading-6 text-muted">
              Endpoint availability, quota reconciliation, and blocked-plan memory are available in Data Coverage.
            </div>
            <Button type="button" variant="secondary" onClick={runFmpScan} disabled={busy || !allocation.fmp_api_key.trim()}>
              <DownloadCloud className="h-4 w-4" />
              Preview Stage 2 FMP Deep Scan
            </Button>
            <Button type="button" variant="ghost" onClick={runExperimentalYahooFallback} disabled={busy || backendOnline !== true}>
              Experimental Yahoo Fallback
            </Button>
            <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm leading-6 text-muted">{status}</div>
            <div className="grid gap-2">
              {broadScan.slice(0, 5).map((analysis) => (
                <SmallRank key={analysis.stock.id} analysis={analysis} language={language} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div> : null}

      {activeTab === "diagnostics" ? <>
        <LocalDataBackupPanel />
        <FmpFieldMappingAudit stocks={stocks} />
        <FmpMappingRepairComparison rows={mappingComparisons} />
        <FmpRawResponseInspector stocks={stocks} cache={cacheInfo} />
      </> : null}

      {activeTab === "portfolio" ? <div className="grid min-w-0 gap-4 sm:gap-6 2xl:grid-cols-[1fr_0.85fr]">
        <PortfolioCard
          language={language}
          title={t.portfolio}
          portfolio={portfolio}
          holdings={holdings}
          holdingDraft={holdingDraft}
          setHoldingDraft={setHoldingDraft}
          saveHolding={saveHolding}
          deleteHolding={(id) => saveHoldings(holdings.filter((holding) => holding.id !== id))}
        />
        <AllocationCard language={language} title={t.allocation} allocation={allocation} saveAllocation={saveAllocation} />
      </div> : null}

      {activeTab === "valuation" ? <CollapsibleCard title={t.rankings} icon={<BarChart3 className="h-4 w-4 shrink-0 text-accent" />} defaultOpen contentClassName="overflow-x-auto">
        <div className="grid min-w-0 gap-4 sm:gap-6">
          <div className="grid min-w-0 gap-4 lg:grid-cols-2 sm:gap-6">
            <Ranking title={t.reliableCandidates} rows={rankings.reliable} language={language} />
            <Ranking title={t.incompleteCandidates} rows={rankings.incomplete} language={language} />
          </div>
          <div className="grid min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-3 sm:gap-6">
            <Ranking title={t.topRecommended} rows={rankings.top} language={language} />
            <Ranking title={t.bestValue} rows={rankings.value} language={language} />
            <Ranking title={t.highestQuality} rows={rankings.quality} language={language} />
            <Ranking title={t.lowestRisk} rows={rankings.lowRisk} language={language} />
            <Ranking title={t.highestRisk} rows={rankings.highRisk} language={language} />
            <Ranking title={t.waitList} rows={rankings.wait} language={language} />
          </div>
          <Ranking title={t.avoidList} rows={rankings.avoid} language={language} wide />
        </div>
      </CollapsibleCard> : null}

      {activeTab === "diagnostics" ? <>
        <RankingAudit rows={rankingAuditRows} />
        <PrimaryDcfAudit analyses={analyses} />
        <ScenarioValuationAudit analyses={analyses} />
        <DataSourceDiagnostics analyses={analyses} cache={cacheInfo} />
      </> : null}

      {activeTab === "valuation" ? <>
        <ReverseDcfAudit analyses={analyses} assumptions={assumptions} />
        <AnalysisDetail title="Valuation Conclusions / 估值结论" rows={analyses.slice(0, 12)} language={language} cache={cacheInfo} assumptions={assumptions} />
      </> : null}

      {activeTab === "scenario" ? <>
        <ScenarioDecisionRankings rankings={scenarioRankings} />
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          {validScenarioAnalyses.length > 0 ? validScenarioAnalyses.slice(0, 12).map((analysis) => (
            <DashboardCard key={analysis.stock.id} className="min-w-0" padding="compact">
              <ScenarioValuationEngine analysis={analysis} />
            </DashboardCard>
          )) : (
            <EmptyState
              title="No valid scenario data"
              description="Complete price, FCF, share count, and historical data before relying on scenario decisions."
              className="xl:col-span-2"
            />
          )}
        </div>
      </> : null}

      {activeTab === "portfolio" ? <div className="grid min-w-0 gap-4 sm:gap-6">
        <WatchlistCard title={t.watchlist} language={language} watchlist={watchlist} draft={watchDraft} setDraft={setWatchDraft} saveWatch={saveWatch} deleteWatch={(id) => saveWatchlist(watchlist.filter((item) => item.id !== id))} />
      </div> : null}
    </div>
  );
}

function InvestmentWorkflow({
  steps,
  onSelect
}: {
  steps: Array<{ label: string; complete: boolean }>;
  onSelect: (tab: InvestmentTab) => void;
}) {
  const targetTabs: InvestmentTab[] = ["scanner", "coverage", "scanner", "scanner", "overview", "scenario", "portfolio"];
  const completed = steps.filter((step) => step.complete).length;
  return (
    <DashboardCard padding="default">
      <SectionHeader
        title="Investment Research Workflow"
        description="A compact path from universe loading to a documented watchlist or portfolio decision."
        action={<StatusBadge tone={completed === steps.length ? "positive" : "neutral"}>{completed} / {steps.length} complete</StatusBadge>}
      />
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <button
            key={step.label}
            type="button"
            onClick={() => onSelect(targetTabs[index])}
            className="focus-ring flex min-w-0 items-center gap-3 rounded-md border border-stroke bg-canvas px-3 py-3 text-left transition hover:border-accent/40 hover:bg-panel"
          >
            <span className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-md border text-xs font-semibold",
              step.complete ? "border-positive/30 bg-positive/10 text-positive" : "border-stroke bg-panel text-muted"
            )}>
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block break-words text-sm font-medium text-ink">{step.label}</span>
              <span className="mt-0.5 block text-xs text-muted">{step.complete ? "Complete" : "Open step"}</span>
            </span>
          </button>
        ))}
      </div>
    </DashboardCard>
  );
}

function OverviewList({
  title,
  rows,
  language,
  empty,
  showScenario = false
}: {
  title: string;
  rows: StockAnalysis[];
  language: Language;
  empty: string;
  showScenario?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 text-sm font-semibold text-ink">{title}</div>
      {rows.length ? (
        <DataTableWrapper>
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="border-b border-stroke bg-canvas text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Stock</th>
                <th className="px-3 py-2 font-medium">Decision</th>
                <th className="px-3 py-2 text-right font-medium">{showScenario ? "Risk / Reward" : "Score"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((analysis) => {
                const scenario = analysis.valuation.scenarioValuation;
                const needsAttention = showScenario
                  ? scenarioDecisionNeedsAttention(scenario.decisionLabel) || !hasMeasurableScenarioRiskReward(analysis)
                  : analysisNeedsAttention(analysis);
                return (
                  <tr key={analysis.stock.id} className="border-b border-stroke/70 last:border-0">
                    <td className="px-3 py-2">
                      <div className="font-medium text-ink">{analysis.stock.ticker}</div>
                      <div className="max-w-40 truncate text-xs text-muted">{analysis.stock.company_name || "Company name unavailable"}</div>
                    </td>
                    <td className={cn("px-3 py-2 text-xs", attentionMutedTextClass(needsAttention))}>
                      {showScenario ? scenario.decisionLabel : recommendationLabel(language, analysis.recommendation)}
                    </td>
                    <td className={cn("px-3 py-2 text-right font-semibold", attentionTextClass(needsAttention))}>
                      {showScenario ? comparisonValue(scenario.riskRewardRatio) : analysis.totalScore}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTableWrapper>
      ) : (
        <EmptyState title="No results yet" description={empty} />
      )}
    </div>
  );
}

function InvestmentScannerDiagnostics({
  stockCount,
  broadScanCount,
  coverageRows,
  validScenarioCount,
  backendOnline,
  hasApiKey,
  remainingQuota,
  officialUsed,
  officialLimit,
  capabilities,
  attemptStats,
  cacheAudit,
  preview,
  lastBatch,
  status,
  fmpTestStatus
}: {
  stockCount: number;
  broadScanCount: number;
  coverageRows: CoverageRow[];
  validScenarioCount: number;
  backendOnline: boolean | null;
  hasApiKey: boolean;
  remainingQuota: number;
  officialUsed: number;
  officialLimit: number;
  capabilities: Record<FmpCapabilityId, FmpCapabilityResult>;
  attemptStats: FmpAttemptStats;
  cacheAudit: FmpCacheAuditRow[];
  preview: CoverageScanPreview | null;
  lastBatch: ScanRoiBatch | null;
  status: string;
  fmpTestStatus: string;
}) {
  const capabilityRows = FMP_CAPABILITY_DEFINITIONS.map((definition) => capabilities[definition.id]);
  const availableEndpoints = capabilityRows.filter((capability) => capability.status === "available").length;
  const blockedEndpoints = capabilityRows.filter((capability) => capability.status === "premium blocked").length;
  const untestedEndpoints = capabilityRows.filter((capability) => capability.status === "untested").length;
  const repairableCaches = cacheAudit.filter((row) => row.category === "empty cache" || row.category === "failed cache");
  const unknownEndpointRows = coverageRows.filter((row) =>
    row.endpointNeeds.some((endpoint) => endpoint.status === "unknown")
  ).length;
  const blockedOnlyRows = coverageRows.filter((row) => row.blockedFromValidity).length;
  const secReadyRows = coverageRows.filter((row) => row.secFcfAvailable && row.scannable).length;
  const totalAttempts = attemptStats.success
    + attemptStats.premiumBlocked
    + attemptStats.unauthorized
    + attemptStats.rateLimited
    + attemptStats.networkErrors
    + attemptStats.otherErrors;
  const likelyBlocker = !stockCount
    ? "Load the local stock universe first."
    : !hasApiKey
      ? "No FMP key is saved, so the app can only use local/manual data."
      : remainingQuota <= 0
        ? "Safe FMP remaining calls are zero. Reconcile official FMP usage before scanning."
        : repairableCaches.length
          ? "Empty or failed FMP cache entries should be repaired before the next scan."
          : blockedOnlyRows
            ? "Some stocks only need endpoints that are blocked by the current FMP plan."
            : unknownEndpointRows
              ? "Run the FMP capability test so preview estimates can avoid unknown endpoints."
              : "Scanner prerequisites look ready for preview-first scanning.";

  return (
    <CollapsibleCard
      title="Scanner Diagnostics"
      badge={<Badge>{repairableCaches.length ? `${repairableCaches.length} cache issue${repairableCaches.length === 1 ? "" : "s"}` : "Ready check"}</Badge>}
      defaultOpen
      contentClassName="grid gap-4"
    >
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ValueBox label="Loaded Stocks" value={`${stockCount}`} />
        <ValueBox label="Stage 1 Candidates" value={`${broadScanCount}`} />
        <ValueBox label="Scenario Valid" value={`${validScenarioCount}`} />
        <ValueBox label="Stage 1 FMP Limit" value={`${STAGE1_FMP_SYMBOL_LIMIT}`} />
        <ValueBox label="Safe FMP Calls" value={`${remainingQuota}`} />
        <ValueBox label="Official Usage" value={`${officialUsed} / ${officialLimit}`} />
        <ValueBox label="Endpoint Attempts" value={`${totalAttempts}`} />
        <ValueBox label="SEC-FCF Scannable" value={`${secReadyRows}`} />
      </div>

      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-stroke bg-canvas p-3">
          <div className="text-sm font-semibold text-ink">Current Blocker</div>
          <div className="mt-2 text-sm leading-6 text-muted">{likelyBlocker}</div>
          <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2">
            <div className="rounded-md border border-stroke bg-panel px-3 py-2">Backend: {backendOnline === null ? "Checking" : backendOnline ? "Online" : "Offline"}</div>
            <div className="rounded-md border border-stroke bg-panel px-3 py-2">FMP Key: {hasApiKey ? "Saved locally" : "Missing"}</div>
            <div className="rounded-md border border-stroke bg-panel px-3 py-2">Preview: {preview ? `${preview.selectedSymbols.length} symbols / ${preview.estimatedCalls} calls` : "Not created"}</div>
            <div className="rounded-md border border-stroke bg-panel px-3 py-2">Last Batch: {lastBatch ? `${lastBatch.newValidStocksGained} new valid / ${lastBatch.actualCallsUsed} calls` : "None"}</div>
          </div>
        </div>

        <div className="rounded-lg border border-stroke bg-canvas p-3">
          <div className="text-sm font-semibold text-ink">Endpoint Health</div>
          <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2">
            <div className="rounded-md border border-stroke bg-panel px-3 py-2">Available: <span className="font-medium text-ink">{availableEndpoints}</span></div>
            <div className="rounded-md border border-stroke bg-panel px-3 py-2">Premium Blocked: <span className="font-medium text-ink">{blockedEndpoints}</span></div>
            <div className="rounded-md border border-stroke bg-panel px-3 py-2">Untested: <span className="font-medium text-ink">{untestedEndpoints}</span></div>
            <div className="rounded-md border border-stroke bg-panel px-3 py-2">Repairable Cache: <span className="font-medium text-ink">{repairableCaches.length}</span></div>
            <div className="rounded-md border border-stroke bg-panel px-3 py-2">Success: <span className="font-medium text-ink">{attemptStats.success}</span></div>
            <div className="rounded-md border border-stroke bg-panel px-3 py-2">Rate Limited: <span className="font-medium text-ink">{attemptStats.rateLimited}</span></div>
            <div className="rounded-md border border-stroke bg-panel px-3 py-2">Unauthorized: <span className="font-medium text-ink">{attemptStats.unauthorized}</span></div>
            <div className="rounded-md border border-stroke bg-panel px-3 py-2">Network/Error: <span className="font-medium text-ink">{attemptStats.networkErrors + attemptStats.otherErrors}</span></div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm leading-6 text-muted">
        <span className="font-medium text-ink">Last status:</span> {status || "--"}
        {fmpTestStatus ? <span className="ml-2"><span className="font-medium text-ink">Capability test:</span> {fmpTestStatus}</span> : null}
      </div>
    </CollapsibleCard>
  );
}

function LocalDataBackupPanel() {
  const [summary, setSummary] = useState<ReturnType<typeof summarizeLocalBackup> | null>(null);
  const [lastBackup, setLastBackup] = useState<LocalDataBackup | null>(null);
  const [message, setMessage] = useState("Create a local JSON backup before large imports, cache repairs, or scan batches.");

  const refreshSummary = () => {
    if (typeof window === "undefined") return;
    setSummary(summarizeLocalBackup(createLocalBackup(window.localStorage)));
  };

  useEffect(() => {
    refreshSummary();
  }, []);

  const exportBackup = () => {
    if (typeof window === "undefined") return;
    const backup = createLocalBackup(window.localStorage);
    const nextSummary = summarizeLocalBackup(backup);
    setLastBackup(backup);
    setSummary(nextSummary);
    downloadLocalBackup(backup);
    setMessage(`Exported ${nextSummary.includedKeys} local data keys. Store the file privately because it may include your saved FMP key.`);
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || typeof window === "undefined") return;
    try {
      const backup = parseLocalBackupJson(await file.text());
      const result = restoreLocalBackup(backup, window.localStorage);
      const nextSummary = summarizeLocalBackup(backup);
      setLastBackup(backup);
      setSummary(nextSummary);
      setMessage(`Restored ${result.restoredCount} keys. Refresh the page to reload restored local data. Skipped unknown keys: ${result.skippedUnknownKeys.length}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Backup restore failed.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <CollapsibleCard
      title="Local Data Backup"
      badge={<Badge>{summary ? `${summary.includedKeys} keys found` : "LocalStorage"}</Badge>}
      defaultOpen={false}
      contentClassName="grid gap-4"
    >
      <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm leading-6 text-muted">
        Export and restore known Fabio Edge localStorage data only. Backups can include trade records, Investment Lab cache, SEC/FMP cache, scan ROI history, watchlists, portfolio data, preferences, and the locally saved FMP key if one exists.
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ValueBox label="Known Backup Keys" value={`${summary?.totalKnownKeys ?? "--"}`} />
        <ValueBox label="Keys Present Locally" value={`${summary?.includedKeys ?? "--"}`} />
        <ValueBox label="Sensitive Keys" value={`${summary?.sensitiveKeys ?? "--"}`} />
        <ValueBox label="Last Backup Date" value={lastBackup ? formatDateTime(lastBackup.exported_at) : "--"} />
      </div>
      {summary?.groups ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {Object.entries(summary.groups).map(([group, count]) => (
            <div key={group} className="flex items-center justify-between gap-3 rounded-md border border-stroke bg-canvas px-3 py-2 text-sm">
              <span className="text-muted">{group}</span>
              <span className="font-medium text-ink">{count}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" onClick={exportBackup}>
          <DownloadCloud className="h-4 w-4" />
          Export Local Backup
        </Button>
        <label className="focus-ring inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-stroke bg-panel px-3 text-sm font-medium text-ink transition hover:border-accent/40 hover:bg-canvas">
          <UploadCloud className="h-4 w-4" />
          Restore Backup
          <input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => void importBackup(event)} />
        </label>
        <Button type="button" variant="ghost" onClick={refreshSummary}>
          <RefreshCcw className="h-4 w-4" />
          Refresh Summary
        </Button>
      </div>
      <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm leading-6 text-muted">{message}</div>
    </CollapsibleCard>
  );
}

function FmpCapabilityPanel({
  capabilities,
  testStatus,
  disabled,
  onTest
}: {
  capabilities: Record<FmpCapabilityId, FmpCapabilityResult>;
  testStatus: string;
  disabled: boolean;
  onTest: () => void;
}) {
  return (
    <CollapsiblePanel
      title="FMP Endpoint Capability"
      description="Review available, blocked, and untested endpoints before spending quota."
      badge={<StatusBadge>{FMP_CAPABILITY_DEFINITIONS.filter((definition) => capabilities[definition.id].status === "available").length} available</StatusBadge>}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted">{testStatus || "Capability results are stored locally and reused by scan planning."}</div>
        <Button type="button" variant="ghost" onClick={onTest} disabled={disabled}>Test Capabilities</Button>
      </div>
      <DataTableWrapper>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-stroke bg-canvas text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Endpoint</th>
              <th className="px-3 py-2 font-medium">Capability</th>
              <th className="px-3 py-2 font-medium">HTTP</th>
              <th className="px-3 py-2 font-medium">Last Tested</th>
              <th className="px-3 py-2 font-medium">Response Preview</th>
            </tr>
          </thead>
          <tbody>
            {FMP_CAPABILITY_DEFINITIONS.map((definition) => {
              const capability = capabilities[definition.id];
              return (
                <tr key={definition.id} className="border-b border-stroke/70 last:border-0">
                  <td className="px-3 py-2 font-medium text-ink">{definition.label}</td>
                  <td className="px-3 py-2"><StatusBadge tone={capability.status === "available" ? "positive" : capability.status === "premium blocked" ? "caution" : capability.status === "error" ? "danger" : "neutral"}>{fmpCapabilityStatusLabel(capability.status)}</StatusBadge></td>
                  <td className="px-3 py-2 text-muted">{capability.httpStatus ?? "--"}</td>
                  <td className="px-3 py-2 text-muted">{formatDateTime(capability.testedAt, "not tested")}</td>
                  <td className="max-w-80 truncate px-3 py-2 text-muted" title={capability.preview}>{capability.preview || "--"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableWrapper>
    </CollapsiblePanel>
  );
}

function DataSourceDiagnostics({
  analyses,
  cache
}: {
  analyses: StockAnalysis[];
  cache: InvestmentCache;
}) {
  return (
    <CollapsiblePanel
      title="Data Source Audit"
      description="Advanced per-component source provenance. Closed by default to keep conclusions visible first."
      badge={<StatusBadge>{Math.min(analyses.length, 12)} records</StatusBadge>}
    >
      <div className="grid gap-3">
        {analyses.length ? analyses.slice(0, 12).map((analysis) => (
          <DataSourceAudit key={analysis.stock.id} analysis={analysis} cache={cache} />
        )) : (
          <EmptyState title="No data to audit" description="Load or add stock records before reviewing source provenance." />
        )}
      </div>
    </CollapsiblePanel>
  );
}

function CollapsibleCard({
  title,
  badge,
  icon,
  defaultOpen = false,
  children,
  contentClassName = ""
}: {
  title: string;
  badge?: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group min-w-0 overflow-hidden rounded-lg border border-stroke bg-panel shadow-soft"
    >
      <summary className="focus-ring flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 border-b border-transparent px-4 py-4 marker:hidden group-open:border-stroke sm:px-5 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-3">
          {icon}
          <h2 className="min-w-0 break-words text-base font-semibold text-ink">{title}</h2>
        </div>
        <div className="flex max-w-full shrink-0 items-center gap-2">
          {badge}
          <span className="hidden text-xs text-muted sm:inline group-open:hidden">Show details</span>
          <span className="hidden text-xs text-muted group-open:sm:inline">Hide details</span>
          <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
        </div>
      </summary>
      <div className={`min-w-0 p-3 sm:p-5 ${contentClassName}`}>{children}</div>
    </details>
  );
}

function FmpQuotaReconciliation({
  appTrackedCalls,
  officialUsed,
  officialLimit,
  safetyBuffer,
  safeRemaining,
  stats,
  onChange,
  onReset
}: {
  appTrackedCalls: number;
  officialUsed: number;
  officialLimit: number;
  safetyBuffer: number;
  safeRemaining: number;
  stats: FmpAttemptStats;
  onChange: (fields: Partial<Pick<InvestmentCache, "officialFmpUsed" | "officialFmpLimit" | "fmpSafetyBuffer">>) => void;
  onReset: () => void;
}) {
  return (
    <CollapsibleCard
      title="FMP Quota Reconciliation"
      badge={<Badge>Safe remaining: {safeRemaining}</Badge>}
      defaultOpen
      contentClassName="grid gap-4"
    >
      <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm leading-6 text-muted">
        FMP dashboard is the source of truth. App counter only tracks requests made after tracking was enabled. Enter the current dashboard usage before running a batch scan.
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ValueBox label="App Tracked Calls Today" value={`${appTrackedCalls}`} />
        <ValueBox label="Official FMP Usage" value={`${officialUsed} / ${officialLimit}`} />
        <ValueBox label="Safety Buffer" value={`${safetyBuffer}`} />
        <ValueBox label="Safe Remaining Calls" value={`${safeRemaining}`} />
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        <NumberField label="Official FMP calls used today" value={officialUsed} onChange={(value) => onChange({ officialFmpUsed: value ?? 0 })} />
        <NumberField label="Official FMP daily limit" value={officialLimit} onChange={(value) => onChange({ officialFmpLimit: value ?? 250 })} />
        <NumberField label="Safety buffer" value={safetyBuffer} onChange={(value) => onChange({ fmpSafetyBuffer: value ?? 10 })} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["200 success", stats.success],
          ["402 premium blocked", stats.premiumBlocked],
          ["403 unauthorized", stats.unauthorized],
          ["429 rate limited", stats.rateLimited],
          ["Network errors", stats.networkErrors],
          ["Other errors", stats.otherErrors]
        ].map(([label, count]) => (
          <div key={String(label)} className="rounded-md border border-stroke bg-canvas px-3 py-2 text-xs">
            <div className="text-muted">{label}</div>
            <div className="mt-1 text-lg font-semibold text-ink">{count}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs leading-5 text-muted">
          Local usage date: {todayKey()}. Safe remaining = official limit - official used - safety buffer. Every attempted request increments the app counter, including failed HTTP and network requests.
        </div>
        <Button type="button" variant="ghost" onClick={onReset}>Reset Today&apos;s Counters</Button>
      </div>
    </CollapsibleCard>
  );
}

function ScanRoiDashboard({
  history,
  today,
  lastBatch,
  bestMode,
  worstMode,
  lifetime,
  permanentlyBlockedEndpointIds
}: {
  history: ScanRoiBatch[];
  today: ScanRoiSummary;
  lastBatch: ScanRoiBatch | null;
  bestMode: { mode: ScanPriorityMode; summary: ScanRoiSummary } | null;
  worstMode: { mode: ScanPriorityMode; summary: ScanRoiSummary } | null;
  lifetime: ScanRoiSummary;
  permanentlyBlockedEndpointIds: FmpCapabilityId[];
}) {
  const callsPerValid = (value: number | null) => value === null ? "--" : value.toFixed(1);
  const roiLabel = (summary: ScanRoiSummary | null) => {
    if (!summary || summary.calls <= 0) return "--";
    return `${(summary.validStocksPerCall * 100).toFixed(1)} valid / 100 calls`;
  };
  const lastSummary = lastBatch ? scanRoiSummary([lastBatch]) : null;
  const zeroGainWarning = Boolean(lastBatch && lastBatch.actualCallsUsed > 0 && lastBatch.newValidStocksGained === 0);
  const endpointTotals = aggregateEndpointRoi(history);
  const cashFlowIneffective =
    permanentlyBlockedEndpointIds.includes("cashFlow")
    || (endpointTotals.cashFlow.calls >= 3 && endpointTotals.cashFlow.callsAddedFields === 0);
  return (
    <CollapsibleCard
      title="FMP Scan ROI"
      badge={<Badge>{history.length} confirmed batches</Badge>}
      defaultOpen
      contentClassName="grid gap-4"
    >
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <ValueBox label="Today's Scan ROI" value={roiLabel(today)} />
        <ValueBox label="Last Batch ROI" value={roiLabel(lastSummary)} />
        <ValueBox label="Best Priority Mode" value={bestMode ? `${bestMode.mode}: ${roiLabel(bestMode.summary)}` : "--"} />
        <ValueBox label="Worst Priority Mode" value={worstMode ? `${worstMode.mode}: ${roiLabel(worstMode.summary)}` : "--"} />
        <ValueBox label="Average Calls / Valid Stock" value={callsPerValid(lifetime.callsPerNewValidStock)} />
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ValueBox label="Today's Calls" value={`${today.calls}`} />
        <ValueBox label="Today's New Valid Stocks" value={`${today.newValidStocks}`} />
        <ValueBox label="Today's Successful Endpoints" value={`${today.successfulEndpoints}`} />
        <ValueBox label="Today's Failed / Premium Blocked" value={`${today.failedEndpoints} / ${today.premiumBlockedEndpoints}`} />
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        <ValueBox label="Calls Wasted On Blocked Endpoints" value={`${history.reduce((sum, batch) => sum + (batch.callsWastedOnBlockedEndpoints ?? batch.premiumBlockedEndpoints ?? 0), 0)}`} />
        <ValueBox label="Calls That Added Fields" value={`${history.reduce((sum, batch) => sum + (batch.callsAddedFields ?? 0), 0)}`} />
        <ValueBox label="Calls With No Usable Data" value={`${history.reduce((sum, batch) => sum + (batch.callsNoUsableData ?? 0), 0)}`} />
      </div>

      {zeroGainWarning ? (
        <div className="rounded-lg border border-caution/40 bg-caution/10 px-3 py-2 text-sm font-medium text-ink">
          If a scan batch uses calls but creates 0 new valid stocks, review missing endpoints before scanning more.
        </div>
      ) : null}
      {cashFlowIneffective ? (
        <div className="rounded-lg border border-caution/40 bg-caution/10 px-3 py-2 text-sm font-medium text-ink">
          FMP cashFlow appears blocked or ineffective. Use the SEC EDGAR FCF fallback instead of spending FMP calls.
        </div>
      ) : null}

      <div>
        <div className="mb-2 text-sm font-medium text-ink">Endpoint ROI</div>
        <div className="overflow-x-auto rounded-lg border border-stroke">
          <table className="min-w-[980px] w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-stroke bg-panel text-muted">
                <th className="px-3 py-2 font-medium">Endpoint</th>
                <th className="px-3 py-2 font-medium">Plan Status</th>
                <th className="px-3 py-2 font-medium">Calls</th>
                <th className="px-3 py-2 font-medium">Successful</th>
                <th className="px-3 py-2 font-medium">Added Fields</th>
                <th className="px-3 py-2 font-medium">No Usable Data</th>
                <th className="px-3 py-2 font-medium">Failed</th>
                <th className="px-3 py-2 font-medium">Premium Blocked</th>
                <th className="px-3 py-2 font-medium">Field Addition Rate</th>
              </tr>
            </thead>
            <tbody>
              {(["profile", "ratios", "income", "cashFlow", "historical"] as FmpCapabilityId[]).map((endpointId) => {
                const endpoint = endpointTotals[endpointId];
                return (
                  <tr key={`endpoint-roi-${endpointId}`} className="border-b border-stroke last:border-0">
                    <td className="px-3 py-3 font-medium text-ink">{endpointId}</td>
                    <td className="px-3 py-3 text-muted">{permanentlyBlockedEndpointIds.includes(endpointId) ? "Blocked by plan" : "Not permanently blocked"}</td>
                    <td className="px-3 py-3 text-muted">{endpoint.calls}</td>
                    <td className="px-3 py-3 text-muted">{endpoint.successfulCalls}</td>
                    <td className="px-3 py-3 font-medium text-ink">{endpoint.callsAddedFields}</td>
                    <td className="px-3 py-3 text-muted">{endpoint.callsNoUsableData}</td>
                    <td className="px-3 py-3 text-muted">{endpoint.failedCalls}</td>
                    <td className="px-3 py-3 text-muted">{endpoint.premiumBlockedCalls}</td>
                    <td className="px-3 py-3 text-muted">{endpoint.calls ? `${((endpoint.callsAddedFields / endpoint.calls) * 100).toFixed(1)}%` : "--"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-stroke">
        <table className="min-w-[2200px] w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-stroke bg-panel text-muted">
              <th className="px-3 py-2 font-medium">Batch Time</th>
              <th className="px-3 py-2 font-medium">Priority Mode</th>
              <th className="px-3 py-2 font-medium">Symbols Scanned</th>
              <th className="px-3 py-2 font-medium">Estimated Calls</th>
              <th className="px-3 py-2 font-medium">Actual Calls</th>
              <th className="px-3 py-2 font-medium">Successful</th>
              <th className="px-3 py-2 font-medium">Failed</th>
              <th className="px-3 py-2 font-medium">Premium Blocked</th>
              <th className="px-3 py-2 font-medium">Blocked Waste</th>
              <th className="px-3 py-2 font-medium">Added Fields</th>
              <th className="px-3 py-2 font-medium">No Usable Data</th>
              <th className="px-3 py-2 font-medium">Valid Before</th>
              <th className="px-3 py-2 font-medium">Valid After</th>
              <th className="px-3 py-2 font-medium">New Valid</th>
              <th className="px-3 py-2 font-medium">Hybrid Completed</th>
              <th className="px-3 py-2 font-medium">Remaining Missing Fields</th>
              <th className="px-3 py-2 font-medium">Calls / New Valid</th>
            </tr>
          </thead>
          <tbody>
            {history.slice(0, 30).map((batch) => (
              <tr key={batch.id} className="border-b border-stroke align-top last:border-0">
                <td className="whitespace-nowrap px-3 py-3 text-muted">{formatDateTime(batch.batchTime)}</td>
                <td className="max-w-56 px-3 py-3 font-medium text-ink"><span className="break-words">{batch.priorityMode}</span></td>
                <td className="max-w-96 px-3 py-3 text-muted"><span className="break-words">{batch.symbolsScanned.join(", ") || "--"}</span></td>
                <td className="px-3 py-3 text-muted">{batch.estimatedCalls}</td>
                <td className="px-3 py-3 font-medium text-ink">{batch.actualCallsUsed}</td>
                <td className="px-3 py-3 text-muted">{batch.successfulEndpoints}</td>
                <td className="px-3 py-3 text-muted">{batch.failedEndpoints}</td>
                <td className="px-3 py-3 text-muted">{batch.premiumBlockedEndpoints}</td>
                <td className="px-3 py-3 text-muted">{batch.callsWastedOnBlockedEndpoints ?? batch.premiumBlockedEndpoints ?? 0}</td>
                <td className="px-3 py-3 text-muted">{batch.callsAddedFields ?? 0}</td>
                <td className="px-3 py-3 text-muted">{batch.callsNoUsableData ?? 0}</td>
                <td className="px-3 py-3 text-muted">{batch.stocksValidBefore}</td>
                <td className="px-3 py-3 text-muted">{batch.stocksValidAfter}</td>
                <td className="px-3 py-3 font-medium text-ink">
                  {batch.newValidStocksGained}
                  {batch.newValidSymbols.length ? <div className="mt-1 max-w-48 break-words text-[11px] font-normal text-muted">{batch.newValidSymbols.join(", ")}</div> : null}
                </td>
                <td className="max-w-56 px-3 py-3 text-muted">
                  <span className="break-words">{batch.hybridCompletedSymbols?.join(", ") || "--"}</span>
                </td>
                <td className="max-w-[420px] px-3 py-3 text-muted">
                  <span className="break-words">
                    {Object.entries(batch.remainingMissingFields ?? {})
                      .filter(([, reasons]) => reasons.length)
                      .slice(0, 6)
                      .map(([ticker, reasons]) => `${ticker}: ${reasons.join(", ")}`)
                      .join(" | ") || "--"}
                  </span>
                </td>
                <td className="px-3 py-3 text-muted">{callsPerValid(batch.callsPerNewValidStock)}</td>
              </tr>
            ))}
            {!history.length ? (
              <tr>
                <td colSpan={17} className="px-3 py-6 text-center text-muted">
                  No confirmed scan batches recorded yet. Previewing or cancelling a scan does not create an ROI record.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {history.length > 30 ? <div className="text-xs text-muted">Showing the 30 most recent confirmed batches.</div> : null}
    </CollapsibleCard>
  );
}

function SecCoverageManager({
  rows,
  cache,
  stats,
  busy,
  backendOnline,
  onScan,
  onScanAll
}: {
  rows: CoverageRow[];
  cache: InvestmentCache;
  stats: SecCoverageStats;
  busy: boolean;
  backendOnline: boolean | null;
  onScan: (limit: number) => void;
  onScanAll: () => void;
}) {
  const freshCandidates = rows.filter(
    (row) => secCashFlowEntry(cache, row.analysis.stock.ticker)?.date !== todayKey()
  );
  return (
    <CollapsibleCard
      title="SEC EDGAR FCF Coverage Manager"
      badge={<Badge>No FMP quota used</Badge>}
      defaultOpen
      contentClassName="grid gap-4"
    >
      <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm leading-6 text-muted">
        SEC company facts provide annual operating cash flow, capital expenditure, revenue growth, margin, ROE,
        debt/equity, and shares outstanding from filed XBRL data.
        Requests are routed through FastAPI, cached locally, and limited to about one SEC request per second.
      </div>
      {backendOnline === false ? (
        <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm font-medium text-ink">
          Backend is offline. Start backend before running SEC EDGAR FCF fallback.
        </div>
      ) : null}
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <ValueBox label="Symbols Needing SEC FCF" value={`${rows.length}`} />
        <ValueBox label="Ready For New SEC Request" value={`${freshCandidates.length}`} />
        <ValueBox label="SEC Cache Hits" value={`${stats.cacheHits}`} />
        <ValueBox label="SEC Requests Made" value={`${stats.requestsMade}`} />
        <ValueBox label="Extraction Success / Failure" value={`${stats.extractionSuccesses} / ${stats.extractionFailures}`} />
        <ValueBox label="Stocks Made Valid By SEC" value={`${stats.stocksMadeValid}`} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={busy || backendOnline === false || freshCandidates.length === 0} onClick={() => onScan(10)}>
          Fetch Next 10 SEC FCF
        </Button>
        <Button type="button" variant="secondary" disabled={busy || backendOnline === false || freshCandidates.length === 0} onClick={() => onScan(25)}>
          Fetch Next 25 SEC FCF
        </Button>
        <Button type="button" variant="primary" disabled={busy || backendOnline === false || freshCandidates.length === 0} onClick={onScanAll}>
          Run All Free SEC Backfill
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-stroke">
        <table className="min-w-[900px] w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-stroke bg-canvas text-muted">
              <th className="px-3 py-2 font-medium">Symbol</th>
              <th className="px-3 py-2 font-medium">CIK</th>
              <th className="px-3 py-2 font-medium">SEC Status</th>
              <th className="px-3 py-2 font-medium">Real Data</th>
              <th className="px-3 py-2 font-medium">Missing</th>
              <th className="px-3 py-2 font-medium">Next Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 30).map((row) => {
              const ticker = row.analysis.stock.ticker;
              const entry = secCashFlowEntry(cache, ticker);
              return (
                <tr key={`sec-coverage-${ticker}`} className="border-b border-stroke align-top last:border-0">
                  <td className="px-3 py-3 font-medium text-ink">{ticker}</td>
                  <td className="px-3 py-3 text-muted">{entry?.data.cik ?? cache.secTickerCik?.[ticker]?.cik ?? "--"}</td>
                  <td className="px-3 py-3 text-muted">{entry?.data.status ?? "not fetched"}</td>
                  <td className="px-3 py-3 text-muted">{row.analysis.realDataPercent}%</td>
                  <td className="max-w-80 px-3 py-3 text-muted"><span className="break-words">{row.reasons.join(", ")}</span></td>
                  <td className="max-w-72 px-3 py-3 text-muted">
                    <span className="break-words">
                      {entry?.data.status === "missing" || entry?.data.status === "error"
                        ? entry.data.error ?? "SEC data missing or ambiguous."
                        : entry?.date === todayKey()
                          ? "Review cached SEC extraction."
                          : "Fetch SEC company facts."}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted">No stocks currently need the SEC FCF fallback.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-muted">
        Last run: {formatDateTime(stats.lastRunAt)}. Symbols: {stats.lastRunSymbols.join(", ") || "--"}.
      </div>
    </CollapsibleCard>
  );
}

function SecRawInspector({
  cache,
  ticker,
  busy,
  backendOnline,
  onTickerChange,
  onLoad,
  onRefresh
}: {
  cache: InvestmentCache;
  ticker: string;
  busy: boolean;
  backendOnline: boolean | null;
  onTickerChange: (ticker: string) => void;
  onLoad: () => void;
  onRefresh: () => void;
}) {
  const normalizedTicker = ticker.trim().toUpperCase();
  const entry = secCashFlowEntry(cache, normalizedTicker);
  const result = entry?.data;
  return (
    <CollapsibleCard
      title="SEC Raw Inspector"
      badge={<Badge>{result?.status ?? "No cache"}</Badge>}
      contentClassName="grid gap-4"
    >
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Ticker">
          <Input value={ticker} onChange={(event) => onTickerChange(event.target.value.toUpperCase())} placeholder="AAPL" />
        </Field>
        <Button type="button" variant="secondary" onClick={onLoad} disabled={busy || backendOnline === false || !normalizedTicker}>
          Load / Use Cache
        </Button>
        <Button type="button" variant="ghost" onClick={onRefresh} disabled={busy || backendOnline === false || !normalizedTicker}>
          Force SEC Refresh
        </Button>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ValueBox label="CIK" value={result?.cik ?? cache.secTickerCik?.[normalizedTicker]?.cik ?? "--"} />
        <ValueBox label="Operating Cash Flow Concept" value={result?.operating_cash_flow_concept ?? "--"} />
        <ValueBox label="CapEx Concept" value={result?.capex_concept ?? "--"} />
        <ValueBox label="Annual Periods Found" value={`${result?.annual_periods.length ?? 0}`} />
        <ValueBox label="Latest Operating Cash Flow" value={compactMoney(result?.latest_operating_cash_flow)} />
        <ValueBox label="Latest CapEx" value={compactMoney(result?.latest_capex)} />
        <ValueBox label="Latest Free Cash Flow" value={compactMoney(result?.latest_fcf)} />
        <ValueBox label="Confidence" value={result?.confidence ?? "--"} />
      </div>
      {result?.error ? (
        <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm text-ink">{result.error}</div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-stroke">
        <table className="min-w-[1100px] w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-stroke bg-canvas text-muted">
              <th className="px-3 py-2 font-medium">Fiscal Year</th>
              <th className="px-3 py-2 font-medium">End</th>
              <th className="px-3 py-2 font-medium">Filed</th>
              <th className="px-3 py-2 font-medium">Operating Cash Flow</th>
              <th className="px-3 py-2 font-medium">CapEx Raw</th>
              <th className="px-3 py-2 font-medium">CapEx Normalized</th>
              <th className="px-3 py-2 font-medium">Free Cash Flow</th>
              <th className="px-3 py-2 font-medium">Sign Audit</th>
            </tr>
          </thead>
          <tbody>
            {(result?.annual_periods ?? []).map((period) => (
              <tr key={`${normalizedTicker}-${period.fiscal_year}-${period.end}`} className="border-b border-stroke last:border-0">
                <td className="px-3 py-3 font-medium text-ink">{period.fiscal_year}</td>
                <td className="px-3 py-3 text-muted">{period.end || "--"}</td>
                <td className="px-3 py-3 text-muted">{period.filed || "--"}</td>
                <td className="px-3 py-3 text-muted">{compactMoney(period.operating_cash_flow)}</td>
                <td className="px-3 py-3 text-muted">{compactMoney(period.capex_raw)}</td>
                <td className="px-3 py-3 text-muted">{compactMoney(period.capex)}</td>
                <td className="px-3 py-3 font-medium text-ink">{compactMoney(period.free_cash_flow)}</td>
                <td className="max-w-96 px-3 py-3 text-muted"><span className="break-words">{period.capex_sign_note}</span></td>
              </tr>
            ))}
            {!result?.annual_periods.length ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted">No cached SEC annual cash-flow periods for this ticker.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </CollapsibleCard>
  );
}

function DataCoverageManager({
  view,
  totalStocks,
  validStocks,
  coverageRows,
  distribution,
  scannedToday,
  remainingQuota,
  estimatedDays,
  pendingCalls,
  cacheAudit,
  cacheRepairSummary,
  onRepairCaches,
  busy,
  hasApiKey,
  prioritySettings,
  onPrioritySettingsChange,
  preview,
  onPreview,
  onConfirm,
  onCancel,
  onRunLocalStage1,
  onOpenCoverage,
  manualDrafts,
  onManualChange,
  onManualSave,
  lastHybridBatch
}: {
  view: "scanner" | "coverage";
  totalStocks: number;
  validStocks: number;
  coverageRows: CoverageRow[];
  distribution: Array<{ label: string; count: number }>;
  scannedToday: number;
  remainingQuota: number;
  estimatedDays: number;
  pendingCalls: number;
  cacheAudit: FmpCacheAuditRow[];
  cacheRepairSummary: FmpCacheRepairSummary | null;
  onRepairCaches: (action: FmpCacheRepairSummary["action"]) => void;
  busy: boolean;
  hasApiKey: boolean;
  prioritySettings: ScanPrioritySettings;
  onPrioritySettingsChange: (settings: ScanPrioritySettings) => void;
  preview: CoverageScanPreview | null;
  onPreview: (size: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onRunLocalStage1: () => void;
  onOpenCoverage: () => void;
  manualDrafts: Record<string, CoverageManualDraft>;
  onManualChange: (ticker: string, field: CoverageManualField, value: number | null) => void;
  onManualSave: (stock: StockRecord) => void;
  lastHybridBatch: ScanRoiBatch | null;
}) {
  const reasonCount = (reason: string) => coverageRows.filter((row) => row.reasons.includes(reason)).length;
  const missingHistorical = coverageRows.filter((row) =>
    row.reasons.includes("missing historical EOD") || row.reasons.includes("missing 3-year FCF history")
  ).length;
  const scannableRows = coverageRows.filter((row) => row.scannable);
  const currentPlanRows = coverageRows.filter(
    (row) => row.scannable && row.endpointNeeds.every((endpoint) => endpoint.status === "available")
  );
  const secFallbackRows = coverageRows.filter((row) => row.requiresSecFallback);
  const blockedOnlyRows = coverageRows.filter((row) => row.blockedFromValidity);
  const nextSymbols = scannableRows.slice(0, 25).map((row) => row.analysis.stock.ticker);
  const visibleRows = coverageRows.slice(0, 50);
  const cacheCategoryCount = (category: FmpCacheCategory) =>
    cacheAudit.filter((row) => row.category === category).length;
  const emptyCacheRows = cacheAudit.filter((row) => row.category === "empty cache");
  const failedCacheRows = cacheAudit.filter((row) => row.category === "failed cache");
  const repairableCacheRows = [...emptyCacheRows, ...failedCacheRows];
  const maxDistribution = Math.max(1, ...distribution.map((item) => item.count));
  const totalPriorityWeight = Object.values(prioritySettings.weights).reduce((sum, weight) => sum + weight, 0);
  const emptyPreviewReason = !totalStocks
    ? "No stocks are loaded yet. Run Free/Local Stage 1 first so the app has a universe to analyze."
    : !coverageRows.length
      ? "There are no insufficient-data stocks in the current local dataset. Load or import more data, or review existing records in Data Coverage."
      : !scannableRows.length
        ? "Insufficient stocks exist, but none can be scanned with the current FMP plan and cache state. Open Data Coverage to review blocked endpoints, SEC fallback, or manual fixes."
        : "No symbols were selected for this batch. Try a smaller batch after refreshing the preview or review scan priority filters.";
  const hybridFieldLabel = (field: HybridFieldStatus) =>
    field.available ? `Yes · ${field.source}` : "No · --";
  const hybridFieldClass = (field: HybridFieldStatus) =>
    attentionMutedTextClass(!field.available);
  const updateWeight = (key: keyof ScanPriorityWeights, value: number | null) => {
    onPrioritySettingsChange({
      ...prioritySettings,
      weights: { ...prioritySettings.weights, [key]: Math.max(0, value ?? 0) }
    });
  };
  const toggleSector = (sector: ScanPrioritySector) => {
    const selected = prioritySettings.preferredSectors.includes(sector);
    onPrioritySettingsChange({
      ...prioritySettings,
      preferredSectors: selected
        ? prioritySettings.preferredSectors.filter((item) => item !== sector)
        : [...prioritySettings.preferredSectors, sector]
    });
  };
  return (
    <CollapsibleCard
      title={view === "scanner" ? "Make Valid Scanner" : "Investment Data Coverage Manager"}
      badge={<Badge>{view === "scanner" ? `${scannableRows.length} queued` : `${validStocks} valid / ${coverageRows.length} insufficient`}</Badge>}
      defaultOpen
      contentClassName="grid gap-5"
    >
      {view === "coverage" ? (
        <>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ValueBox label="Total Universe Stocks" value={`${totalStocks}`} />
        <ValueBox label="Valid Scenario Stocks" value={`${validStocks}`} />
        <ValueBox label="Insufficient Data Stocks" value={`${coverageRows.length}`} />
        <ValueBox label="Coverage Rate" value={totalStocks ? `${((validStocks / totalStocks) * 100).toFixed(1)}%` : "--"} />
        <ValueBox label="Can Scan With FMP Plan" value={`${currentPlanRows.length}`} />
        <ValueBox label="SEC FCF Fallback Needed" value={`${secFallbackRows.length}`} />
        <ValueBox label="Cannot Make Valid Automatically" value={`${blockedOnlyRows.length}`} />
        <ValueBox label="SEC FCF Available" value={`${coverageRows.filter((row) => row.secFcfAvailable).length}`} />
      </div>

      {lastHybridBatch ? (
        <div className="grid gap-3 rounded-lg border border-stroke bg-canvas p-3 sm:grid-cols-2 xl:grid-cols-4">
          <ValueBox label="Hybrid Stocks Completed" value={`${lastHybridBatch.hybridCompletedSymbols?.length ?? 0}`} />
          <ValueBox label="New Valid Stocks" value={`${lastHybridBatch.newValidStocksGained}`} />
          <ValueBox label="FMP Calls Used" value={`${lastHybridBatch.actualCallsUsed}`} />
          <ValueBox
            label="Calls / New Valid Stock"
            value={lastHybridBatch.callsPerNewValidStock === null ? "--" : lastHybridBatch.callsPerNewValidStock.toFixed(1)}
          />
          <div className="sm:col-span-2 xl:col-span-4 text-xs leading-5 text-muted">
            Completed: {lastHybridBatch.hybridCompletedSymbols?.join(", ") || "--"}.
            Remaining issues: {Object.entries(lastHybridBatch.remainingMissingFields ?? {})
              .filter(([, reasons]) => reasons.length)
              .slice(0, 8)
              .map(([ticker, reasons]) => `${ticker}: ${reasons.join(", ")}`)
              .join(" | ") || "None recorded"}.
          </div>
        </div>
      ) : null}
        </>
      ) : null}

      {view === "scanner" ? (
      <div className="grid min-w-0 gap-4 rounded-lg border border-stroke bg-canvas p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink">FMP Empty Cache Repair</div>
            <div className="mt-1 max-w-3xl text-xs leading-5 text-muted">
              Empty and failed entries no longer count as fresh data. Repair removes only bad FMP response entries.
              Valid caches, stale usable data, premium-block memory, SEC FCF cache, and quota counters remain intact.
            </div>
          </div>
          <Badge>{repairableCacheRows.length} repairable</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <ValueBox label="Valid Data Cache" value={`${cacheCategoryCount("valid data cache")}`} />
          <ValueBox label="Empty Cache" value={`${emptyCacheRows.length}`} />
          <ValueBox label="Failed Cache" value={`${failedCacheRows.length}`} />
          <ValueBox label="Premium Blocked Cache" value={`${cacheCategoryCount("premium blocked cache")}`} />
          <ValueBox label="Stale Cache" value={`${cacheCategoryCount("stale cache")}`} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onRepairCaches("empty")}
            disabled={busy || !emptyCacheRows.length}
          >
            Clear Empty FMP Caches
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onRepairCaches("failed")}
            disabled={busy || !failedCacheRows.length}
          >
            Clear Failed FMP Caches
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onRepairCaches("empty and failed")}
            disabled={busy || !repairableCacheRows.length}
          >
            Clear Empty + Failed
          </Button>
        </div>

        {cacheRepairSummary ? (
          <div className="grid gap-3 rounded-lg border border-stroke bg-panel p-3 sm:grid-cols-2 xl:grid-cols-4">
            <ValueBox label="Empty Caches Found" value={`${cacheRepairSummary.emptyCachesFound}`} />
            <ValueBox label="Failed Caches Found" value={`${cacheRepairSummary.failedCachesFound}`} />
            <ValueBox label="Caches Cleared" value={`${cacheRepairSummary.cachesCleared}`} />
            <ValueBox label="Repair Time" value={formatDateTime(cacheRepairSummary.repairedAt)} />
            <div className="break-words text-xs leading-5 text-muted sm:col-span-2 xl:col-span-4">
              Symbols affected: {cacheRepairSummary.symbolsAffected.join(", ") || "--"}.
              Endpoints affected: {cacheRepairSummary.endpointsAffected.join(", ") || "--"}.
              Next recommended batch: {cacheRepairSummary.nextRecommendedBatch.join(", ") || "No currently scannable symbols"}.
            </div>
          </div>
        ) : null}

        {repairableCacheRows.length ? (
          <div className="overflow-x-auto rounded-lg border border-stroke">
            <table className="min-w-[900px] w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-stroke bg-panel text-muted">
                  <th className="px-3 py-2 font-medium">Symbol</th>
                  <th className="px-3 py-2 font-medium">Endpoint</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Cache Date</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {repairableCacheRows.slice(0, 50).map((row) => (
                  <tr key={`cache-audit-${row.cacheKey}`} className="border-b border-stroke last:border-0">
                    <td className="px-3 py-3 font-medium text-ink">{row.symbols.join(", ") || "--"}</td>
                    <td className="px-3 py-3 text-muted">{row.capabilityId ?? cacheKeyPath(row.cacheKey)}</td>
                    <td className="px-3 py-3"><Badge>{row.category}</Badge></td>
                    <td className="px-3 py-3 text-muted">{row.date || "--"}</td>
                    <td className="max-w-96 px-3 py-3 text-muted"><span className="break-words">{row.reason}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-md border border-stroke bg-panel px-3 py-2 text-sm text-muted">
            No empty or failed FMP cache entries are currently stored.
          </div>
        )}
      </div>
      ) : null}

      {view === "coverage" ? (
      <div className="grid min-w-0 gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-stroke bg-canvas p-3">
          <div className="text-sm font-medium text-ink">Missing Data Summary</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              ["Missing price", reasonCount("missing current price")],
              ["Missing FCF", reasonCount("missing FCF")],
              ["Missing historical data", missingHistorical],
              ["Missing share count", reasonCount("missing shares outstanding")],
              ["Missing income statement", reasonCount("missing income statement")],
              ["Insufficient real data", reasonCount("insufficient real data")]
            ].map(([label, count]) => (
              <div key={String(label)} className="flex items-center justify-between gap-3 rounded-md border border-stroke bg-panel px-3 py-2 text-sm">
                <span className="text-muted">{label}</span>
                <span className="font-medium text-ink">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-stroke bg-canvas p-3">
          <div className="text-sm font-medium text-ink">Real Data Distribution</div>
          <div className="mt-3 grid gap-3">
            {distribution.map((item) => (
              <div key={item.label} className="grid grid-cols-[64px_minmax(0,1fr)_44px] items-center gap-2 text-xs">
                <span className="text-muted">{item.label}</span>
                <div className="h-2 overflow-hidden rounded-sm bg-panel">
                  <div className="h-full bg-accent" style={{ width: `${(item.count / maxDistribution) * 100}%` }} />
                </div>
                <span className="text-right font-medium text-ink">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      ) : null}

      {view === "scanner" ? (
        <>
      <div className="grid min-w-0 gap-4 rounded-lg border border-stroke bg-canvas p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink">Custom Scan Priority Controls</div>
            <div className="mt-1 text-xs leading-5 text-muted">
              Settings are saved locally. Manual tickers always move ahead of automatic ranking.
            </div>
          </div>
          <Badge>{totalPriorityWeight}% total weight</Badge>
        </div>

        <div className="grid min-w-0 gap-3 lg:grid-cols-2">
          <Field label="Scan Priority Mode" helper="The selected mode becomes the primary ranking signal. Custom weights remain the secondary signal.">
            <Select
              value={prioritySettings.mode}
              options={SCAN_PRIORITY_MODES}
              onChange={(event) => onPrioritySettingsChange({ ...prioritySettings, mode: event.target.value as ScanPriorityMode })}
            />
          </Field>
          <TextField
            label="Manual Priority List"
            value={prioritySettings.manualTickers}
            onChange={(value) => onPrioritySettingsChange({ ...prioritySettings, manualTickers: value.toUpperCase() })}
          />
        </div>
        <div className="text-xs leading-5 text-muted">
          Manual order example: AVGO, TSLA, LLY, BRK-B, WMT, AMD. Listed symbols override the selected automatic mode; unlisted symbols follow the calculated score.
        </div>

        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-normal text-muted">Custom Priority Weights</div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField label="Market Cap Weight %" value={prioritySettings.weights.marketCap} onChange={(value) => updateWeight("marketCap", value)} />
            <NumberField label="Data Coverage Weight %" value={prioritySettings.weights.dataCoverage} onChange={(value) => updateWeight("dataCoverage", value)} />
            <NumberField label="Watchlist Weight %" value={prioritySettings.weights.watchlist} onChange={(value) => updateWeight("watchlist", value)} />
            <NumberField label="Sector Preference Weight %" value={prioritySettings.weights.sectorPreference} onChange={(value) => updateWeight("sectorPreference", value)} />
            <NumberField label="Missing Fields Weight %" value={prioritySettings.weights.missingFields} onChange={(value) => updateWeight("missingFields", value)} />
            <NumberField label="Quality Score Weight %" value={prioritySettings.weights.quality} onChange={(value) => updateWeight("quality", value)} />
            <NumberField label="Valuation Score Weight %" value={prioritySettings.weights.valuation} onChange={(value) => updateWeight("valuation", value)} />
            <NumberField label="Risk Score Weight %" value={prioritySettings.weights.risk} onChange={(value) => updateWeight("risk", value)} />
          </div>
          <div className="mt-2 text-xs leading-5 text-muted">
            Scores are normalized by the current total weight, so the fields do not need to add to exactly 100%.
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-normal text-muted">Preferred Sectors</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {SCAN_PRIORITY_SECTORS.map((sector) => (
              <label key={sector} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md border border-stroke bg-panel px-3 py-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={prioritySettings.preferredSectors.includes(sector)}
                  onChange={() => toggleSector(sector)}
                  className="h-4 w-4 shrink-0 accent-current"
                />
                <span className="break-words">{sector}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs leading-5 text-muted">
            Current mode: <span className="font-medium text-ink">{prioritySettings.mode}</span>
          </div>
          <Button type="button" variant="ghost" onClick={() => onPrioritySettingsChange(defaultScanPrioritySettings())}>
            Reset Priority Defaults
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 rounded-lg border border-stroke bg-canvas p-3 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink">Batch Deep Scan Queue</div>
          <div className="mt-2 grid gap-2 text-sm text-muted sm:grid-cols-2 xl:grid-cols-4">
            <div>Scanned today: <span className="font-medium text-ink">{scannedToday}</span></div>
            <div>Safe remaining calls: <span className="font-medium text-ink">{remainingQuota}</span></div>
            <div>Pending calls: <span className="font-medium text-ink">{pendingCalls}</span></div>
            <div>Estimated days: <span className="font-medium text-ink">{estimatedDays || "--"}</span></div>
          </div>
          <div className="mt-3 break-words text-xs leading-5 text-muted">
            Next batch: {nextSymbols.join(", ") || "No queued symbols"}. Ordered by {prioritySettings.mode}.
          </div>
          {!hasApiKey ? (
            <div className="mt-3 rounded-md border border-stroke bg-panel px-3 py-2 text-sm font-medium text-ink">
              Add an FMP API key before running the deep scan queue. Manual fixes remain available.
            </div>
          ) : null}
        </div>
        <div className="grid content-start gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
          {[10, 25, 50].map((size) => (
            <Button key={size} type="button" variant={size === 10 ? "primary" : "secondary"} onClick={() => onPreview(size)} disabled={busy || !hasApiKey}>
              Preview next {size}
            </Button>
          ))}
        </div>
      </div>

      {preview ? (
        <div id="make-valid-scan-preview" className="grid gap-4 rounded-lg border border-stroke bg-canvas p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-ink">Make Valid Scan Preview</div>
              <div className="mt-1 text-xs leading-5 text-muted">
                No FMP requests have been sent. Review this estimate before confirming the batch.
              </div>
            </div>
            <Badge className={preview.isSafe ? "border-positive/40 text-positive" : "border-danger/40 text-danger"}>
              {preview.isSafe ? "Safe to scan" : "Not safe to scan"}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ValueBox label="Priority Mode" value={preview.priorityMode} />
            <ValueBox label="Selected Symbols" value={`${preview.selectedSymbols.length}`} />
            <ValueBox label="Estimated Calls Needed" value={`${preview.estimatedCalls}`} />
            <ValueBox label="Current Safe Remaining" value={`${preview.safeRemaining}`} />
          </div>

          {preview.capabilityTestIds.length ? (
            <div className="rounded-md border border-stroke bg-panel px-3 py-2 text-xs leading-5 text-muted">
              Estimate includes {preview.capabilityTestIds.length} capability test call{preview.capabilityTestIds.length === 1 ? "" : "s"}:
              {" "}{preview.capabilityTestIds.join(", ")}.
            </div>
          ) : null}

          <div className="rounded-md border border-stroke bg-panel px-3 py-2 text-xs leading-5 text-muted">
            Most likely to become valid: {preview.likelyValidSymbols.join(", ") || "None in this batch. Review unavailable endpoints or use manual fixes."}
          </div>

          {!preview.selectedSymbols.length ? (
            <div className="grid gap-3 rounded-lg border border-caution/40 bg-caution/10 p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-caution" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink">No symbols are queued for this scan</div>
                  <div className="mt-1 text-sm leading-6 text-muted">{emptyPreviewReason}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="primary" onClick={onRunLocalStage1} disabled={busy}>
                  <RefreshCcw className="h-4 w-4" />
                  Run Free/Local Stage 1
                </Button>
                <Button type="button" variant="secondary" onClick={onOpenCoverage} disabled={busy}>
                  Open Data Coverage
                </Button>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-stroke">
            <table className="min-w-[1280px] w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-stroke bg-panel text-muted">
                  <th className="px-3 py-2 font-medium">Symbol</th>
                  <th className="px-3 py-2 font-medium">Priority Score</th>
                  <th className="px-3 py-2 font-medium">Priority Reason</th>
                  <th className="px-3 py-2 font-medium">SEC FCF</th>
                  <th className="px-3 py-2 font-medium">Missing Endpoints</th>
                  <th className="px-3 py-2 font-medium">Estimated Calls</th>
                  <th className="px-3 py-2 font-medium">Estimated Chance</th>
                  <th className="px-3 py-2 font-medium">Validity Likelihood</th>
                  <th className="px-3 py-2 font-medium">Blocking / Likelihood Reason</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={`preview-${row.ticker}`} className="border-b border-stroke align-top last:border-0">
                    <td className="px-3 py-3 font-semibold text-ink">{row.ticker}</td>
                    <td className="px-3 py-3 font-semibold text-ink">{row.priorityScore}</td>
                    <td className="max-w-80 px-3 py-3 text-muted"><span className="break-words">{row.priorityReason}</span></td>
                    <td className="px-3 py-3">
                      <Badge className={row.secFcfAvailable ? "" : "border-danger/40 text-danger"}>
                        {row.secFcfAvailable ? "SEC fallback available" : "No"}
                      </Badge>
                    </td>
                    <td className="max-w-96 px-3 py-3 text-muted">
                      <div className="flex flex-wrap gap-1.5">
                        {row.missingEndpoints.map((endpoint) => (
                          <Badge
                            key={`${row.ticker}-${endpoint.id}`}
                            className={cn(
                              "min-h-6 px-2 py-0.5",
                              (endpoint.status === "blocked by plan"
                                || endpoint.status === "unavailable"
                                || endpoint.status === "empty cache"
                                || endpoint.status === "failed cache")
                                && "border-danger/40 text-danger"
                            )}
                          >
                            {endpoint.id}: {endpoint.status}
                            {endpoint.cacheCategory === "stale cache" ? " (stale cache)" : ""}
                          </Badge>
                        ))}
                        {!row.missingEndpoints.length ? <span>Manual review only</span> : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-medium text-ink">{row.estimatedCalls}</td>
                    <td className={cn("px-3 py-3 font-medium", attentionTextClass(row.estimatedChancePct < 30))}>{row.estimatedChancePct}%</td>
                    <td className="px-3 py-3">
                      <Badge className={row.likelihood === "Low" ? "border-danger/40 text-danger" : ""}>{row.likelihood}</Badge>
                    </td>
                    <td className={cn("max-w-96 px-3 py-3", attentionMutedTextClass(Boolean(row.blockingReason) || row.likelihood === "Low"))}>
                      <span className="break-words">{row.blockingReason || row.likelihoodReason}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs leading-5 text-muted">
              Preview created {formatDateTime(preview.createdAt)}. Confirmation rechecks the queue and quota before starting.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
              <Button type="button" variant="primary" onClick={onConfirm} disabled={busy || !preview.isSafe || !preview.selectedSymbols.length}>
                Confirm Scan
              </Button>
            </div>
          </div>
        </div>
      ) : null}
        </>
      ) : null}

      {view === "coverage" ? (
      <div>
        <div className="mb-2 text-sm font-medium text-ink">Hybrid Validity Checklist</div>
        <div className="overflow-x-auto rounded-lg border border-stroke">
          <table className="min-w-[2250px] w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-stroke bg-panel text-muted">
                <th className="px-3 py-2 font-medium">Priority</th>
                <th className="px-3 py-2 font-medium">Stock</th>
                <th className="px-3 py-2 font-medium">Priority Score</th>
                <th className="px-3 py-2 font-medium">Priority Reason</th>
                <th className="px-3 py-2 font-medium">Market Cap</th>
                <th className="px-3 py-2 font-medium">Real Data</th>
                <th className="px-3 py-2 font-medium">Price</th>
                <th className="px-3 py-2 font-medium">Shares</th>
                <th className="px-3 py-2 font-medium">Income Statement</th>
                <th className="px-3 py-2 font-medium">Historical EOD</th>
                <th className="px-3 py-2 font-medium">FCF</th>
                <th className="px-3 py-2 font-medium">Scenario Valid</th>
                <th className="px-3 py-2 font-medium">Why Invalid</th>
                <th className="px-3 py-2 font-medium">Needed Endpoints</th>
                <th className="px-3 py-2 font-medium">Chance / Blocking</th>
                <th className="px-3 py-2 font-medium">Sector Exception</th>
                <th className="px-3 py-2 font-medium">Manual Fix</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => {
                const stock = row.analysis.stock;
                const draft = manualDrafts[stock.ticker] ?? {};
                return (
                  <tr key={`coverage-${stock.id}`} className="border-b border-stroke align-top last:border-0">
                    <td className="px-3 py-3 font-medium text-ink">{index + 1}</td>
                    <td className="px-3 py-3 font-semibold text-ink">{stock.ticker}</td>
                    <td className="px-3 py-3 font-semibold text-ink">{row.priorityScore}</td>
                    <td className="max-w-80 px-3 py-3 text-muted"><span className="break-words">{row.priorityReason}</span></td>
                    <td className="px-3 py-3 text-muted">{compactMoney(stock.market_cap)}</td>
                    <td className={cn("px-3 py-3", attentionMutedTextClass(row.analysis.realDataPercent < 70))}>{row.analysis.realDataPercent}%</td>
                    <td className={cn("max-w-56 px-3 py-3", hybridFieldClass(row.hybridChecklist.price))}><span className="break-words">{hybridFieldLabel(row.hybridChecklist.price)}</span></td>
                    <td className={cn("max-w-56 px-3 py-3", hybridFieldClass(row.hybridChecklist.shares))}><span className="break-words">{hybridFieldLabel(row.hybridChecklist.shares)}</span></td>
                    <td className={cn("max-w-64 px-3 py-3", hybridFieldClass(row.hybridChecklist.incomeStatement))}><span className="break-words">{hybridFieldLabel(row.hybridChecklist.incomeStatement)}</span></td>
                    <td className={cn("max-w-64 px-3 py-3", hybridFieldClass(row.hybridChecklist.historicalEod))}><span className="break-words">{hybridFieldLabel(row.hybridChecklist.historicalEod)}</span></td>
                    <td className={cn("max-w-56 px-3 py-3", hybridFieldClass(row.hybridChecklist.fcf))}><span className="break-words">{hybridFieldLabel(row.hybridChecklist.fcf)}</span></td>
                    <td className="px-3 py-3"><Badge className={row.hybridChecklist.scenarioValid ? "" : "border-danger/40 text-danger"}>{row.hybridChecklist.scenarioValid ? "Yes" : "No"}</Badge></td>
                    <td className={cn("max-w-96 px-3 py-3", attentionMutedTextClass(Boolean(row.reasons.length)))}><span className="break-words">{row.reasons.join(", ")}</span></td>
                    <td className="max-w-80 px-3 py-3 text-muted">
                      <div className="flex flex-wrap gap-1.5">
                        {row.endpointNeeds.map((endpoint) => (
                          <Badge key={`${stock.ticker}-${endpoint.id}`} className={
                            endpoint.status === "blocked by plan"
                              ? "border-danger/40 text-danger"
                              : endpoint.status === "available"
                                ? "border-positive/40 text-positive"
                                : ""
                          }>
                            {endpoint.id}: {endpoint.status}
                          </Badge>
                        ))}
                        {row.requiresSecFallback ? <Badge>SEC EDGAR FCF: available fallback</Badge> : null}
                        {row.secFcfAvailable ? <Badge>SEC EDGAR FCF: cached</Badge> : null}
                        {!row.endpointNeeds.length ? <span>Manual review</span> : null}
                      </div>
                    </td>
                    <td className="max-w-80 px-3 py-3 text-muted">
                      <div className={cn("font-medium", attentionTextClass(row.estimatedChancePct < 30))}>{row.estimatedChancePct}% estimated</div>
                      {row.blockingReason ? <div className="mt-1 break-words text-danger">{row.blockingReason}</div> : null}
                    </td>
                    <td className={cn("max-w-72 px-3 py-3", attentionMutedTextClass(row.financialSectorWarning))}>
                      {row.financialSectorWarning
                        ? "DCF may not be suitable. Consider financial-sector valuation later."
                        : "--"}
                    </td>
                    <td className="min-w-[360px] px-3 py-3">
                      <details className="rounded-md border border-stroke bg-panel">
                        <summary className="cursor-pointer list-none px-3 py-2 font-medium text-ink marker:hidden [&::-webkit-details-marker]:hidden">
                          Enter missing values
                        </summary>
                        <div className="grid gap-2 border-t border-stroke p-3 sm:grid-cols-2">
                          <NumberField label="Shares outstanding" value={draft.shares_outstanding ?? null} onChange={(value) => onManualChange(stock.ticker, "shares_outstanding", value)} />
                          <NumberField label="Free cash flow" value={draft.free_cash_flow ?? null} onChange={(value) => onManualChange(stock.ticker, "free_cash_flow", value)} />
                          <NumberField label="Current price" value={draft.current_price ?? null} onChange={(value) => onManualChange(stock.ticker, "current_price", value)} />
                          <NumberField label="Revenue growth %" value={draft.revenue_growth_pct ?? null} onChange={(value) => onManualChange(stock.ticker, "revenue_growth_pct", value)} />
                          <Button type="button" variant="secondary" onClick={() => onManualSave(stock)}>Save Manual Fix</Button>
                        </div>
                      </details>
                    </td>
                  </tr>
                );
              })}
              {!visibleRows.length ? (
                <tr><td colSpan={17} className="px-3 py-6 text-center text-muted">All stocks have valid scenario data.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {coverageRows.length > visibleRows.length ? (
          <div className="mt-2 text-xs text-muted">Showing the top {visibleRows.length} prioritized stocks out of {coverageRows.length} insufficient records.</div>
        ) : null}
      </div>
      ) : null}
    </CollapsibleCard>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <Field label={label}>
      <Input type="number" step="0.01" value={numberValue(value)} onChange={(event) => onChange(parseNumber(event.target.value))} />
    </Field>
  );
}

function SmallRank({ analysis, language }: { analysis: StockAnalysis; language: Language }) {
  const needsAttention = analysisNeedsAttention(analysis);
  return (
    <div className={cn(
      "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-canvas px-3 py-2 text-sm",
      needsAttention ? "border-danger/40" : "border-stroke"
    )}>
      <div className="min-w-0">
        <div className="truncate font-medium text-ink">{analysis.stock.ticker}</div>
        <div className={cn("break-words text-xs", attentionMutedTextClass(needsAttention))}>
          {recommendationLabel(language, analysis.recommendation)} - {analysis.realDataPercent}% real data
          {riskNeedsAttention(analysis.riskLabel) ? ` - ${riskLabel(language, analysis.riskLabel)}` : ""}
        </div>
      </div>
      <div className={cn("text-right font-semibold", attentionTextClass(needsAttention))}>{analysis.totalScore}</div>
    </div>
  );
}

function PortfolioCard({
  language,
  title,
  portfolio,
  holdings,
  holdingDraft,
  setHoldingDraft,
  saveHolding,
  deleteHolding
}: {
  language: Language;
  title: string;
  portfolio: ReturnType<typeof portfolioSummary>;
  holdings: Holding[];
  holdingDraft: Holding;
  setHoldingDraft: (holding: Holding) => void;
  saveHolding: (event: FormEvent) => void;
  deleteHolding: (id: string) => void;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <BriefcaseBusiness className="h-4 w-4 text-accent" />
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4 p-3 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ValueBox label="Total Value" value={money(portfolio.totalValue)} />
          <ValueBox label="Unrealized PnL" value={money(portfolio.unrealizedPnl)} />
          <ValueBox label="Cash" value={pct(portfolio.cashAllocationPct)} />
          <ValueBox label="High Risk" value={pct(portfolio.highRiskExposurePct)} />
        </div>
        <form onSubmit={saveHolding} className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          <TextField label="Ticker" value={holdingDraft.ticker} onChange={(value) => setHoldingDraft({ ...holdingDraft, ticker: value.toUpperCase() })} />
          <NumberField label="Shares" value={holdingDraft.shares} onChange={(value) => setHoldingDraft({ ...holdingDraft, shares: value ?? 0 })} />
          <NumberField label="Avg Cost" value={holdingDraft.average_cost} onChange={(value) => setHoldingDraft({ ...holdingDraft, average_cost: value ?? 0 })} />
          <NumberField label="Current" value={holdingDraft.current_price} onChange={(value) => setHoldingDraft({ ...holdingDraft, current_price: value ?? 0 })} />
          <Field label="Sector">
            <Select value={holdingDraft.sector} options={SECTORS} onChange={(event) => setHoldingDraft({ ...holdingDraft, sector: event.target.value })} />
          </Field>
          <Field label="Risk">
            <Select value={holdingDraft.risk_label} options={RISK_LABELS} onChange={(event) => setHoldingDraft({ ...holdingDraft, risk_label: event.target.value as RiskLabel })} />
          </Field>
          <Button type="submit" variant="primary" className="sm:col-span-2 2xl:col-span-3">Add Holding</Button>
        </form>
        <div className="grid gap-2">
          {(portfolio.warnings.length ? portfolio.warnings : [language === "zh" ? "没有明显组合规则警告。" : "No major portfolio-rule warnings."]).map((warning) => (
            <div key={warning} className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm text-muted">{warningText(language, warning)}</div>
          ))}
        </div>
        <div className="grid gap-2">
          {holdings.slice(0, 8).map((holding) => (
            <div key={holding.id} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm">
              <span className="font-medium text-ink">{holding.ticker}</span>
              <span className="min-w-0 break-words text-right text-muted">{money(holding.shares * holding.current_price)} - {riskLabel(language, holding.risk_label)}</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => deleteHolding(holding.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AllocationCard({ language, title, allocation, saveAllocation }: { language: Language; title: string; allocation: AllocationPlan; saveAllocation: (plan: AllocationPlan) => void }) {
  const totalPct = allocation.to_stocks_pct + allocation.to_cash_pct + allocation.to_trading_account_pct + allocation.to_personal_spending_pct;
  const rows = [
    [language === "zh" ? "转入股票" : "To Stocks", allocation.to_stocks_pct],
    [language === "zh" ? "保留现金" : "Kept as Cash", allocation.to_cash_pct],
    [language === "zh" ? "留在交易账户" : "Trading Account", allocation.to_trading_account_pct],
    [language === "zh" ? "个人支出" : "Personal Spending", allocation.to_personal_spending_pct]
  ] as const;
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Badge>{totalPct}%</Badge>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4 p-3 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField label="Trading Profit $" value={allocation.trading_profit_amount} onChange={(value) => saveAllocation({ ...allocation, trading_profit_amount: value ?? 0 })} />
          <NumberField label="Portfolio Cash $" value={allocation.portfolio_cash} onChange={(value) => saveAllocation({ ...allocation, portfolio_cash: value ?? 0 })} />
          <NumberField label="Stocks %" value={allocation.to_stocks_pct} onChange={(value) => saveAllocation({ ...allocation, to_stocks_pct: value ?? 0 })} />
          <NumberField label="Cash %" value={allocation.to_cash_pct} onChange={(value) => saveAllocation({ ...allocation, to_cash_pct: value ?? 0 })} />
          <NumberField label="Trading Account %" value={allocation.to_trading_account_pct} onChange={(value) => saveAllocation({ ...allocation, to_trading_account_pct: value ?? 0 })} />
          <NumberField label="Personal %" value={allocation.to_personal_spending_pct} onChange={(value) => saveAllocation({ ...allocation, to_personal_spending_pct: value ?? 0 })} />
        </div>
        <div className="grid gap-2">
          {rows.map(([label, percent]) => (
            <div key={label} className="flex items-center justify-between rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm">
              <span className="text-muted">{label}</span>
              <span className="font-semibold text-ink">{money((allocation.trading_profit_amount * percent) / 100)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ValueBox({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: string;
  tone?: "neutral" | "danger" | "positive" | "caution";
}) {
  return (
    <div className="min-w-0 rounded-lg border border-stroke bg-canvas px-3 py-2">
      <div className="break-words text-xs text-muted">{label}</div>
      <div className={cn(
        "mt-1 break-words text-lg font-semibold",
        tone === "danger" && "text-danger",
        tone === "positive" && "text-positive",
        tone === "caution" && "text-caution",
        tone === "neutral" && "text-ink"
      )}>{value}</div>
    </div>
  );
}

function ScoreBreakdownBox({
  title,
  rows,
  audit
}: {
  title: string;
  rows: Array<[string, number]>;
  audit: StockAnalysis["componentAudit"];
}) {
  return (
    <div className="rounded-lg border border-stroke bg-canvas p-3 text-sm">
      <div className="font-medium text-ink">{title}</div>
      <div className="mt-2 grid gap-1">
        {rows.map(([label, value]) => {
          const source = audit.find((item) => item.label === label)?.source;
          const unreliable = source === "fallback" || source === "missing";
          const weakScore = value < 50;
          return (
            <div key={label} className={cn("flex items-center justify-between gap-3 text-xs", attentionMutedTextClass(unreliable || weakScore))}>
              <span>{label}</span>
              <span className={cn("text-right font-medium", attentionTextClass(unreliable || weakScore))}>
                {Math.round(value)}
                {unreliable ? <span className="ml-1 font-normal text-danger">({source})</span> : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatAuditValue(value: number | string | null) {
  if (value === null || value === "") return "--";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "--";
    return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }
  return value;
}

function formatAuditTimestamp(timestamp: string | null | undefined) {
  return formatDateTime(timestamp);
}

function formatDateTime(value: string | null | undefined, fallback = "--") {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : fallback;
}

function stockFieldAudit(stock: StockRecord | undefined, field: string): InvestmentFieldAudit {
  const stored = stock?.field_audit?.[field];
  if (stored) return stored;
  const raw = stock ? (stock as unknown as Record<string, unknown>)[field] : null;
  const rawValue = typeof raw === "number" || typeof raw === "string" ? raw : null;
  const hasValue = rawValue !== null && rawValue !== "" && !(typeof rawValue === "number" && (!Number.isFinite(rawValue) || rawValue === 0));
  if (!stock || !hasValue) {
    return { rawValue: null, source: "missing", timestamp: stock?.last_updated ?? "", affectedScore: SCORE_FIELD_KEYS.has(field) };
  }
  const source: InvestmentDataSource =
    stock.source.includes("FMP") ? "cache" :
      stock.source.includes("SEC EDGAR") ? "SEC EDGAR XBRL" :
      stock.source.includes("Manual") ? "manual" :
        "fallback";
  return { rawValue, source, timestamp: stock.last_updated, affectedScore: SCORE_FIELD_KEYS.has(field) };
}

function DataSourceAudit({ analysis, cache }: { analysis: StockAnalysis; cache: InvestmentCache }) {
  const secResult = secCashFlowEntry(cache, analysis.stock.ticker)?.data;
  const fcfAudit = stockFieldAudit(analysis.stock, "free_cash_flow");
  return (
    <details className="group mt-4 min-w-0 overflow-hidden rounded-lg border border-stroke bg-panel">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink">Data Source Audit</div>
          <div className="mt-1 text-xs text-muted">
            {analysis.realDataPercent}% real data, {analysis.fallbackPercent}% fallback/default
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge>Base {analysis.baseScore} - penalty {analysis.fallbackPenalty}</Badge>
          <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
        </div>
      </summary>
      <div className="border-t border-stroke p-3">
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-stroke text-muted">
              <th className="px-2 py-2 font-medium">Component</th>
              <th className="px-2 py-2 font-medium">Raw value</th>
              <th className="px-2 py-2 font-medium">Source</th>
              <th className="px-2 py-2 font-medium">Timestamp</th>
              <th className="px-2 py-2 font-medium">Score impact</th>
              <th className="px-2 py-2 text-right font-medium">Score / weight</th>
            </tr>
          </thead>
          <tbody>
            {analysis.componentAudit.map((item) => (
              <tr key={item.key} className="border-b border-stroke/70 last:border-0">
                <td className="px-2 py-2 font-medium text-ink">{item.label}</td>
                <td className="px-2 py-2 text-muted">{formatAuditValue(item.rawValue)}</td>
                <td className="px-2 py-2 text-muted">{item.source}</td>
                <td className="px-2 py-2 text-muted">{formatAuditTimestamp(item.timestamp)}</td>
                <td className="px-2 py-2 text-muted">{item.affectedScore ? "Yes" : "No"}</td>
                <td className="px-2 py-2 text-right text-ink">{Math.round(item.score)} / {item.finalWeightPct}%</td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
        <div className={cn("mt-3 break-words text-xs", attentionMutedTextClass(analysis.missingData.length > 0))}>
          Missing key fields: {analysis.missingData.join(", ") || "None"}
        </div>
        <div className="mt-3 rounded-lg border border-stroke bg-canvas p-3 text-xs">
          <div className="font-medium text-ink">FCF Source Audit</div>
          <div className="mt-2 grid gap-1 text-muted sm:grid-cols-2">
            <div>Stored FCF source: <span className="text-ink">{fcfAudit.source}</span></div>
            <div>Stored FCF value: <span className="text-ink">{compactMoney(analysis.stock.free_cash_flow)}</span></div>
            <div>SEC operating concept: <span className="break-words text-ink">{secResult?.operating_cash_flow_concept ?? "--"}</span></div>
            <div>SEC CapEx concept: <span className="break-words text-ink">{secResult?.capex_concept ?? "--"}</span></div>
            <div>SEC fiscal periods: <span className="text-ink">{secResult?.fiscal_periods_used?.join(", ") || "--"}</span></div>
            <div>SEC confidence: <span className="text-ink">{secResult?.confidence ?? "--"}</span></div>
          </div>
        </div>
      </div>
    </details>
  );
}

function FmpFieldMappingAudit({ stocks }: { stocks: StockRecord[] }) {
  const stockMap = new Map(stocks.map((stock) => [stock.ticker.toUpperCase(), stock]));
  return (
    <CollapsibleCard title="FMP Field Mapping Audit" badge={<Badge>AAPL / MSFT / NVDA / GOOGL</Badge>} contentClassName="grid gap-3">
        <p className="break-words text-sm leading-6 text-muted">
          Shows whether each field was actually extracted. Cache means a previously fetched FMP value; missing means no usable value was mapped.
        </p>
        <div className="overflow-x-auto rounded-lg border border-stroke">
          <table className="min-w-[980px] w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-stroke bg-panel text-muted">
                <th className="px-3 py-2 font-medium">Field</th>
                {FMP_AUDIT_TICKERS.map((ticker) => <th key={ticker} className="px-3 py-2 font-medium">{ticker}</th>)}
              </tr>
            </thead>
            <tbody>
              {FMP_AUDIT_FIELDS.map((field) => (
                <tr key={field.key} className="border-b border-stroke last:border-0">
                  <td className="px-3 py-2 font-medium text-ink">{field.label}</td>
                  {FMP_AUDIT_TICKERS.map((ticker) => {
                    const audit = stockFieldAudit(stockMap.get(ticker), field.key);
                    const extracted = audit.source !== "missing" && audit.source !== "fallback" && audit.rawValue !== null;
                    return (
                      <td key={`${ticker}-${field.key}`} className="px-3 py-2 align-top">
                        <div className={extracted ? "font-medium text-ink" : "font-medium text-muted"}>{extracted ? "Extracted" : "Missing"}</div>
                        <div className="mt-1 text-muted">{audit.source}</div>
                        <div className="mt-1 break-words text-muted">{formatAuditValue(audit.rawValue)}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </CollapsibleCard>
  );
}

function comparisonValue(value: number | null | undefined, suffix = "") {
  return typeof value !== "number" || !Number.isFinite(value)
    ? "--"
    : `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}${suffix}`;
}

function comparisonPair(before: number | null | undefined, after: number | null | undefined, suffix = "") {
  const changed = before !== after;
  return (
    <div className="grid min-w-[128px] gap-1">
      <div className="text-muted">Before: {comparisonValue(before, suffix)}</div>
      <div className={changed ? "font-medium text-ink" : "text-muted"}>After: {comparisonValue(after, suffix)}</div>
    </div>
  );
}

function FmpMappingRepairComparison({ rows }: { rows: FmpMappingComparisonRow[] }) {
  return (
    <CollapsibleCard
      title="FMP Mapping Before / After"
      badge={<Badge>Cached data repair</Badge>}
      contentClassName="grid gap-3"
    >
      <p className="break-words text-sm leading-6 text-muted">
        The latest cached FMP payload is reconciled into stored stock fields on page load. Derived PE vs Industry, PEG, Revenue Growth Score, and data-source percentages are recalculated without changing model weights.
      </p>
      <div className="overflow-x-auto rounded-lg border border-stroke">
        <table className="min-w-[1520px] w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-stroke bg-panel text-muted">
              <th className="px-3 py-2 font-medium">Ticker</th>
              <th className="px-3 py-2 font-medium">Fixed fields</th>
              <th className="px-3 py-2 font-medium">PE</th>
              <th className="px-3 py-2 font-medium">Revenue growth</th>
              <th className="px-3 py-2 font-medium">Dividend yield</th>
              <th className="px-3 py-2 font-medium">Historical close</th>
              <th className="px-3 py-2 font-medium">PE vs Industry</th>
              <th className="px-3 py-2 font-medium">PEG</th>
              <th className="px-3 py-2 font-medium">Revenue score</th>
              <th className="px-3 py-2 font-medium">Real data</th>
              <th className="px-3 py-2 font-medium">Fallback</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.ticker} className="border-b border-stroke last:border-0">
                <td className="px-3 py-3 align-top font-semibold text-ink">{row.ticker}</td>
                <td className="max-w-52 px-3 py-3 align-top text-muted">
                  <span className="break-words">{row.fixedFields.join(", ") || "No cached mapping change"}</span>
                </td>
                <td className="px-3 py-3 align-top">{comparisonPair(row.before.peRatio, row.after.peRatio)}</td>
                <td className="px-3 py-3 align-top">{comparisonPair(row.before.revenueGrowth, row.after.revenueGrowth, "%")}</td>
                <td className="px-3 py-3 align-top">{comparisonPair(row.before.dividendYield, row.after.dividendYield, "%")}</td>
                <td className="px-3 py-3 align-top">{comparisonPair(row.before.historicalClose, row.after.historicalClose)}</td>
                <td className="px-3 py-3 align-top">{comparisonPair(row.before.peVsIndustry, row.after.peVsIndustry)}</td>
                <td className="px-3 py-3 align-top">{comparisonPair(row.before.peg, row.after.peg)}</td>
                <td className="px-3 py-3 align-top">{comparisonPair(row.before.revenueGrowthScore, row.after.revenueGrowthScore)}</td>
                <td className="px-3 py-3 align-top">{comparisonPair(row.before.realDataPercent, row.after.realDataPercent, "%")}</td>
                <td className="px-3 py-3 align-top">{comparisonPair(row.before.fallbackPercent, row.after.fallbackPercent, "%")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleCard>
  );
}

function FmpRawResponseInspector({ stocks, cache }: { stocks: StockRecord[]; cache: InvestmentCache }) {
  const stockMap = new Map(stocks.map((stock) => [stock.ticker.toUpperCase(), stock]));
  return (
    <CollapsibleCard title="FMP Raw Response Inspector" badge={<Badge>Local cache only</Badge>} contentClassName="grid gap-4">
        <p className="break-words text-sm leading-6 text-muted">
          Inspects cached FMP payloads without making new API calls. A source key marked “Found” but “Not mapped” indicates a mapping gap rather than unavailable data.
        </p>
        {FMP_AUDIT_TICKERS.map((ticker) => {
          const stock = stockMap.get(ticker);
          const views = buildFmpRawPayloadViews(cache, ticker);
          const diagnostics = buildFmpMetricDiagnostics(stock, views);
          const cachedEndpointCount = views.filter((view) => view.cacheKey).length;
          return (
            <section key={ticker} className="min-w-0 rounded-lg border border-stroke bg-canvas p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-ink">{ticker}</div>
                  <div className="mt-1 text-xs text-muted">{cachedEndpointCount}/4 endpoint payloads found in local cache</div>
                </div>
                <Badge>{stock ? "Stock record loaded" : "No stock record"}</Badge>
              </div>

              <div className="mt-4 overflow-x-auto rounded-lg border border-stroke">
                <table className="min-w-[960px] w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-stroke bg-panel text-muted">
                      <th className="px-3 py-2 font-medium">Metric</th>
                      <th className="px-3 py-2 font-medium">Source endpoint / key</th>
                      <th className="px-3 py-2 font-medium">Source key found?</th>
                      <th className="px-3 py-2 font-medium">Mapping rule?</th>
                      <th className="px-3 py-2 font-medium">Stored?</th>
                      <th className="px-3 py-2 font-medium">Raw value</th>
                      <th className="px-3 py-2 font-medium">Stored value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagnostics.map((diagnostic) => (
                      <tr key={`${ticker}-${diagnostic.label}`} className="border-b border-stroke last:border-0">
                        <td className="px-3 py-2 font-medium text-ink">{diagnostic.label}</td>
                        <td className="px-3 py-2 text-muted">
                          <div>{diagnostic.sourceEndpoint}</div>
                          <div className="mt-1 break-all">{diagnostic.sourceKey}</div>
                        </td>
                        <td className="px-3 py-2 text-muted">{diagnostic.found ? "Found" : "Not found"}</td>
                        <td className="px-3 py-2 text-muted">{diagnostic.mappingRule ? "Recognized" : "No rule"}</td>
                        <td className="px-3 py-2 text-muted">{diagnostic.stored ? "Stored" : "Not stored"}</td>
                        <td className="px-3 py-2 text-muted">{formatAuditValue(diagnostic.rawValue)}</td>
                        <td className="px-3 py-2 text-muted">{formatAuditValue(diagnostic.mappedValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 grid gap-3">
                {views.map((view) => (
                  <details key={`${ticker}-${view.id}`} className="rounded-lg border border-stroke bg-panel">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm marker:hidden [&::-webkit-details-marker]:hidden">
                      <span className="break-words font-medium text-ink">{view.label}</span>
                      <span className="text-xs text-muted">
                        {!view.cacheKey ? "Not cached" : view.records.length ? `${view.records.length} extracted row(s)` : "Cached empty response"}
                      </span>
                    </summary>
                    <div className="grid gap-3 border-t border-stroke px-3 py-3 text-xs">
                      {!view.cacheKey ? (
                        <div className="text-muted">No cached response for this ticker and endpoint. Run the compatible FMP scan if the endpoint is available.</div>
                      ) : (
                        <>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="rounded-md border border-stroke bg-canvas px-3 py-2 text-muted">
                              <div className="font-medium text-ink">Cache entry</div>
                              <div className="mt-1 break-all">{view.cacheKey}</div>
                              <div className="mt-1">Date: {view.cacheDate || "--"}</div>
                            </div>
                            <div className="rounded-md border border-stroke bg-canvas px-3 py-2 text-muted">
                              <div className="font-medium text-ink">Keys available</div>
                              <div className="mt-1 break-words">{view.keys.join(", ") || "No keys returned"}</div>
                            </div>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="rounded-md border border-stroke bg-canvas px-3 py-2 text-muted">
                              <div className="font-medium text-ink">Mapped fields</div>
                              <div className="mt-1 break-words">{view.mappedFields.join(", ") || "No recognized mapped keys"}</div>
                            </div>
                            <div className="rounded-md border border-stroke bg-canvas px-3 py-2 text-muted">
                              <div className="font-medium text-ink">Unmapped fields</div>
                              <div className="mt-1 break-words">{view.unmappedFields.join(", ") || "None"}</div>
                            </div>
                          </div>
                          <div className="rounded-md border border-stroke bg-canvas p-3">
                            <div className="font-medium text-ink">Raw extracted payload snippet</div>
                            <pre className="mt-2 max-h-72 max-w-full overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-muted sm:max-h-80">
                              {view.snippet || "[]"}
                            </pre>
                          </div>
                        </>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          );
        })}
    </CollapsibleCard>
  );
}

function RankingAudit({ rows }: { rows: RankingAuditRow[] }) {
  const rules = [
    ["Top Recommendations", "Final score DESC", "Buy/Strong Buy with reliable data"],
    ["Best Value", "Valuation score DESC", "Valuation breakdown"],
    ["Highest Quality", "Quality score DESC", "Quality breakdown"],
    ["Lowest Risk", "Risk safety score DESC", "Higher means safer"],
    ["Highest Risk", "Risk safety score ASC", "Exact inverse direction of Lowest Risk"],
    ["Wait for Better Price", "Premium above fair value upper DESC", "Current price must exceed fair value upper"],
    ["Reliable Candidates", "Final score DESC", "Reliable data only"],
    ["Incomplete Data Candidates", "Real data % DESC, then Base score DESC", "Incomplete or insufficient data"],
    ["Avoid List", "Final score DESC", "Recommendation label = Avoid"]
  ];
  return (
    <CollapsibleCard
      title="Ranking Audit"
      badge={<Badge>Sort keys verified</Badge>}
      contentClassName="grid gap-4"
    >
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {rules.map(([section, sortMetric, source]) => (
          <div key={section} className="min-w-0 rounded-lg border border-stroke bg-canvas p-3 text-xs">
            <div className="font-medium text-ink">{section}</div>
            <div className="mt-1 break-words text-muted">{sortMetric}</div>
            <div className="mt-1 break-words text-muted">{source}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-stroke">
        <table className="min-w-[980px] w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-stroke bg-panel text-muted">
              <th className="px-3 py-2 font-medium">Ranking section</th>
              <th className="px-3 py-2 font-medium">Rank</th>
              <th className="px-3 py-2 font-medium">Stock</th>
              <th className="px-3 py-2 font-medium">Sort metric</th>
              <th className="px-3 py-2 font-medium">Metric value</th>
              <th className="px-3 py-2 font-medium">Rank source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.section}-${row.rank}-${row.stock}`} className="border-b border-stroke last:border-0">
                <td className="px-3 py-2 font-medium text-ink">{row.section}</td>
                <td className="px-3 py-2 text-muted">{row.rank}</td>
                <td className="px-3 py-2 font-medium text-ink">{row.stock}</td>
                <td className="px-3 py-2 text-muted">{row.sortMetric}</td>
                <td className="px-3 py-2 text-muted">{row.metricValue}</td>
                <td className="px-3 py-2 text-muted">{row.rankSource}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted">No ranked stocks available.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </CollapsibleCard>
  );
}

function PrimaryDcfAudit({ analyses }: { analyses: StockAnalysis[] }) {
  const switched = analyses
    .filter((analysis) => analysis.valuation.primaryDcfMode === "Normalized")
    .sort((left, right) => Math.abs(right.valuation.latestFcfDeviationPct ?? 0) - Math.abs(left.valuation.latestFcfDeviationPct ?? 0));
  return (
    <CollapsibleCard
      title="Primary DCF Audit"
      badge={<Badge>{switched.length} normalized</Badge>}
      contentClassName="grid gap-3"
    >
      <p className="text-sm leading-6 text-muted">
        A stock switches to Normalized DCF when latest FCF differs from its 3-year average by more than 30%. Conservative DCF remains the latest-FCF downside case.
      </p>
      <div className="overflow-x-auto rounded-lg border border-stroke">
        <table className="min-w-[1320px] w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-stroke bg-panel text-muted">
              <th className="px-3 py-2 font-medium">Stock</th>
              <th className="px-3 py-2 font-medium">Primary mode</th>
              <th className="px-3 py-2 font-medium">Latest FCF</th>
              <th className="px-3 py-2 font-medium">3Y average FCF</th>
              <th className="px-3 py-2 font-medium">Difference</th>
              <th className="px-3 py-2 font-medium">Conservative DCF</th>
              <th className="px-3 py-2 font-medium">Primary DCF</th>
              <th className="px-3 py-2 font-medium">Before premium</th>
              <th className="px-3 py-2 font-medium">Primary premium</th>
              <th className="px-3 py-2 font-medium">Selection reason</th>
            </tr>
          </thead>
          <tbody>
            {switched.map((analysis) => (
              <tr key={analysis.stock.id} className="border-b border-stroke last:border-0">
                <td className="px-3 py-3 font-semibold text-ink">{analysis.stock.ticker}</td>
                <td className="px-3 py-3 text-muted">{analysis.valuation.primaryDcfMode}</td>
                <td className="px-3 py-3 text-muted">{compactMoney(analysis.valuation.latestFcf)}</td>
                <td className="px-3 py-3 text-muted">{compactMoney(analysis.valuation.normalizedFcf3y)}</td>
                <td className="px-3 py-3 text-muted">{comparisonValue(analysis.valuation.latestFcfDeviationPct, "%")}</td>
                <td className="px-3 py-3 text-muted">{analysis.valuation.conservativeDcfFairValue ? money(analysis.valuation.conservativeDcfFairValue) : "--"}</td>
                <td className="px-3 py-3 font-medium text-ink">{analysis.valuation.dcfFairValue ? money(analysis.valuation.dcfFairValue) : "--"}</td>
                <td className="px-3 py-3 text-muted">{comparisonValue(premiumAboveDcfFairValuePct(analysis, analysis.valuation.conservativeDcfFairValue), "%")}</td>
                <td className="px-3 py-3 font-medium text-ink">{comparisonValue(fairValuePremiumPct(analysis), "%")}</td>
                <td className="max-w-80 px-3 py-3 text-muted"><span className="break-words">{analysis.valuation.primaryDcfReason}</span></td>
              </tr>
            ))}
            {!switched.length ? (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-muted">No stocks currently exceed the 30% normalization threshold.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </CollapsibleCard>
  );
}

function ReverseDcfAudit({ analyses, assumptions }: { analyses: StockAnalysis[]; assumptions: DcfAssumptions }) {
  const analysisMap = new Map(analyses.map((analysis) => [analysis.stock.ticker.toUpperCase(), analysis]));
  return (
    <CollapsibleCard
      title="Reverse DCF Audit"
      badge={<Badge>Market-implied growth</Badge>}
      contentClassName="grid gap-4"
    >
      <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm leading-6 text-muted">
        Solves for the annual FCF growth rate that makes DCF fair value equal the current market price. Search range: -20% to 50%. Assumptions: {comparisonValue(assumptions.discount_rate_pct, "%")} discount, {comparisonValue(assumptions.terminal_growth_pct, "%")} terminal growth, {assumptions.projection_years} years.
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Reasonable expectation", "Implied growth <= 10%"],
          ["Aggressive expectation", "Above 10% to 20%"],
          ["Very aggressive expectation", "Above 20% to 35%"],
          ["Unrealistic expectation", "Above 35%, or no solution by 50%"]
        ].map(([label, rule]) => (
          <div key={label} className="rounded-lg border border-stroke bg-canvas p-3 text-xs">
            <div className="font-medium text-ink">{label}</div>
            <div className="mt-1 text-muted">{rule}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-stroke">
        <table className="min-w-[1320px] w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-stroke bg-panel text-muted">
              <th className="px-3 py-2 font-medium">Stock</th>
              <th className="px-3 py-2 font-medium">Current price</th>
              <th className="px-3 py-2 font-medium">Primary DCF mode</th>
              <th className="px-3 py-2 font-medium">Primary fair value</th>
              <th className="px-3 py-2 font-medium">Implied FCF growth</th>
              <th className="px-3 py-2 font-medium">Current base growth</th>
              <th className="px-3 py-2 font-medium">Difference</th>
              <th className="px-3 py-2 font-medium">Reasonableness</th>
              <th className="px-3 py-2 font-medium">Explanation</th>
            </tr>
          </thead>
          <tbody>
            {REVERSE_DCF_AUDIT_TICKERS.map((ticker) => {
              const analysis = analysisMap.get(ticker);
              const reverse = analysis?.valuation.reverseDcf;
              return (
                <tr key={ticker} className="border-b border-stroke last:border-0">
                  <td className="px-3 py-3 font-semibold text-ink">{ticker}</td>
                  <td className="px-3 py-3 text-muted">{analysis ? money(analysis.stock.current_price) : "--"}</td>
                  <td className="px-3 py-3 text-muted">{analysis?.valuation.primaryDcfMode ?? "--"}</td>
                  <td className="px-3 py-3 text-muted">{analysis?.valuation.dcfFairValue ? money(analysis.valuation.dcfFairValue) : "--"}</td>
                  <td className="px-3 py-3 font-medium text-ink">{comparisonValue(reverse?.impliedGrowthPct, "%")}</td>
                  <td className="px-3 py-3 text-muted">{comparisonValue(reverse?.baseGrowthPct, "%")}</td>
                  <td className="px-3 py-3 text-muted">{comparisonValue(reverse?.differencePct, "pp")}</td>
                  <td className="px-3 py-3 text-muted">{reverse?.label ?? "Unrealistic expectation"}</td>
                  <td className="max-w-96 px-3 py-3 text-muted"><span className="break-words">{reverse?.explanation ?? "Stock data is unavailable."}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </CollapsibleCard>
  );
}

function scenarioRatioDisplay(analysis: StockAnalysis) {
  const scenario = analysis.valuation.scenarioValuation;
  return scenario.riskRewardRatio === null ? "--" : `${comparisonValue(scenario.riskRewardRatio)}x`;
}

function scenarioMetricDetail(analysis: StockAnalysis) {
  const scenario = analysis.valuation.scenarioValuation;
  return `Weighted ${comparisonValue(scenario.weightedUpsideDownsidePct, "%")} | Bear ${comparisonValue(scenario.downsideToBearPct, "%")} | Bull ${comparisonValue(scenario.upsideToBullPct, "%")} | R/R ${scenarioRatioDisplay(analysis)}`;
}

function ScenarioDecisionRankings({
  rankings
}: {
  rankings: {
    bestRiskReward: StockAnalysis[];
    bestWeightedUpside: StockAnalysis[];
    worstRiskReward: StockAnalysis[];
    noModeledDownside: StockAnalysis[];
    requiresBull: StockAnalysis[];
    aboveBull: StockAnalysis[];
  };
}) {
  const groups = [
    {
      title: "Best Scenario Risk/Reward",
      rows: rankings.bestRiskReward,
      metric: "Risk/reward ratio DESC",
      value: (analysis: StockAnalysis) => scenarioRatioDisplay(analysis),
      detail: scenarioMetricDetail
    },
    {
      title: "Best Weighted Upside",
      rows: rankings.bestWeightedUpside,
      metric: "Weighted upside DESC",
      value: (analysis: StockAnalysis) => comparisonValue(analysis.valuation.scenarioValuation.weightedUpsideDownsidePct, "%"),
      detail: scenarioMetricDetail
    },
    {
      title: "Worst Scenario Risk/Reward",
      rows: rankings.worstRiskReward,
      metric: "Risk/reward ratio ASC",
      value: (analysis: StockAnalysis) => scenarioRatioDisplay(analysis),
      detail: scenarioMetricDetail
    },
    {
      title: "No Modeled Downside / Needs Review",
      rows: rankings.noModeledDownside,
      metric: "Excluded from risk/reward rankings",
      value: () => "Review",
      detail: scenarioRiskRewardReviewReason
    },
    {
      title: "Requires Bull Case",
      rows: rankings.requiresBull,
      metric: "Weighted upside DESC; shows upside to Bull",
      value: (analysis: StockAnalysis) => comparisonValue(analysis.valuation.scenarioValuation.upsideToBullPct, "%"),
      detail: scenarioMetricDetail
    },
    {
      title: "Above Bull Case",
      rows: rankings.aboveBull,
      metric: "Upside to Bull ASC",
      value: (analysis: StockAnalysis) => comparisonValue(analysis.valuation.scenarioValuation.upsideToBullPct, "%"),
      detail: scenarioMetricDetail
    }
  ];
  return (
    <CollapsibleCard title="Scenario Decision Rankings" badge={<Badge>Decision support</Badge>} defaultOpen>
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <div key={group.title} className="min-w-0 rounded-lg border border-stroke bg-canvas p-3">
            <div className="text-sm font-medium text-ink">{group.title}</div>
            <div className="mt-1 text-xs text-muted">Metric: {group.metric}</div>
            <div className="mt-3 grid gap-2">
              {group.rows.map((analysis, index) => (
                <div key={`${group.title}-${analysis.stock.id}`} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-stroke bg-panel px-3 py-2 text-xs">
                  <span className="text-muted">{index + 1}</span>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink">{analysis.stock.ticker}</div>
                    <div className="truncate text-muted">{analysis.valuation.scenarioValuation.decisionLabel}</div>
                    <div className="mt-1 break-words text-[11px] leading-4 text-muted">{group.detail(analysis)}</div>
                  </div>
                  <span className="font-medium text-ink">{group.value(analysis)}</span>
                </div>
              ))}
              {!group.rows.length ? <div className="text-sm text-muted">No valid scenario data</div> : null}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleCard>
  );
}

function ScenarioValuationAudit({ analyses }: { analyses: StockAnalysis[] }) {
  const sorted = [...analyses].sort((left, right) => left.stock.ticker.localeCompare(right.stock.ticker));
  const rows = sorted.filter((analysis) => analysis.valuation.scenarioValuation.decisionLabel !== "Insufficient Scenario Data");
  const missingRows = sorted.filter((analysis) => analysis.valuation.scenarioValuation.decisionLabel === "Insufficient Scenario Data");
  return (
    <CollapsibleCard
      title="Scenario Decision Audit"
      badge={<Badge>{rows.length} valid / {missingRows.length} missing</Badge>}
      contentClassName="grid gap-4"
    >
      <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm leading-6 text-muted">
        Only stocks with valid price, FCF, historical FCF, share count, and sufficient real data appear in the decision table. Research-only results do not change the current score weights or recommendation engine.
      </div>
      <div className="overflow-x-auto rounded-lg border border-stroke">
        <table className="min-w-[1780px] w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-stroke bg-panel text-muted">
              <th className="px-3 py-2 font-medium">Stock</th>
              <th className="px-3 py-2 font-medium">Current price</th>
              <th className="px-3 py-2 font-medium">Bear fair value</th>
              <th className="px-3 py-2 font-medium">Base fair value</th>
              <th className="px-3 py-2 font-medium">Bull fair value</th>
              <th className="px-3 py-2 font-medium">Weighted fair value</th>
              <th className="px-3 py-2 font-medium">Weighted upside/downside</th>
              <th className="px-3 py-2 font-medium">Expected annual return</th>
              <th className="px-3 py-2 font-medium">Downside to Bear</th>
              <th className="px-3 py-2 font-medium">Upside to Bull</th>
              <th className="px-3 py-2 font-medium">Risk/reward</th>
              <th className="px-3 py-2 font-medium">Risk/reward label</th>
              <th className="px-3 py-2 font-medium">Decision label</th>
              <th className="px-3 py-2 font-medium">Probabilities</th>
              <th className="px-3 py-2 font-medium">Explanation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((analysis) => {
              const scenarios = analysis.valuation.scenarioValuation;
              return (
                <tr key={analysis.stock.id} className="border-b border-stroke last:border-0">
                  <td className="px-3 py-3 font-semibold text-ink">{analysis.stock.ticker}</td>
                  <td className="px-3 py-3 text-muted">{money(analysis.stock.current_price)}</td>
                  <td className="px-3 py-3 text-muted">{scenarios.bear.fairValue ? money(scenarios.bear.fairValue) : "--"}</td>
                  <td className="px-3 py-3 font-medium text-ink">{scenarios.base.fairValue ? money(scenarios.base.fairValue) : "--"}</td>
                  <td className="px-3 py-3 text-muted">{scenarios.bull.fairValue ? money(scenarios.bull.fairValue) : "--"}</td>
                  <td className="px-3 py-3 font-medium text-ink">{scenarios.weightedFairValue ? money(scenarios.weightedFairValue) : "--"}</td>
                  <td className="px-3 py-3 text-muted">{comparisonValue(scenarios.weightedUpsideDownsidePct, "%")}</td>
                  <td className="px-3 py-3 text-muted">{comparisonValue(scenarios.expectedAnnualizedReturnPct, "%")}</td>
                  <td className="px-3 py-3 text-muted">{comparisonValue(scenarios.downsideToBearPct, "%")}</td>
                  <td className="px-3 py-3 text-muted">{comparisonValue(scenarios.upsideToBullPct, "%")}</td>
                  <td className="px-3 py-3 text-muted">{scenarioRatioDisplay(analysis)}</td>
                  <td className="px-3 py-3 text-muted">{scenarios.riskRewardLabel}</td>
                  <td className="px-3 py-3 font-medium text-ink">{scenarios.decisionLabel}</td>
                  <td className="px-3 py-3 text-muted">{scenarios.probabilities.bear}% / {scenarios.probabilities.base}% / {scenarios.probabilities.bull}%</td>
                  <td className="max-w-96 px-3 py-3 text-muted"><span className="break-words">{scenarios.explanation}</span></td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr><td colSpan={15} className="px-3 py-6 text-center text-muted">No stocks currently have complete scenario data.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div>
        <div className="mb-2 text-sm font-medium text-ink">Scenario Data Missing</div>
        <div className="overflow-x-auto rounded-lg border border-stroke">
          <table className="min-w-[760px] w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-stroke bg-panel text-muted">
                <th className="px-3 py-2 font-medium">Stock</th>
                <th className="px-3 py-2 font-medium">Stored price</th>
                <th className="px-3 py-2 font-medium">Missing reason</th>
                <th className="px-3 py-2 font-medium">Real data</th>
              </tr>
            </thead>
            <tbody>
              {missingRows.map((analysis) => (
                <tr key={`missing-${analysis.stock.id}`} className="border-b border-stroke last:border-0">
                  <td className="px-3 py-3 font-semibold text-ink">{analysis.stock.ticker}</td>
                  <td className="px-3 py-3 text-muted">{analysis.stock.current_price > 0 ? money(analysis.stock.current_price) : "--"}</td>
                  <td className="px-3 py-3 text-muted">{analysis.valuation.scenarioValuation.missingReasons.join(", ") || "insufficient scenario data"}</td>
                  <td className="px-3 py-3 text-muted">{analysis.realDataPercent}%</td>
                </tr>
              ))}
              {!missingRows.length ? (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-muted">No missing scenario records.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </CollapsibleCard>
  );
}

function Ranking({ title, rows, language, wide = false }: { title: string; rows: StockAnalysis[]; language: Language; wide?: boolean }) {
  return (
    <div className={wide ? "grid min-w-0 gap-2" : "grid min-w-0 gap-2"}>
      <div className="break-words text-sm font-medium text-ink">{title}</div>
      {rows.map((analysis) => (
        <SmallRank key={`${title}-${analysis.stock.id}`} analysis={analysis} language={language} />
      ))}
      {!rows.length ? <div className="rounded-lg border border-stroke bg-canvas p-4 text-sm text-muted">No data</div> : null}
    </div>
  );
}

function compactMoney(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2
  }).format(value);
}

function NormalizedFcfDcf({
  analysis,
  cache,
  assumptions
}: {
  analysis: StockAnalysis;
  cache: InvestmentCache;
  assumptions: DcfAssumptions;
}) {
  const history = combinedCashFlowHistoryForTicker(cache, analysis.stock.ticker);
  const latestRow = history[0];
  const latestFcf = latestRow?.freeCashFlow ?? analysis.stock.free_cash_flow;
  const average3y = averageFcf(history, 3);
  const average5y = averageFcf(history, 5);
  const baseGrowthPct = analysis.stock.revenue_growth_pct ?? assumptions.base_fcf_growth_pct;
  const optimisticGrowthPct = Math.min(25, baseGrowthPct + 3);
  const conservative = calculateDcfModel(analysis.stock, assumptions, { baseFcf: latestFcf, growthPct: baseGrowthPct });
  const normalized = average3y === null ? null : calculateDcfModel(analysis.stock, assumptions, { baseFcf: average3y, growthPct: baseGrowthPct });
  const optimistic = average3y === null ? null : calculateDcfModel(analysis.stock, assumptions, { baseFcf: average3y, growthPct: optimisticGrowthPct });
  const sensitivityBase = average3y ?? latestFcf;
  const sensitivityGrowth = [5, 8, 12, 15];
  const sensitivityDiscount = [8, 10, 12];
  const comparisonAverage = average3y ?? average5y;
  const latestDifferencePct =
    latestFcf !== null && latestFcf !== undefined && comparisonAverage !== null && comparisonAverage > 0
      ? ((latestFcf - comparisonAverage) / comparisonAverage) * 100
      : null;
  const unusualWarning =
    latestDifferencePct !== null && latestDifferencePct <= -30
      ? "Latest FCF appears unusually low compared with historical average."
      : latestDifferencePct !== null && latestDifferencePct >= 30
        ? "Latest FCF appears unusually high compared with historical average."
        : "";
  const modes = [
    {
      label: "Conservative",
      detail: "Latest annual FCF",
      calculation: conservative,
      primary: analysis.valuation.primaryDcfMode === "Conservative"
    },
    {
      label: "Normalized",
      detail: "3-year average FCF",
      calculation: normalized,
      primary: analysis.valuation.primaryDcfMode === "Normalized"
    },
    {
      label: "Optimistic",
      detail: `3-year average; ${comparisonValue(optimisticGrowthPct, "%")} growth (+3pp)`,
      calculation: optimistic,
      primary: false
    }
  ];

  return (
    <details className="mt-4 min-w-0 overflow-hidden rounded-lg border border-stroke bg-panel">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-3 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
        <div>
          <div className="text-sm font-medium text-ink">Normalized FCF DCF</div>
          <div className="mt-1 text-xs text-muted">Primary DCF feeds fair value, buy zones, premium calculations, and valuation decisions.</div>
        </div>
        <Badge>Primary: {analysis.valuation.primaryDcfMode}</Badge>
      </summary>
      <div className="grid gap-4 border-t border-stroke p-3 sm:p-4">
        <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm text-ink">
          {analysis.valuation.primaryDcfReason}
        </div>
        {unusualWarning ? (
          <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm font-medium text-ink">
            {unusualWarning}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modes.map((mode) => (
            <div key={mode.label} className="rounded-lg border border-stroke bg-canvas p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-ink">{mode.label}</div>
                {mode.primary ? <Badge>Primary</Badge> : null}
              </div>
              <div className="mt-1 text-xs text-muted">{mode.detail}</div>
              <div className="mt-3 text-xl font-semibold text-ink">
                {mode.calculation ? money(mode.calculation.fairValue) : "--"}
              </div>
              <div className="mt-2 grid gap-1 text-xs text-muted">
                <div>Base FCF: {compactMoney(mode.calculation?.baseFcf)}</div>
                <div>Growth: {mode.calculation ? comparisonValue(mode.calculation.growthPct, "%") : "--"}</div>
                <div>Terminal value: {compactMoney(mode.calculation?.terminalValue)}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto rounded-lg border border-stroke">
          <table className="min-w-[760px] w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-stroke bg-canvas text-muted">
                <th className="px-3 py-2 font-medium">FCF audit</th>
                <th className="px-3 py-2 font-medium">Value</th>
                <th className="px-3 py-2 font-medium">Period / source</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-stroke">
                <td className="px-3 py-2 font-medium text-ink">Latest FCF</td>
                <td className="px-3 py-2 text-muted">{compactMoney(latestFcf)}</td>
                <td className="px-3 py-2 text-muted">{latestRow?.fiscalYear || "Stored stock field"} / {latestRow ? `${latestRow.source} cache ${latestRow.cacheDate}` : analysis.stock.field_audit?.free_cash_flow?.source ?? "stored value"}</td>
              </tr>
              <tr className="border-b border-stroke">
                <td className="px-3 py-2 font-medium text-ink">3Y average FCF</td>
                <td className="px-3 py-2 text-muted">{compactMoney(average3y)}</td>
                <td className="px-3 py-2 text-muted">{average3y === null ? "Need 3 annual periods" : history.slice(0, 3).map((row) => row.fiscalYear).join(", ")}</td>
              </tr>
              <tr className="border-b border-stroke">
                <td className="px-3 py-2 font-medium text-ink">5Y average FCF</td>
                <td className="px-3 py-2 text-muted">{compactMoney(average5y)}</td>
                <td className="px-3 py-2 text-muted">{average5y === null ? "Need 5 annual periods" : history.slice(0, 5).map((row) => row.fiscalYear).join(", ")}</td>
              </tr>
              <tr className="border-b border-stroke">
                <td className="px-3 py-2 font-medium text-ink">Latest CapEx</td>
                <td className="px-3 py-2 text-muted">{compactMoney(latestRow?.capitalExpenditure)}</td>
                <td className="px-3 py-2 text-muted">{latestRow?.fiscalYear || "Not available"}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium text-ink">Latest operating cash flow</td>
                <td className="px-3 py-2 text-muted">{compactMoney(latestRow?.operatingCashFlow)}</td>
                <td className="px-3 py-2 text-muted">{latestRow?.fiscalYear || "Not available"}</td>
              </tr>
              {latestRow?.source === "SEC EDGAR" ? (
                <tr>
                  <td className="px-3 py-2 font-medium text-ink">SEC concept / sign audit</td>
                  <td className="px-3 py-2 text-muted">{latestRow.operatingConcept ?? "--"} / {latestRow.capexConcept ?? "--"}</td>
                  <td className="px-3 py-2 text-muted">{latestRow.capexSignNote ?? (latestRow.capexSignAdjusted ? "CapEx sign normalized." : "CapEx subtracted as cash outflow.")}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-ink">DCF Sensitivity</div>
          <div className="mb-2 text-xs text-muted">
            Base FCF: {compactMoney(sensitivityBase)} ({average3y !== null ? "3-year normalized" : "latest available"}); terminal growth {comparisonValue(assumptions.terminal_growth_pct, "%")}.
          </div>
          <div className="overflow-x-auto rounded-lg border border-stroke">
            <table className="min-w-[560px] w-full border-collapse text-center text-xs">
              <thead>
                <tr className="border-b border-stroke bg-canvas text-muted">
                  <th className="px-3 py-2 text-left font-medium">Growth</th>
                  {sensitivityDiscount.map((discount) => (
                    <th key={discount} className="px-3 py-2 font-medium">Discount {discount}%</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sensitivityGrowth.map((growth) => (
                  <tr key={growth} className="border-b border-stroke last:border-0">
                    <td className="px-3 py-2 text-left font-medium text-ink">{growth}%</td>
                    {sensitivityDiscount.map((discount) => {
                      const calculation = calculateDcfModel(analysis.stock, assumptions, {
                        baseFcf: sensitivityBase,
                        growthPct: growth,
                        discountRatePct: discount
                      });
                      return <td key={`${growth}-${discount}`} className="px-3 py-2 text-muted">{calculation ? money(calculation.fairValue) : "--"}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </details>
  );
}

function ScenarioValuationEngine({ analysis }: { analysis: StockAnalysis }) {
  const scenarioResult = analysis.valuation.scenarioValuation;
  const scenarios = [scenarioResult.bear, scenarioResult.base, scenarioResult.bull];
  return (
    <details className="mt-4 min-w-0 overflow-hidden rounded-lg border border-stroke bg-panel">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-3 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
        <div>
          <div className="text-sm font-medium text-ink">Scenario Valuation Engine</div>
          <div className="mt-1 text-xs text-muted">Bear, Base, and Bull outcomes using explicit DCF assumptions.</div>
        </div>
        <Badge className={scenarioDecisionNeedsAttention(scenarioResult.decisionLabel) ? "border-danger/40 text-danger" : ""}>{scenarioResult.decisionLabel}</Badge>
      </summary>
      <div className="grid gap-4 border-t border-stroke p-3 sm:p-4">
        <div className="rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm text-muted">
          {scenarioResult.explanation} Research only; this view does not change scoring or recommendations.
        </div>
        {scenarioResult.missingReasons.length ? (
          <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
            Scenario data missing: {scenarioResult.missingReasons.join(", ")}.
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ValueBox label="Weighted Fair Value" value={scenarioResult.weightedFairValue ? money(scenarioResult.weightedFairValue) : "--"} />
          <ValueBox label="Weighted Upside / Downside" value={comparisonValue(scenarioResult.weightedUpsideDownsidePct, "%")} tone={(scenarioResult.weightedUpsideDownsidePct ?? 0) < 0 ? "danger" : "neutral"} />
          <ValueBox label="Expected Annual Return" value={comparisonValue(scenarioResult.expectedAnnualizedReturnPct, "%")} tone={(scenarioResult.expectedAnnualizedReturnPct ?? 0) < 0 ? "danger" : "neutral"} />
          <ValueBox label="Risk / Reward" value={scenarioRatioDisplay(analysis)} tone={!hasMeasurableScenarioRiskReward(analysis) || (scenarioResult.riskRewardRatio ?? 999) < 1 ? "danger" : "neutral"} />
          <ValueBox label="Downside to Bear" value={comparisonValue(scenarioResult.downsideToBearPct, "%")} tone={(scenarioResult.downsideToBearPct ?? 0) < -20 ? "danger" : "neutral"} />
          <ValueBox label="Upside to Bull" value={comparisonValue(scenarioResult.upsideToBullPct, "%")} tone={(scenarioResult.upsideToBullPct ?? 0) <= 0 ? "danger" : "neutral"} />
          <ValueBox label="Risk / Reward Label" value={scenarioResult.riskRewardLabel} tone={scenarioRiskRewardNeedsAttention(scenarioResult.riskRewardLabel) ? "danger" : "neutral"} />
          <ValueBox label="Probabilities" value={`${scenarioResult.probabilities.bear}% / ${scenarioResult.probabilities.base}% / ${scenarioResult.probabilities.bull}%`} />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {scenarios.map((scenario) => (
            <div key={scenario.name} className="min-w-0 rounded-lg border border-stroke bg-canvas p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-ink">{scenario.name} Case</div>
                {scenario.name === "Base" ? <Badge>Primary DCF</Badge> : null}
              </div>
              <div className={cn("mt-3 text-2xl font-semibold", attentionTextClass((scenario.upsideDownsidePct ?? 0) < 0))}>
                {scenario.fairValue ? money(scenario.fairValue) : "--"}
              </div>
              <div className="mt-1 text-xs text-muted">Fair value</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <ValueBox label="Upside / Downside" value={comparisonValue(scenario.upsideDownsidePct, "%")} tone={(scenario.upsideDownsidePct ?? 0) < 0 ? "danger" : "neutral"} />
                <ValueBox label="Implied Annual Return" value={comparisonValue(scenario.impliedAnnualReturnPct, "%")} tone={(scenario.impliedAnnualReturnPct ?? 0) < 0 ? "danger" : "neutral"} />
              </div>
              <div className="mt-3 grid gap-1 text-xs leading-5 text-muted">
                <div className="break-words">FCF: {compactMoney(scenario.baseFcf)} ({scenario.fcfSource})</div>
                <div>FCF growth: {comparisonValue(scenario.growthPct, "%")}</div>
                <div>Discount rate: {comparisonValue(scenario.discountRatePct, "%")}</div>
                <div>Terminal growth: {comparisonValue(scenario.terminalGrowthPct, "%")}</div>
                <div>Projection: {scenario.projectionYears || "--"} years</div>
                {scenario.marginExpansionPct ? (
                  <div>Margin expansion proxy: +{comparisonValue(scenario.marginExpansionPct, "%")} initial FCF uplift</div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-2 text-xs text-muted sm:grid-cols-3">
          <div className="rounded-lg border border-stroke bg-canvas p-3">
            <div className="font-medium text-ink">Bear assumptions</div>
            <div className="mt-1">Lower available FCF, growth -5pp, discount +2pp, terminal growth capped at 1.5%.</div>
          </div>
          <div className="rounded-lg border border-stroke bg-canvas p-3">
            <div className="font-medium text-ink">Base assumptions</div>
            <div className="mt-1">Current Primary DCF mode and the user&apos;s active DCF assumptions.</div>
          </div>
          <div className="rounded-lg border border-stroke bg-canvas p-3">
            <div className="font-medium text-ink">Bull assumptions</div>
            <div className="mt-1">Normalized FCF, growth +5pp, 5% FCF uplift proxy, and discount rate reduced by 1.5pp with an 8% floor.</div>
          </div>
        </div>
      </div>
    </details>
  );
}

function AnalysisDetail({
  title,
  rows,
  language,
  cache,
  assumptions
}: {
  title: string;
  rows: StockAnalysis[];
  language: Language;
  cache: InvestmentCache;
  assumptions: DcfAssumptions;
}) {
  const t = copy[language === "zh" ? "zh" : "en"];
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <TrendingUp className="h-4 w-4 text-accent" />
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4 p-3 sm:p-5">
        {rows.map((analysis) => (
          <div key={analysis.stock.id} className="min-w-0 rounded-lg border border-stroke bg-canvas p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="break-words text-base font-semibold text-ink sm:text-lg">{analysis.stock.ticker} - {analysis.stock.company_name || analysis.stock.ticker}</div>
                <div className={cn("mt-1 break-words text-sm", attentionMutedTextClass(analysisNeedsAttention(analysis)))}>{recommendationLabel(language, analysis.recommendation)} - {riskLabel(language, analysis.riskLabel)}</div>
              </div>
              <Badge className={analysisNeedsAttention(analysis) ? "border-danger/40 text-danger" : ""}>{analysis.totalScore}/100</Badge>
            </div>
            <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              <ValueBox label="Quality" value={`${analysis.breakdown.quality}`} />
              <ValueBox label="Valuation" value={`${analysis.breakdown.valuation}`} />
              <ValueBox label="Risk" value={`${analysis.breakdown.risk}`} tone={analysis.breakdown.risk < 50 || riskNeedsAttention(analysis.riskLabel) ? "danger" : "neutral"} />
              <ValueBox label={language === "zh" ? "数据可靠性" : "Data Reliability"} value={`${analysis.dataReliabilityScore}/100`} />
              <ValueBox label="Real Data Impact" value={`${analysis.realDataPercent}%`} tone={analysis.realDataPercent < 70 ? "danger" : "neutral"} />
              <ValueBox label="Fallback Impact" value={`${analysis.fallbackPercent}%`} tone={analysis.fallbackPercent > 30 ? "danger" : "neutral"} />
              <ValueBox label={language === "zh" ? "推荐信心" : "Confidence"} value={language === "zh" ? ({ High: "高", Medium: "中", Low: "低" }[analysis.recommendationConfidence]) : analysis.recommendationConfidence} />
              <ValueBox label={language === "zh" ? "估值一致性" : "Valuation Agreement"} value={language === "zh" ? ({ Aligned: "一致", Mixed: "部分一致", Disagree: "明显分歧", Unknown: "未知" }[analysis.valuation.valuationAgreement]) : analysis.valuation.valuationAgreement} />
              <ValueBox label="Primary DCF Mode" value={analysis.valuation.primaryDcfMode} />
              <ValueBox label="DCF" value={analysis.valuation.dcfFairValue ? money(analysis.valuation.dcfFairValue) : "--"} />
              <ValueBox label="Premium Above Fair Value" value={comparisonValue(fairValuePremiumPct(analysis), "%")} tone={(fairValuePremiumPct(analysis) ?? 0) > 0 ? "danger" : "neutral"} />
              <ValueBox label={t.conservativeBuy} value={analysis.valuation.conservativeBuyPrice ? money(analysis.valuation.conservativeBuyPrice) : "--"} />
              <ValueBox label={t.betterPrice} value={analysis.betterBuyPrice ? money(analysis.betterBuyPrice) : "--"} />
            </div>
            {analysis.fallbackPercent > 30 ? (
              <div className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
                Score unreliable due to missing data
              </div>
            ) : null}
            <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              <ScoreBreakdownBox
                title="Quality x 40%"
                audit={analysis.componentAudit}
                rows={[
                  ["ROE", analysis.breakdown.roe],
                  ["Margin", analysis.breakdown.margin],
                  ["Revenue Growth", analysis.breakdown.revenueGrowth],
                  ["FCF Growth", analysis.breakdown.fcfGrowth],
                  ["Debt", analysis.breakdown.debt]
                ]}
              />
              <ScoreBreakdownBox
                title="Valuation x 35%"
                audit={analysis.componentAudit}
                rows={[
                  ["DCF Discount", analysis.breakdown.dcfDiscount],
                  ["PEG", analysis.breakdown.peg],
                  ["PE vs Industry", analysis.breakdown.peVsIndustry]
                ]}
              />
              <ScoreBreakdownBox
                title="Risk x 25%"
                audit={analysis.componentAudit}
                rows={[
                  ["Volatility", analysis.breakdown.volatility],
                  ["Drawdown", analysis.breakdown.drawdown],
                  ["Debt Risk", analysis.breakdown.debtRisk]
                ]}
              />
            </div>
            <NormalizedFcfDcf analysis={analysis} cache={cache} assumptions={assumptions} />
            <ScenarioValuationEngine analysis={analysis} />
            <DataSourceAudit analysis={analysis} cache={cache} />
            <div className="mt-4 grid min-w-0 gap-2 break-words text-sm text-muted">
              {localizedReasons(language, analysis).map((reason) => <div key={reason}>{reason}</div>)}
              <div className={riskNeedsAttention(analysis.riskLabel) || analysis.valuationRisk === "High" ? "text-danger" : ""}>{t.biggestRisk}: {localizedRisk(language, analysis)}</div>
              <div>{t.fairValue}: {analysis.valuation.fairValueLow ? `${money(analysis.valuation.fairValueLow)} - ${money(analysis.valuation.fairValueHigh ?? analysis.valuation.fairValueLow)}` : "--"}</div>
              <div>{t.holdZone}: {analysis.valuation.holdZoneLow ? `${money(analysis.valuation.holdZoneLow)} - ${money(analysis.valuation.holdZoneHigh ?? analysis.valuation.holdZoneLow)}` : "--"}</div>
              <div className={(fairValuePremiumPct(analysis) ?? 0) > 0 ? "text-danger" : ""}>{t.trimZone}: {analysis.valuation.trimZonePrice ? money(analysis.valuation.trimZonePrice) : "--"}</div>
              <div>{t.positionSize}: {analysis.positionSizeRange}</div>
              <div className={analysis.missingData.length ? "text-danger" : ""}>{t.missingData}: {analysis.missingData.join(", ") || "--"}</div>
              <div>{language === "zh" ? "DCF 假设" : "DCF assumptions"}: {analysis.valuation.dcfAssumptions.discount_rate_pct}% discount, {analysis.valuation.dcfAssumptions.terminal_growth_pct}% terminal, {analysis.valuation.dcfAssumptions.projection_years} years, {analysis.valuation.dcfAssumptions.base_fcf_growth_pct}% base growth</div>
              {analysis.warnings.length ? (
                <div className="grid gap-1">
                  {analysis.warnings.map((warning) => (
                    <div key={warning} className="rounded-md border border-danger/40 bg-danger/10 px-2 py-1 text-danger">{warningText(language, warning)}</div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function WatchlistCard({
  title,
  language,
  watchlist,
  draft,
  setDraft,
  saveWatch,
  deleteWatch
}: {
  title: string;
  language: Language;
  watchlist: WatchlistItem[];
  draft: WatchlistItem;
  setDraft: (draft: WatchlistItem) => void;
  saveWatch: (event: FormEvent) => void;
  deleteWatch: (id: string) => void;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <ShieldAlert className="h-4 w-4 text-accent" />
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4 p-3 sm:p-5">
        <form onSubmit={saveWatch} className="grid gap-3">
          <TextField label="Ticker / 代码" value={draft.ticker} onChange={(value) => setDraft({ ...draft, ticker: value.toUpperCase() })} />
          <NumberField label="Target Buy / 目标价" value={draft.target_buy_price} onChange={(value) => setDraft({ ...draft, target_buy_price: value ?? 0 })} />
          <Field label="Risk / 风险">
            <Select value={draft.risk_level} options={RISK_LABELS} onChange={(event) => setDraft({ ...draft, risk_level: event.target.value as RiskLabel })} />
          </Field>
          <TextField label="Reason / 原因" value={draft.reason} onChange={(value) => setDraft({ ...draft, reason: value })} />
          <Field label="Notes / 备注">
            <Textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
          </Field>
          <Button type="submit" variant="primary">Add Watchlist Item</Button>
        </form>
        <div className="grid gap-2">
          {watchlist.map((item) => (
            <div key={item.id} className="min-w-0 rounded-lg border border-stroke bg-canvas p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 break-words font-medium text-ink">{item.ticker} - {money(item.target_buy_price)}</div>
                <Button type="button" variant="ghost" size="icon" onClick={() => deleteWatch(item.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="mt-1 break-words text-muted">{riskLabel(language, item.risk_level)} - {item.reason}</div>
              <div className="mt-1 break-words text-xs text-muted">{item.notes}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
