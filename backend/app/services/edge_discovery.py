from collections import defaultdict
from itertools import combinations
from typing import Any

from app.services.normalization import as_float, as_str, value_of

EDGE_FIELDS = (
    "session",
    "location",
    "liquidity_sweep",
    "choch",
    "fvg_reaction",
    "volume_state",
    "bias_alignment",
    "market_state",
    "regime_label",
    "trade_decision",
    "strategy_version",
)


def _rate(count: int, total: int) -> float:
    return round((count / total) * 100, 1) if total else 0.0


def _profit_factor(trades: list[Any]) -> float:
    gross_profit = sum(max(as_float(value_of(trade, "result_r")), 0) for trade in trades)
    gross_loss = abs(sum(min(as_float(value_of(trade, "result_r")), 0) for trade in trades))
    return round(gross_profit / gross_loss, 2) if gross_loss else round(gross_profit, 2)


def _confidence(sample_size: int) -> str:
    if sample_size >= 50:
        return "High"
    if sample_size >= 20:
        return "Medium"
    return "Low"


def _bias_alignment(trade: Any) -> str:
    direction = as_str(value_of(trade, "direction"))
    daily_bias = as_str(value_of(trade, "daily_bias", "Neutral"))
    if daily_bias == "Neutral":
        return "Neutral"
    if (direction == "Long" and daily_bias == "Bullish") or (direction == "Short" and daily_bias == "Bearish"):
        return "With Bias"
    return "Against Bias"


def _field_value(trade: Any, field: str) -> str:
    if field == "bias_alignment":
        return _bias_alignment(trade)
    return as_str(value_of(trade, field)) or "Unknown"


def _summarize(condition: str, trades: list[Any]) -> dict[str, Any]:
    count = len(trades)
    result_rs = [as_float(value_of(trade, "result_r")) for trade in trades]
    tp1 = sum(1 for trade in trades if as_str(value_of(trade, "result")) == "TP1")
    sl = sum(1 for trade in trades if as_str(value_of(trade, "result")) == "SL")
    return {
        "condition": condition,
        "sample_size": count,
        "tp1_rate": _rate(tp1, count),
        "sl_rate": _rate(sl, count),
        "average_rr": round(sum(result_rs) / count, 2) if count else 0.0,
        "profit_factor": _profit_factor(trades),
        "confidence": _confidence(count),
    }


def discover_edges(trades: list[Any], min_sample: int = 3) -> dict[str, Any]:
    groups: dict[str, list[Any]] = defaultdict(list)
    for trade in trades:
        for size in (1, 2, 3):
            for fields in combinations(EDGE_FIELDS, size):
                parts = [f"{field}:{_field_value(trade, field)}" for field in fields]
                groups[" | ".join(parts)].append(trade)

    rows = [_summarize(condition, group) for condition, group in groups.items() if len(group) >= min_sample]
    return {
        "top_best_conditions": sorted(rows, key=lambda row: (row["average_rr"], row["tp1_rate"]), reverse=True)[:10],
        "top_worst_conditions": sorted(rows, key=lambda row: (row["average_rr"], -row["sl_rate"]))[:10],
        "highest_tp1_conditions": sorted(rows, key=lambda row: row["tp1_rate"], reverse=True)[:10],
        "highest_sl_conditions": sorted(rows, key=lambda row: row["sl_rate"], reverse=True)[:10],
        "highest_rr_conditions": sorted(rows, key=lambda row: row["average_rr"], reverse=True)[:10],
        "most_consistent_conditions": sorted(rows, key=lambda row: (row["profit_factor"], row["sample_size"]), reverse=True)[:10],
    }
