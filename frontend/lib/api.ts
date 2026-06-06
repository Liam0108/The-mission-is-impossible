import type {
  AnalyzerRequest,
  AnalyzerResponse,
  Dashboard,
  DataQualityDashboard,
  EdgeDiscoveryResponse,
  ManagementResponse,
  MarketLabSummary,
  MarketSwingConfig,
  MlStatus,
  MonteCarloResponse,
  ResearchSummary,
  ScreenshotItem,
  Trade,
  TradePayload
} from "@/lib/types";
import { localApi } from "@/lib/local-store";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? "http://127.0.0.1:8000";

class ApiRequestError extends Error {
  constructor(message: string, readonly status: number | null = null) {
    super(message);
  }
}

type RegimeFilter = { regime_label?: string | null };
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
type FreeMarketDataParams = MarketSwingParams & {
  range?: string;
  force_refresh?: boolean;
};

function queryFrom(params?: RegimeFilter) {
  const query = new URLSearchParams();
  if (params?.regime_label) query.set("regime_label", params.regime_label);
  const value = query.toString();
  return value ? `?${value}` : "";
}

function marketSwingQuery(params: MarketSwingParams) {
  const query = new URLSearchParams({ symbol: params.symbol, timeframe: params.timeframe });
  if (params.swing_mode) query.set("swing_mode", params.swing_mode);
  if (params.swing_left_candles !== undefined) query.set("swing_left_candles", String(params.swing_left_candles));
  if (params.swing_right_candles !== undefined) query.set("swing_right_candles", String(params.swing_right_candles));
  if (params.min_swing_distance !== undefined) query.set("min_swing_distance", String(params.min_swing_distance));
  if (params.min_structure_node_importance !== undefined) query.set("min_structure_node_importance", String(params.min_structure_node_importance));
  if (params.max_structure_sweep_age_minutes !== undefined && params.max_structure_sweep_age_minutes !== null) {
    query.set("max_structure_sweep_age_minutes", String(params.max_structure_sweep_age_minutes));
  }
  if (params.min_structure_pierce_size !== undefined) query.set("min_structure_pierce_size", String(params.min_structure_pierce_size));
  return query;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      },
      cache: "no-store"
    });
  } catch (error) {
    throw new ApiRequestError(error instanceof Error ? error.message : "Backend unavailable", null);
  }

  if (!response.ok) {
    const message = await response.text();
    throw new ApiRequestError(message || `Request failed: ${response.status}`, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function localWhenOffline<T>(remote: () => Promise<T>, local: () => Promise<T>): Promise<T> {
  try {
    return await remote();
  } catch (error) {
    if (error instanceof ApiRequestError && (error.status === null || error.status >= 500)) {
      return local();
    }
    throw error;
  }
}

export const api = {
  dashboard: (params?: RegimeFilter) => localWhenOffline(() => request<Dashboard>(`/api/dashboard${queryFrom(params)}`), () => localApi.dashboard(params)),
  trades: () => localWhenOffline(() => request<Trade[]>("/api/trades"), localApi.trades),
  createTrade: (payload: TradePayload) =>
    localWhenOffline(() => request<Trade>("/api/trades", { method: "POST", body: JSON.stringify(payload) }), () => localApi.createTrade(payload)),
  updateTrade: (id: string, payload: Partial<TradePayload>) =>
    localWhenOffline(() => request<Trade>(`/api/trades/${id}`, { method: "PATCH", body: JSON.stringify(payload) }), () => localApi.updateTrade(id, payload)),
  deleteTrade: (id: string) => localWhenOffline(() => request<void>(`/api/trades/${id}`, { method: "DELETE" }), () => localApi.deleteTrade(id)),
  evaluateSetup: (payload: AnalyzerRequest) =>
    localWhenOffline(() => request<AnalyzerResponse>("/api/analyzer/evaluate", { method: "POST", body: JSON.stringify(payload) }), () => localApi.evaluateSetup(payload)),
  managementLab: (params: { partial_exit_percent: number; be_after_tp1: boolean; tp2_enabled: boolean; tp2_price: number | null; regime_label?: string | null }) => {
    const query = new URLSearchParams({
      partial_exit_percent: String(params.partial_exit_percent),
      be_after_tp1: String(params.be_after_tp1),
      tp2_enabled: String(params.tp2_enabled)
    });
    if (params.tp2_price !== null) query.set("tp2_price", String(params.tp2_price));
    if (params.regime_label) query.set("regime_label", params.regime_label);
    return localWhenOffline(() => request<ManagementResponse>(`/api/analytics/management?${query.toString()}`), () => localApi.managementLab(params));
  },
  dataQualityDashboard: () => localWhenOffline(() => request<DataQualityDashboard>("/api/analytics/data-quality"), localApi.dataQualityDashboard),
  monteCarloRisk: (params: {
    simulations: number;
    account_size: number;
    risk_per_trade: number;
    risk_mode: string;
    daily_loss_limit: number | null;
    account_drawdown_limit_percent: number;
    trades_per_day: number;
    regime_label?: string | null;
  }) => {
    const query = new URLSearchParams({
      simulations: String(params.simulations),
      account_size: String(params.account_size),
      risk_per_trade: String(params.risk_per_trade),
      risk_mode: params.risk_mode,
      account_drawdown_limit_percent: String(params.account_drawdown_limit_percent),
      trades_per_day: String(params.trades_per_day)
    });
    if (params.daily_loss_limit !== null) query.set("daily_loss_limit", String(params.daily_loss_limit));
    if (params.regime_label) query.set("regime_label", params.regime_label);
    return localWhenOffline(() => request<MonteCarloResponse>(`/api/analytics/monte-carlo?${query.toString()}`), () => localApi.monteCarloRisk(params));
  },
  mlStatus: () => localWhenOffline(() => request<MlStatus>("/api/analytics/ml-status"), localApi.mlStatus),
  screenshots: (query = "") => localWhenOffline(() => request<ScreenshotItem[]>(`/api/screenshots${query}`), () => localApi.screenshots(query)),
  review: (params?: RegimeFilter) => localWhenOffline(() => request<ResearchSummary["review"]>(`/api/research/review${queryFrom(params)}`), () => localApi.review(params)),
  dailyScore: (params?: RegimeFilter) => localWhenOffline(() => request<ResearchSummary["scores"]>(`/api/research/daily-score${queryFrom(params)}`), () => localApi.dailyScore(params)),
  marketContext: (params?: RegimeFilter) => localWhenOffline(() => request<ResearchSummary["marketContext"]>(`/api/research/market-context${queryFrom(params)}`), () => localApi.marketContext(params)),
  news: (params?: RegimeFilter) => localWhenOffline(() => request<Record<string, unknown>>(`/api/research/news${queryFrom(params)}`), () => localApi.news(params)),
  strategyVersions: (params?: RegimeFilter) => localWhenOffline(() => request<ResearchSummary["strategies"]>(`/api/research/strategy-versions${queryFrom(params)}`), () => localApi.strategyVersions(params)),
  sessions: (params?: RegimeFilter) => localWhenOffline(() => request<ResearchSummary["sessions"]>(`/api/research/sessions${queryFrom(params)}`), () => localApi.sessions(params)),
  edgeDiscovery: (params?: RegimeFilter) => localWhenOffline(() => request<EdgeDiscoveryResponse>(`/api/research/edge-discovery${queryFrom(params)}`), () => localApi.edgeDiscovery(params)),
  marketDataSummary: (params: MarketSwingParams) => {
    const query = marketSwingQuery(params);
    return localWhenOffline(() => request<MarketLabSummary>(`/api/market-data/summary?${query.toString()}`), () => localApi.marketDataSummary(params));
  },
  freeMarketData: (params: FreeMarketDataParams) => {
    const query = marketSwingQuery(params);
    if (params.range) query.set("range", params.range);
    if (params.force_refresh !== undefined) query.set("force_refresh", String(params.force_refresh));
    return request<MarketLabSummary>(`/api/market-data/free-data?${query.toString()}`);
  },
  importMarketDataCsv: async (file: File, params: MarketSwingParams) => {
    const form = new FormData();
    form.append("file", file);
    const query = marketSwingQuery(params);
    try {
      const response = await fetch(`${API_BASE}/api/market-data/import?${query.toString()}`, { method: "POST", body: form });
      if (!response.ok) throw new ApiRequestError(await response.text(), response.status);
      return response.json() as Promise<MarketLabSummary>;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status !== null && error.status < 500) throw error;
      return localApi.importMarketDataCsv(file, params);
    }
  },
  uploadScreenshot: async (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch(`${API_BASE}/api/trades/${id}/screenshot`, { method: "POST", body: form });
      if (!response.ok) throw new ApiRequestError(await response.text(), response.status);
      return response.json() as Promise<Trade>;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status !== null && error.status < 500) throw error;
      return localApi.uploadScreenshot(id, file);
    }
  },
  importCsv: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch(`${API_BASE}/api/trades/import`, { method: "POST", body: form });
      if (!response.ok) throw new ApiRequestError(await response.text(), response.status);
      return response.json() as Promise<Trade[]>;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status !== null && error.status < 500) throw error;
      return localApi.importCsv(file);
    }
  },
  exportCsv: () => localWhenOffline(async () => {
    const response = await fetch(`${API_BASE}/api/trades/export/csv`);
    if (!response.ok) throw new ApiRequestError(await response.text(), response.status);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fabio-edge-trades.csv";
    link.click();
    URL.revokeObjectURL(url);
  }, localApi.exportCsv)
};
