from typing import Any

from app.services.normalization import as_float, as_str, plain, value_of

SIMILARITY_FIELDS = (
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
    "trade_decision",
)
SIMILARITY_WEIGHTS = {
    "session": 15,
    "direction": 10,
    "bias_15m": 15,
    "market_state": 10,
    "regime_label": 10,
    "location": 20,
    "liquidity_sweep": 15,
    "choch": 15,
    "lh_hl": 10,
    "fvg_reaction": 15,
    "volume_state": 5,
    "trade_decision": 5,
}
MAX_SIMILARITY_POINTS = sum(SIMILARITY_WEIGHTS.values())


def similarity_score(setup: Any, trade: Any) -> int:
    raw_score = 0
    for field in SIMILARITY_FIELDS:
        setup_value = as_str(value_of(setup, field))
        trade_value = as_str(value_of(trade, field))
        if setup_value and trade_value and setup_value == trade_value:
            raw_score += SIMILARITY_WEIGHTS[field]
    return int(round((raw_score / MAX_SIMILARITY_POINTS) * 100))


def confidence_for_sample(sample_size: int) -> str:
    if sample_size >= 30:
        return "High"
    if sample_size >= 10:
        return "Medium"
    return "Low"


def _max_losing_streak(trades: list[Any]) -> int:
    streak = 0
    best = 0
    ordered = sorted(trades, key=lambda trade: as_str(plain(value_of(trade, "date"))))
    for trade in ordered:
        if as_float(value_of(trade, "result_r")) < 0 or as_str(value_of(trade, "result")) == "SL":
            streak += 1
            best = max(best, streak)
        else:
            streak = 0
    return best


def search_similar_setups(setup: Any, trades: list[Any], limit: int = 20, minimum_similarity: int = 50) -> dict[str, Any]:
    scored = [(trade, similarity_score(setup, trade)) for trade in trades]
    selected = [item for item in scored if item[1] >= minimum_similarity]
    selected.sort(key=lambda item: item[1], reverse=True)

    decisive = [trade for trade, _score in selected if as_str(value_of(trade, "result")) in {"TP1", "BE", "SL"}]
    outcome_sample_size = len(decisive)
    historical_sample_size = len(selected)
    counts = {
        "TP1": sum(1 for trade in decisive if as_str(value_of(trade, "result")) == "TP1"),
        "BE": sum(1 for trade in decisive if as_str(value_of(trade, "result")) == "BE"),
        "SL": sum(1 for trade in decisive if as_str(value_of(trade, "result")) == "SL"),
    }

    def pct(count: int) -> float:
        return round((count / outcome_sample_size) * 100, 1) if outcome_sample_size else 0.0

    avg_rr = round(sum(as_float(value_of(trade, "result_r")) for trade in decisive) / outcome_sample_size, 2) if outcome_sample_size else 0.0
    avg_mfe = round(sum(as_float(value_of(trade, "mfe")) for trade, _score in selected) / historical_sample_size, 2) if historical_sample_size else 0.0
    avg_mae = round(sum(as_float(value_of(trade, "mae")) for trade, _score in selected) / historical_sample_size, 2) if historical_sample_size else 0.0
    similar_rows = []
    for trade, score in selected[:limit]:
        similar_rows.append(
            {
                "id": as_str(value_of(trade, "id")),
                "date": as_str(plain(value_of(trade, "date"))),
                "session": as_str(value_of(trade, "session")),
                "direction": as_str(value_of(trade, "direction")),
                "location": as_str(value_of(trade, "location")),
                "trade_decision": as_str(value_of(trade, "trade_decision", "Taken")),
                "result": as_str(value_of(trade, "result")),
                "result_r": as_float(value_of(trade, "result_r")),
                "mfe": as_float(value_of(trade, "mfe")),
                "mae": as_float(value_of(trade, "mae")),
                "similarity_score": score,
            }
        )

    return {
        "historical": {
            "historical_win_rate": pct(counts["TP1"]),
            "historical_tp1_rate": pct(counts["TP1"]),
            "historical_be_rate": pct(counts["BE"]),
            "historical_sl_rate": pct(counts["SL"]),
            "average_rr": avg_rr,
            "average_mfe": avg_mfe,
            "average_mae": avg_mae,
            "max_losing_streak": _max_losing_streak(decisive),
            "sample_size": historical_sample_size,
        },
        "tp1_probability": pct(counts["TP1"]),
        "be_probability": pct(counts["BE"]),
        "sl_probability": pct(counts["SL"]),
        "confidence_level": confidence_for_sample(historical_sample_size),
        "sample_size": historical_sample_size,
        "most_similar_trades": similar_rows,
    }


def calculate_historical_probabilities(setup: Any, trades: list[Any]) -> dict[str, Any]:
    return search_similar_setups(setup, trades)
