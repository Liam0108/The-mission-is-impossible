DATA_TYPES = ("Backtest", "Replay", "Paper", "Live")
SESSIONS = (
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
    "London_Mid",
)
DIRECTIONS = ("Long", "Short")
MARKET_STATES = ("Balanced", "Imbalanced")
REGIME_LABELS = ("Trend Up", "Trend Down", "Balanced", "Expansion", "Choppy", "News Driven", "POC Chop")
LOCATIONS = ("VAH", "VAL", "POC", "PDH", "PDL", "EQH", "EQL", "Other")
YES_NO = ("Yes", "No")
SWEEP_TIMEFRAMES = ("None", "1m", "5m", "15m", "PDH/PDL", "Session High/Low", "Yes", "No")
CHOCH_TIMEFRAMES = ("None", "1m", "5m", "15m", "Yes", "No")
ENTRY_PULLBACK_STRUCTURES = ("None", "HL for Long", "LH for Short", "Failed HL", "Failed LH", "Yes", "No")
FVG_REACTIONS = ("Strong", "Medium", "Weak", "None")
VOLUME_STATES = ("Low", "Normal", "High")
INSTRUMENTS = ("NQ", "MNQ", "ES", "MES", "GC")
TRADE_DECISIONS = ("Taken", "Skipped", "Watched", "Invalidated")
SKIP_REASONS = (
    "Near POC",
    "Weak CHOCH",
    "No Clear FVG",
    "Poor RR",
    "Against 15m Bias",
    "News Risk",
    "Too Late",
    "Too Early",
    "Emotional Reason",
    "Other",
)
POC_RISK_LEVELS = ("Low", "Medium", "High", "Unknown")
RESULTS = ("TP1", "BE", "SL", "NoTrade", "Unknown")
SCREENSHOT_TAGS = (
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
    "London",
)
FOLLOWED_PLAN_VALUES = ("Yes", "Partially", "No")
MISTAKE_TYPES = (
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
    "Other",
)
BIAS_VALUES = ("Bullish", "Bearish", "Neutral")
NEWS_TYPES = ("CPI", "FOMC", "NFP", "PCE", "GDP", "Retail Sales", "Jobless Claims", "Other")
NEWS_TIMINGS = ("Before News", "During News", "After News", "No News")
DATA_QUALITY_VALUES = ("good", "incomplete", "bad")
MANUAL_QUALITIES = ("A+", "A", "B", "C", "Skip")
REVIEW_STATUSES = ("unreviewed", "reviewed")
SETUP_TYPES = (
    "Fabio Long",
    "Fabio Short",
    "Sweep Reversal Long",
    "Sweep Reversal Short",
    "Direct Delivery Long",
    "Direct Delivery Short",
    "POC Rejection",
    "Breakout Continuation",
    "News Trade",
    "Other",
)

MIN_ML_TRADES = 300
