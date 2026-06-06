export type Trade = {
  id: string;
  user_id: string | null;
  workspace_id: string | null;
  date: string;
  instrument: string;
  data_type: string;
  session: string;
  direction: string;
  bias_15m: string;
  market_state: string;
  regime_label: string | null;
  location: string;
  liquidity_sweep: string;
  choch: string;
  lh_hl: string;
  fvg_reaction: string;
  volume_state: string;
  strategy_version: string | null;
  setup_type: string | null;
  setup_score: number | null;
  manual_quality: string | null;
  trade_decision: string;
  skip_reason: string | null;
  entry_price: number | null;
  stop_loss: number | null;
  tp1_price: number | null;
  tp2_price: number | null;
  risk_amount: number | null;
  result: string;
  result_r: number;
  mfe: number;
  mae: number;
  distance_to_poc: number | null;
  distance_to_vah: number | null;
  distance_to_val: number | null;
  poc_risk_level: string;
  similarity_group_id: string | null;
  management_rule_notes: string | null;
  screenshot_tags: string | null;
  screenshot_favorite: boolean;
  screenshot_bookmarked: boolean;
  screenshot_notes: string | null;
  lessons_learned: string | null;
  followed_plan: string;
  mistake_type: string;
  discipline_score: number | null;
  execution_score: number | null;
  emotion_score: number | null;
  review_notes: string | null;
  daily_bias: string;
  weekly_bias: string;
  monthly_bias: string;
  high_impact_news: string;
  news_type: string | null;
  news_timing: string;
  notes: string | null;
  screenshot_path: string | null;
  data_quality: "good" | "incomplete" | "bad";
  account: string | null;
  broker_symbol: string | null;
  quantity: number | null;
  entry_time: string | null;
  exit_time: string | null;
  exit_price: number | null;
  gross_pnl: number | null;
  commission: number | null;
  net_pnl: number | null;
  broker_trade_id: string | null;
  import_source: string | null;
  holding_time_minutes: number | null;
  imported: boolean;
  review_status: "unreviewed" | "reviewed";
  created_at: string;
  updated_at: string;
};

export type TradePayload = Omit<Trade, "id" | "created_at" | "updated_at">;

export type Dashboard = {
  total_trades: number;
  win_rate: number;
  tp1_rate: number;
  be_rate: number;
  sl_rate: number;
  average_rr: number;
  profit_factor: number;
  expectancy: number;
  max_winning_streak: number;
  max_losing_streak: number;
  average_mfe: number;
  average_mae: number;
  taken_count: number;
  skipped_count: number;
  watched_count: number;
  invalidated_count: number;
  skipped_tp1_rate: number;
  skipped_sl_rate: number;
  best_skipped_opportunities: PerformanceGroup[];
  worst_taken_trades: PerformanceGroup[];
  top_mistakes: Array<{ mistake_type: string; count: number; loss_r: number; win_rate: number }>;
  losses_by_mistake_type: Array<{ mistake_type: string; count: number; loss_r: number; win_rate: number }>;
  performance_curve: Array<{ date: string; equity: number }>;
  monthly_performance: PerformanceGroup[];
  session_performance: PerformanceGroup[];
  location_performance: PerformanceGroup[];
  poc_performance: PerformanceGroup[];
  strategy_performance: PerformanceGroup[];
  news_timing_performance: PerformanceGroup[];
  detailed_session_performance: PerformanceGroup[];
  data_quality?: DataQualityDashboard | null;
};

export type PerformanceGroup = {
  name: string;
  trades: number;
  win_rate: number;
  tp1_rate: number;
  sl_rate: number;
  expectancy: number;
  result_r: number;
};

