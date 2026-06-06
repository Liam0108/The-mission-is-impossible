import type { Dashboard, Trade } from "@/lib/types";

export const emptyDashboard: Dashboard = {
  total_trades: 0,
  win_rate: 0,
  tp1_rate: 0,
  be_rate: 0,
  sl_rate: 0,
  average_rr: 0,
  profit_factor: 0,
  expectancy: 0,
  max_winning_streak: 0,
  max_losing_streak: 0,
  average_mfe: 0,
  average_mae: 0,
  taken_count: 0,
  skipped_count: 0,
  watched_count: 0,
  invalidated_count: 0,
  skipped_tp1_rate: 0,
  skipped_sl_rate: 0,
  best_skipped_opportunities: [],
  worst_taken_trades: [],
  top_mistakes: [],
  losses_by_mistake_type: [],
  performance_curve: [],
  monthly_performance: [],
  session_performance: [],
  location_performance: [],
  poc_performance: [],
  strategy_performance: [],
  news_timing_performance: [],
  detailed_session_performance: []
};

export const demoTrades: Trade[] = [];
