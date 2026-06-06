export const DATA_TYPES = ["Backtest", "Replay", "Paper", "Live"] as const;
export const SESSIONS = [
  "Asian",
  "London",
  "NY_AM",
  "NY_PM",
  "NY_Open",
  "NY_Power_Hour",
  "NY_Lunch",
  "Asian_Early",
  "Asian_Late",
  "London_Open",
  "London_Mid"
] as const;
export const DIRECTIONS = ["Long", "Short"] as const;
export const BIASES = ["Long", "Short", "Neutral", "Mixed"] as const;
export const MARKET_STATES = ["Balanced", "Imbalanced"] as const;
export const REGIME_LABELS = ["Trend Up", "Trend Down", "Balanced", "Expansion", "Choppy", "News Driven", "POC Chop"] as const;
export const LOCATIONS = ["VAH", "VAL", "POC", "PDH", "PDL", "EQH", "EQL", "Other"] as const;
export const YES_NO = ["Yes", "No"] as const;
export const SWEEP_TIMEFRAMES = ["None", "1m", "5m", "15m", "PDH/PDL", "Session High/Low"] as const;
export const CHOCH_TIMEFRAMES = ["None", "1m", "5m", "15m"] as const;
export const ENTRY_PULLBACK_STRUCTURES = ["None", "HL for Long", "LH for Short", "Failed HL", "Failed LH"] as const;
export const FVG_REACTIONS = ["Strong", "Medium", "Weak", "None"] as const;
export const VOLUME_STATES = ["Low", "Normal", "High"] as const;
export const RESULTS = ["TP1", "BE", "SL", "NoTrade", "Unknown"] as const;
export const INSTRUMENTS = ["NQ", "MNQ", "ES", "MES", "GC"] as const;
export const TRADE_DECISIONS = ["Taken", "Skipped", "Watched", "Invalidated"] as const;
export const SKIP_REASONS = [
  "Near POC",
  "Weak CHOCH",
  "No Clear FVG",
  "Poor RR",
  "Against 15m Bias",
  "News Risk",
  "Too Late",
  "Too Early",
  "Emotional Reason",
  "Other"
] as const;
export const POC_RISK_LEVELS = ["Low", "Medium", "High", "Unknown"] as const;
export const MANUAL_QUALITIES = ["", "A+", "A", "B", "C", "Skip"] as const;
export const SETUP_TYPES = [
  "",
  "Fabio Long",
  "Fabio Short",
  "Sweep Reversal Long",
  "Sweep Reversal Short",
  "Direct Delivery Long",
  "Direct Delivery Short",
  "POC Rejection",
  "Breakout Continuation",
  "News Trade",
  "Other"
] as const;
export const SCREENSHOT_TAGS = [
  "Winner",
  "Loser",
  "A+",
  "A",
  "B",
  "C",
  "POC",
  "VAH",
  "VAL",
  "PDH",
  "PDL",
  "Sweep",
  "CHOCH",
  "FVG",
  "NY Open",
  "NY PM",
  "Asian",
  "London"
] as const;
export const FOLLOWED_PLAN_VALUES = ["Yes", "Partially", "No"] as const;
export const MISTAKE_TYPES = [
  "None",
  "Early Entry",
  "Late Entry",
  "FOMO",
  "No Stop",
  "Moved Stop",
  "Ignored Bias",
  "Ignored Risk",
  "Overtrading",
  "Revenge Trading",
  "Emotional Trade",
  "Other"
] as const;
export const BIAS_VALUES = ["Bullish", "Bearish", "Neutral"] as const;
export const NEWS_TYPES = ["CPI", "FOMC", "NFP", "PCE", "GDP", "Retail Sales", "Jobless Claims", "Other"] as const;
export const NEWS_TIMINGS = ["Before News", "During News", "After News", "No News"] as const;