export type AnalyzerRequest = {
  session: string;
  direction: string;
  bias_15m: string;
  market_state: string;
  regime_label: string | null;
  location: string;
  liquidity_sweep: string;
  choch: string;
  lh_hl: string;
  fvg_reaction: string;
  volume_state: string;
  trade_decision: string;
  distance_to_poc: number | null;
  distance_to_vah: number | null;
  distance_to_val: number | null;
  poc_risk_level: string;
  high_impact_news: string;
  news_timing: string;
  planned_rr: number | null;
};

export type AnalyzerResponse = {
  setup_score: number;
  trade_grade: string;
  base_score: number;
  historical_edge_score: number;
  market_regime_score: number;
  poc_risk_penalty: number;
  news_risk_penalty: number;
  data_confidence_adjustment: number;
  score_components: Array<{ label: string; points: number; reason: string }>;
  historical: {
    historical_win_rate: number;
    historical_tp1_rate: number;
    historical_be_rate: number;
    historical_sl_rate: number;
    average_rr: number;
    average_mfe: number;
    average_mae: number;
    max_losing_streak: number;
    sample_size: number;
  };
  tp1_probability: number;
  be_probability: number;
  sl_probability: number;
  confidence_level: string;
  sample_size: number;
  most_similar_trades: Array<{
    id: string;
    date: string;
    session: string;
    direction: string;
    location: string;
    trade_decision: string;
    result: string;
    result_r: number;
    mfe: number;
    mae: number;
    similarity_score: number;
  }>;
  poc_risk_level: string;
  poc_risk_message: string;
  historical_poc_sl_rate: number;
  average_r: number;
  best_management_rule: string | null;
  recommended_risk_level: string;
  explanation_notes: string[];
};

export type ManagementResponse = {
  enabled: boolean;
  assumptions: {
    partial_exit_percent: number;
    be_after_tp1: boolean;
    tp2_enabled: boolean;
    tp2_price: number | null;
  };
  baseline: { trades: number; eligible_trades: number };
  best_management_style: string | null;
  strategies: Array<{
    name: string;
    total_r: number;
    average_r: number;
    win_rate: number;
    max_drawdown: number;
    max_losing_streak: number;
    profit_factor: number;
    sample_size: number;
    warning: string | null;
  }>;
  regime_comparison?: RegimeManagementRow[];
};

export type RegimeManagementRow = {
  group_field: string;
  group_value: string;
  sample_size: number;
  best_rule: string | null;
  best_total_r: number;
  best_average_r: number;
  best_profit_factor: number;
  strategies: ManagementResponse["strategies"];
};

export type DataQualityDashboard = {
  total_records: number;
  taken_records: number;
  valid_taken_trades: number;
  good: number;
  incomplete: number;
  bad: number;
  missing_field_warnings: Array<{ field: string; count: number }>;
  trade_warnings: Array<{ trade_id: string; date: string; warnings: string[] }>;
};

export type MonteCarloResponse = {
  enabled: boolean;
  message: string;
  sample_size: number;
  simulations: number;
  account_size: number;
  risk_per_trade: number;
  risk_mode: "percent" | "dollars" | string;
  risk_amount: number;
  risk_percent: number;
  daily_loss_limit: number;
  account_drawdown_limit: number;
  max_drawdown: number;
  average_drawdown: number;
  worst_drawdown: number;
  drawdown_p95: number;
  longest_losing_streak: number;
  probability_daily_loss_limit: number;
  probability_account_drawdown_limit: number;
  risk_level: "safe" | "caution" | "dangerous" | string;
};

export type MlStatus = {
  enabled: boolean;
  minimum_required_trades: number;
  current_trades: number;
  message: string;
};

export type ScreenshotItem = {
  id: string;
  trade_id: string;
  date: string;
  session: string;
  direction: string;
  location: string;
  result: string;
  setup_score: number;
  strategy_version: string;
  market_state: string;
  choch: string;
  liquidity_sweep: string;
  fvg_reaction: string;
  trade_decision: string;
  regime_label: string;
  screenshot_path: string;
  screenshot_tags: string;
  screenshot_favorite: boolean;
  screenshot_bookmarked: boolean;
  screenshot_notes: string;
  lessons_learned: string;
  result_r: number;
};

