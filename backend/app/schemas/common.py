from enum import StrEnum


class DataType(StrEnum):
    backtest = "Backtest"
    replay = "Replay"
    paper = "Paper"
    live = "Live"


class SessionName(StrEnum):
    asian = "Asian"
    london = "London"
    ny_am = "NY_AM"
    ny_pm = "NY_PM"
    ny_open = "NY_Open"
    ny_power_hour = "NY_Power_Hour"
    ny_lunch = "NY_Lunch"
    asian_early = "Asian_Early"
    asian_late = "Asian_Late"
    london_open = "London_Open"
    london_mid = "London_Mid"


class Direction(StrEnum):
    long = "Long"
    short = "Short"


class MarketState(StrEnum):
    balanced = "Balanced"
    imbalanced = "Imbalanced"


class RegimeLabel(StrEnum):
    trend_up = "Trend Up"
    trend_down = "Trend Down"
    balanced = "Balanced"
    expansion = "Expansion"
    choppy = "Choppy"
    news_driven = "News Driven"
    poc_chop = "POC Chop"


class Location(StrEnum):
    vah = "VAH"
    val = "VAL"
    poc = "POC"
    pdh = "PDH"
    pdl = "PDL"
    eqh = "EQH"
    eql = "EQL"
    other = "Other"


class YesNo(StrEnum):
    yes = "Yes"
    no = "No"


class SweepTimeframe(StrEnum):
    none = "None"
    one_minute = "1m"
    five_minute = "5m"
    fifteen_minute = "15m"
    pdh_pdl = "PDH/PDL"
    session_high_low = "Session High/Low"
    legacy_yes = "Yes"
    legacy_no = "No"


class ChochTimeframe(StrEnum):
    none = "None"
    one_minute = "1m"
    five_minute = "5m"
    fifteen_minute = "15m"
    legacy_yes = "Yes"
    legacy_no = "No"


class EntryPullbackStructure(StrEnum):
    none = "None"
    hl_for_long = "HL for Long"
    lh_for_short = "LH for Short"
    failed_hl = "Failed HL"
    failed_lh = "Failed LH"
    legacy_yes = "Yes"
    legacy_no = "No"


class FvgReaction(StrEnum):
    strong = "Strong"
    medium = "Medium"
    weak = "Weak"
    none = "None"


class VolumeState(StrEnum):
    low = "Low"
    normal = "Normal"
    high = "High"


class Result(StrEnum):
    tp1 = "TP1"
    be = "BE"
    sl = "SL"
    no_trade = "NoTrade"
    unknown = "Unknown"


class Instrument(StrEnum):
    nq = "NQ"
    mnq = "MNQ"
    es = "ES"
    mes = "MES"
    gc = "GC"


class TradeDecision(StrEnum):
    taken = "Taken"
    skipped = "Skipped"
    watched = "Watched"
    invalidated = "Invalidated"


class SkipReason(StrEnum):
    near_poc = "Near POC"
    weak_choch = "Weak CHOCH"
    no_clear_fvg = "No Clear FVG"
    poor_rr = "Poor RR"
    against_15m_bias = "Against 15m Bias"
    news_risk = "News Risk"
    too_late = "Too Late"
    too_early = "Too Early"
    emotional_reason = "Emotional Reason"
    other = "Other"


class PocRiskLevel(StrEnum):
    low = "Low"
    medium = "Medium"
    high = "High"
    unknown = "Unknown"


class FollowedPlan(StrEnum):
    yes = "Yes"
    partially = "Partially"
    no = "No"


class MistakeType(StrEnum):
    none = "None"
    early_entry = "Early Entry"
    late_entry = "Late Entry"
    fomo = "FOMO"
    no_stop = "No Stop"
    moved_stop = "Moved Stop"
    ignored_bias = "Ignored Bias"
    ignored_risk = "Ignored Risk"
    overtrading = "Overtrading"
    revenge_trading = "Revenge Trading"
    emotional_trade = "Emotional Trade"
    other = "Other"


class BiasValue(StrEnum):
    bullish = "Bullish"
    bearish = "Bearish"
    neutral = "Neutral"


class NewsType(StrEnum):
    cpi = "CPI"
    fomc = "FOMC"
    nfp = "NFP"
    pce = "PCE"
    gdp = "GDP"
    retail_sales = "Retail Sales"
    jobless_claims = "Jobless Claims"
    other = "Other"


class NewsTiming(StrEnum):
    before_news = "Before News"
    during_news = "During News"
    after_news = "After News"
    no_news = "No News"


class DataQuality(StrEnum):
    good = "good"
    incomplete = "incomplete"
    bad = "bad"


class ReviewStatus(StrEnum):
    unreviewed = "unreviewed"
    reviewed = "reviewed"


class ManualQuality(StrEnum):
    a_plus = "A+"
    a = "A"
    b = "B"
    c = "C"
    skip = "Skip"


class SetupType(StrEnum):
    fabio_long = "Fabio Long"
    fabio_short = "Fabio Short"
    sweep_reversal_long = "Sweep Reversal Long"
    sweep_reversal_short = "Sweep Reversal Short"
    direct_delivery_long = "Direct Delivery Long"
    direct_delivery_short = "Direct Delivery Short"
    poc_rejection = "POC Rejection"
    breakout_continuation = "Breakout Continuation"
    news_trade = "News Trade"
    other = "Other"
