GOOD_RESULT_RS = [
    2.0,
    -1.0,
    1.5,
    0.0,
    -1.0,
    2.5,
    1.0,
    -1.0,
    0.5,
    1.8,
    -1.0,
    0.0,
    2.2,
    1.2,
    -1.0,
    0.8,
    1.7,
    -1.0,
    0.4,
    2.0,
]

SESSIONS = [
    "NY_Open",
    "NY_Open",
    "NY_Open",
    "NY_Open",
    "NY_Open",
    "NY_Open",
    "London_Open",
    "London_Open",
    "London_Open",
    "London_Open",
    "NY_PM",
    "NY_PM",
    "NY_PM",
    "NY_PM",
    "Asian_Early",
    "Asian_Early",
    "Asian_Early",
    "NY_Lunch",
    "NY_Lunch",
    "NY_Lunch",
]
LOCATIONS = ["VAH", "POC", "VAL", "Other", "PDH", "POC", "VAH", "VAL", "Other", "PDL"] * 2


def _base(index):
    result_r = GOOD_RESULT_RS[index]
    result = "TP1" if result_r > 0 else "BE" if result_r == 0 else "SL"
    location = LOCATIONS[index]
    return {
        "id": f"good-{index + 1:02d}",
        "date": f"2026-01-{index + 1:02d}",
        "instrument": "NQ",
        "data_type": "Backtest",
        "session": SESSIONS[index],
        "direction": "Long" if index % 2 == 0 else "Short",
        "bias_15m": "Long" if index % 2 == 0 else "Short",
        "market_state": "Imbalanced" if index < 10 else "Balanced",
        "location": location,
        "liquidity_sweep": "Yes" if index % 3 != 0 else "No",
        "choch": "Yes",
        "lh_hl": "Yes",
        "fvg_reaction": "Strong" if index % 4 != 0 else "Medium",
        "volume_state": "Normal",
        "strategy_version": "Fabio_V1" if index < 10 else "Fabio_V2",
        "trade_decision": "Taken",
        "entry_price": 100,
        "stop_loss": 90,
        "tp1_price": 110,
        "tp2_price": 120,
        "result": result,
        "result_r": result_r,
        "mfe": 2.2 if result == "TP1" else 1.0 if result == "BE" else 0.3,
        "mae": -0.2 if result != "SL" else -1.0,
        "poc_risk_level": "High" if location == "POC" else "Medium" if location == "Other" else "Low",
        "news_timing": ["No News", "Before News", "During News", "After News"][index % 4],
        "mistake_type": "None",
        "daily_bias": "Bullish" if index % 2 == 0 else "Bearish",
    }


GOOD_TAKEN_TRADES = [_base(index) for index in range(20)]

INCOMPLETE_TAKEN_TRADES = [
    {**_base(0), "id": "incomplete-taken-entry", "entry_price": None, "date": "2026-02-01"},
    {**_base(1), "id": "incomplete-taken-stop", "stop_loss": None, "date": "2026-02-02"},
    {**_base(2), "id": "incomplete-taken-result", "result": None, "date": "2026-02-03"},
    {**_base(3), "id": "incomplete-taken-bias", "bias_15m": "", "date": "2026-02-04"},
]

NON_TAKEN_TRADES = [
    {**_base(4), "id": "skipped-01", "trade_decision": "Skipped", "date": "2026-02-05", "skip_reason": "Near POC"},
    {**_base(5), "id": "watched-01", "trade_decision": "Watched", "date": "2026-02-06"},
    {**_base(6), "id": "invalidated-01", "trade_decision": "Invalidated", "date": "2026-02-07"},
]

BAD_TAKEN_TRADES = [
    {**_base(7), "id": "bad-result", "result": "NoTrade", "date": "2026-02-08"},
    {**_base(8), "id": "bad-entry-stop", "entry_price": 100, "stop_loss": 100, "date": "2026-02-09"},
    {**_base(10), "id": "bad-sl-positive-r", "result": "SL", "result_r": 1.0, "date": "2026-02-10"},
]

SAMPLE_TRADES_30 = GOOD_TAKEN_TRADES + INCOMPLETE_TAKEN_TRADES + NON_TAKEN_TRADES + BAD_TAKEN_TRADES

EXPECTED_SAMPLE_OUTPUTS = {
    "data_quality": {
        "total_records": 30,
        "taken_records": 27,
        "valid_taken_trades": 20,
        "good": 20,
        "incomplete": 7,
        "bad": 3,
    },
    "analytics": {
        "total_trades": 20,
        "win_rate": 60.0,
        "average_r": 0.58,
        "profit_factor": 2.93,
        "max_losing_streak": 1,
        "final_equity_r": 11.6,
    },
    "management": {
        "eligible_trades": 20,
        "best_rule": "TP1 partial exit then hold TP2",
        "best_total_r": 13.0,
        "best_average_r": 0.65,
        "best_profit_factor": 3.17,
        "best_max_drawdown": -1.0,
        "ny_open_sample": 6,
        "ny_open_best_rule": "TP1 partial exit then hold TP2",
        "ny_open_best_total_r": 3.0,
    },
    "risk": {
        "account_size": 50000,
        "risk_amount": 250.0,
        "sample_size": 20,
        "max_drawdown": 1950.0,
        "average_drawdown": 629.45,
        "worst_drawdown": 1950.0,
        "drawdown_p95": 1250.0,
        "longest_losing_streak": 6,
        "probability_daily_loss_limit": 0.0,
        "probability_account_drawdown_limit": 0.0,
        "risk_level": "safe",
    },
}