export type EdgeDiscoveryResponse = {
  top_best_conditions: EdgeCondition[];
  top_worst_conditions: EdgeCondition[];
  highest_tp1_conditions: EdgeCondition[];
  highest_sl_conditions: EdgeCondition[];
  highest_rr_conditions: EdgeCondition[];
  most_consistent_conditions: EdgeCondition[];
};

export type EdgeCondition = {
  condition: string;
  sample_size: number;
  tp1_rate: number;
  sl_rate: number;
  average_rr: number;
  profit_factor: number;
  confidence: string;
};

export type MarketCandle = {
  id?: string;
  symbol: string;
  timeframe: string;
  timestamp: string;
  raw_timestamp?: string | null;
  source_row_index?: number | null;
  source_symbol?: string | null;
  source_filename?: string | null;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type MissingMarketRow = {
  symbol: string;
  timeframe: string;
  timestamp: string;
};

export type MarketSwing = {
  detected_id: string;
  timestamp: string;
  symbol: string;
  timeframe: string;
  kind: string;
  label: string;
  price: number;
  price_level: number;
  reason: string;
  candles_used: string[];
  confidence_score: number | null;
  structure_importance_score?: number | null;
  structure_importance_reason?: string | null;
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
};

export type MarketSwingMode = "strict" | "normal" | "aggressive";

export type MarketSwingConfig = {
  mode: MarketSwingMode;
  left_candles: number;
  right_candles: number;
  min_swing_distance: number;
};

export type MarketStructureNode = {
  detected_id: string;
  source_swing_id: string;
  timestamp: string;
  symbol: string;
  timeframe: string;
  side: string;
  structure_type: string;
  price: number;
  structure_state: string;
  leg_type: string;
  protected_level_role?: string | null;
  near_reference_levels: string[];
  later_swept: boolean;
  swept_by_event_id?: string | null;
  importance_score: number;
  reason: string;
  caused_bos?: boolean | null;
  caused_choch?: boolean | null;
  created_displacement?: boolean | null;
  displacement_score?: number | null;
  original_csv_row_index?: number | null;
  original_timestamp?: string | null;
  parsed_timestamp?: string | null;
  candle_open?: number | null;
  candle_high?: number | null;
  candle_low?: number | null;
  candle_close?: number | null;
  displayed_level?: number | null;
  level_source?: string | null;
};

export type MarketStructureSweep = {
  detected_id: string;
  timestamp: string;
  symbol: string;
  timeframe: string;
  direction: string;
  event_type: string;
  swept_node_id: string;
  swept_node_time: string;
  swept_node_type: string;
  swept_structure_type: string;
  swept_node_price: number;
  swept_node_state: string;
  pierce_distance: number;
  close_back_distance: number;
  importance_score: number;
  reason: string;
  candles_used: string[];
  original_csv_row_index?: number | null;
  original_timestamp?: string | null;
  parsed_timestamp?: string | null;
  candle_open?: number | null;
  candle_high?: number | null;
  candle_low?: number | null;
  candle_close?: number | null;
  displayed_level?: number | null;
  level_source?: string | null;
};

export type ReferenceLabelColumn = {
  source: string;
  label_type: string;
};

export type TradingViewReferenceLabel = {
  detected_id: string;
  timestamp: string;
  symbol: string;
  timeframe: string;
  label_type: string;
  label_value: string;
  price_level?: number | null;
  source_column: string;
  raw_value: string;
  original_csv_row_index?: number | null;
  original_timestamp?: string | null;
};

export type LabelComparisonMatch = {
  reference_label_id: string;
  market_detection_id: string;
  label_type: string;
  reference_timestamp: string;
  market_timestamp: string;
  reference_value: string;
  market_value: string;
  reference_price_level?: number | null;
  market_price_level?: number | null;
  source_column: string;
  market_source: string;
  timestamp_difference_seconds: number;
  price_difference?: number | null;
  status: string;
};

export type LabelComparisonMissed = {
  reference_label_id: string;
  timestamp: string;
  label_type: string;
  label_value: string;
  price_level?: number | null;
  source_column: string;
  status: string;
};

export type LabelComparisonExtra = {
  market_detection_id: string;
  timestamp: string;
  label_type: string;
  label_value: string;
  price_level?: number | null;
  market_source: string;
  status: string;
};

export type LabelComparison = {
  matches: LabelComparisonMatch[];
  missed_tradingview_labels: LabelComparisonMissed[];
  extra_market_lab_detections: LabelComparisonExtra[];
  metrics: {
    structure_match_rate: number;
    sweep_liquidity_grab_match_rate: number;
    bos_choch_match_rate: number;
  };
};

export type MismatchExample = {
  status: string;
  label_type: string;
  reference_timestamp?: string | null;
  market_timestamp?: string | null;
  reference_price_level?: number | null;
  market_price_level?: number | null;
  timestamp_difference_seconds?: number | null;
  price_difference?: number | null;
  source_column?: string | null;
  market_source?: string | null;
  reference_row?: number | null;
  market_row?: number | null;
  likely_cause: string;
  evidence: string;
  recommended_change: string;
  severity_score: number;
};

export type MismatchAnalysis = {
  top_examples: MismatchExample[];
  likely_causes: Array<{ cause: string; count: number; evidence: string }>;
  recommended_detector_changes: string[];
};

export type StructureSweepConfig = {
  min_node_importance: number;
  max_age_minutes?: number | null;
  min_pierce_size: number;
};

export type LiquidityEvent = {
  detected_id: string;
  timestamp: string;
  symbol: string;
  timeframe: string;
  session: string;
  event_type: string;
  source: string;
  level: number;
  price: number;
  price_level: number;
  reason: string;
  candles_used: string[];
  confidence_score: number | null;
  original_csv_row_index?: number | null;
  original_timestamp?: string | null;
  parsed_timestamp?: string | null;
  candle_open?: number | null;
  candle_high?: number | null;
  candle_low?: number | null;
  candle_close?: number | null;
  displayed_level?: number | null;
  level_source?: string | null;
  swept_level_type?: string | null;
  swept_structure_node_id?: string | null;
  swept_structure_node?: string | null;
  swept_timeframe?: string | null;
  sweep_importance_score?: number | null;
  sweep_importance_reason?: string | null;
};

export type FvgEvent = {
  detected_id: string;
  timestamp: string;
  symbol: string;
  timeframe: string;
  fvg_type: string;
  lower_bound: number;
  upper_bound: number;
  gap_size: number;
  returned: boolean;
  price_level: number;
  reason: string;
  candles_used: string[];
  confidence_score: number | null;
  original_csv_row_index?: number | null;
  original_timestamp?: string | null;
  parsed_timestamp?: string | null;
  candle_open?: number | null;
  candle_high?: number | null;
  candle_low?: number | null;
  candle_close?: number | null;
  displayed_level?: number | null;
  level_source?: string | null;
};

export type SetupCandidate = {
  detected_id: string;
  timestamp: string;
  symbol: string;
  timeframe: string;
  direction: string;
  setup_type: string;
  confidence_score: number;
  reasons: string[] | string;
  price_level: number;
  reason: string;
  candles_used: string[];
  original_csv_row_index?: number | null;
  original_timestamp?: string | null;
  parsed_timestamp?: string | null;
  candle_open?: number | null;
  candle_high?: number | null;
  candle_low?: number | null;
  candle_close?: number | null;
  displayed_level?: number | null;
  level_source?: string | null;
};

export type MarketImportSummary = {
  raw_rows: number;
  valid_rows: number;
  inserted_rows: number;
  duplicate_rows: number;
  missing_rows: number;
  missing_timestamps: MissingMarketRow[];
  first_candle: string | null;
  last_candle: string | null;
  first_raw_timestamp?: string | null;
  last_raw_timestamp?: string | null;
  source_filename?: string | null;
  detected_symbol?: string | null;
  timeframe_consistent: boolean;
  expected_timeframe_minutes: number | null;
  column_mapping?: MarketCsvColumnMapping[];
  reference_label_columns?: ReferenceLabelColumn[];
  reference_labels?: TradingViewReferenceLabel[];
  warnings?: string[];
  ignored_columns?: string[];
};

export type MarketCsvColumnMapping = {
  source: string;
  target: "timestamp" | "open" | "high" | "low" | "close" | "volume";
};

export type MarketCsvColumnPreview = {
  row_count: number;
  column_mapping: MarketCsvColumnMapping[];
  reference_label_columns: ReferenceLabelColumn[];
  missing_required: string[];
  warnings: string[];
  ignored_columns: string[];
  can_import: boolean;
};

export type FreeDataMetadata = {
  provider: string;
  requested_symbol: string;
  source_symbol: string;
  timeframe: string;
  yahoo_interval: string;
  range: string;
  cached: boolean;
  cache_path: string;
  downloaded_at: string;
  last_candle?: string | null;
  delay_warning: string;
};

export type MarketLabSummary = {
  candle_count: number;
  duplicate_rows: number;
  missing_rows: number;
  missing_timestamps: MissingMarketRow[];
  first_candle: string | null;
  last_candle: string | null;
  first_raw_timestamp?: string | null;
  last_raw_timestamp?: string | null;
  source_filename?: string | null;
  detected_symbol?: string | null;
  timeframe_consistent: boolean;
  expected_timeframe_minutes: number | null;
  session_counts: Record<string, number>;
  swings: MarketSwing[];
  swings_v2: MarketSwing[];
  swings_v1_count: number;
  swings_v2_count: number;
  structure_sequence: MarketStructureNode[];
  protected_structure: MarketStructureNode[];
  protected_structure_count: number;
  structure_sweeps: MarketStructureSweep[];
  reference_labels: TradingViewReferenceLabel[];
  label_comparison: LabelComparison;
  mismatch_analysis: MismatchAnalysis;
  structure_sweep_config: StructureSweepConfig;
  swing_config: MarketSwingConfig;
  liquidity_events: LiquidityEvent[];
  fvgs: FvgEvent[];
  setup_candidates: SetupCandidate[];
  import_summary: MarketImportSummary | null;
  free_data: FreeDataMetadata | null;
};

export type DetectorFeedbackValue = "Correct" | "Wrong" | "Unsure";

export type DetectorFeedback = {
  detector_type: "swing" | "structure" | "structure_sweep" | "sweep" | "fvg" | "setup_candidate" | "reference_label";
  detected_id: string;
  user_feedback: DetectorFeedbackValue;
  notes: string;
  timestamp: string;
};

export type ResearchSummary = {
  review: {
    top_mistakes: Array<{ mistake_type: string; count: number; frequency: number; loss_r: number; win_rate: number }>;
    most_expensive_mistakes: Array<{ mistake_type: string; count: number; frequency: number; loss_r: number; win_rate: number }>;
  };
  scores: {
    daily: Array<Record<string, number | string>>;
    weekly: Array<Record<string, number | string>>;
    monthly: Array<Record<string, number | string>>;
  };
  marketContext: Record<string, PerformanceGroup[]>;
  news: Record<string, unknown>;
  strategies: { versions: PerformanceGroup[]; performance_evolution: PerformanceGroup[] };
  sessions: { sessions: PerformanceGroup[]; best_session: PerformanceGroup | null; worst_session: PerformanceGroup | null; most_consistent_session: PerformanceGroup | null };
  edge: EdgeDiscoveryResponse;
};
