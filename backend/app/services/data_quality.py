from collections import Counter, defaultdict
from typing import Any

from app.services.normalization import as_float, as_str, value_of

REQUIRED_TAKEN_FIELDS: tuple[tuple[str, str], ...] = (
    ("entry_price", "entry"),
    ("stop_loss", "stop"),
    ("result", "result"),
    ("result_r", "result_r"),
    ("direction", "direction"),
    ("session", "session"),
    ("location", "location"),
    ("bias_15m", "15m_bias"),
    ("liquidity_sweep", "sweep"),
    ("choch", "choch"),
    ("fvg_reaction", "fvg"),
)
REQUIRED_IMPORTED_REVIEW_FIELDS: tuple[tuple[str, str], ...] = (
    ("setup_type", "setup_type"),
    ("manual_quality", "manual_quality"),
)
DECISIVE_RESULTS = {"TP1", "BE", "SL"}


def missing_required_fields(trade: Any) -> list[str]:
    missing = []
    required_fields = REQUIRED_TAKEN_FIELDS
    if bool(value_of(trade, "imported", False)):
        required_fields += REQUIRED_IMPORTED_REVIEW_FIELDS
    for field, label in required_fields:
        value = value_of(trade, field)
        if value is None or as_str(value).strip() == "":
            missing.append(label)
    return missing


def classify_trade_quality(trade: Any) -> dict[str, Any]:
    if as_str(value_of(trade, "trade_decision", "Taken")) != "Taken":
        return {"data_quality": "incomplete", "missing_fields": []}

    missing = missing_required_fields(trade)
    result = as_str(value_of(trade, "result"))
    entry = value_of(trade, "entry_price")
    stop = value_of(trade, "stop_loss")
    result_r = value_of(trade, "result_r")

    hard_errors = []
    if result and result not in DECISIVE_RESULTS:
        hard_errors.append("result must be TP1, BE, or SL")
    if entry is not None and stop is not None and as_float(entry) == as_float(stop):
        hard_errors.append("entry and stop cannot be equal")
    if result_r is not None and result == "SL" and as_float(result_r) >= 0:
        hard_errors.append("SL result_r should be negative")
    if result_r is not None and result == "TP1" and as_float(result_r) <= 0:
        hard_errors.append("TP1 result_r should be positive")

    if hard_errors:
        return {"data_quality": "bad", "missing_fields": missing, "warnings": hard_errors}
    if missing:
        return {"data_quality": "incomplete", "missing_fields": missing, "warnings": []}
    return {"data_quality": "good", "missing_fields": [], "warnings": []}


def data_quality_for_trade(trade: Any) -> str:
    return classify_trade_quality(trade)["data_quality"]


def is_valid_taken_trade(trade: Any) -> bool:
    return (
        as_str(value_of(trade, "trade_decision", "Taken")) == "Taken"
        and data_quality_for_trade(trade) == "good"
    )


def valid_taken_trades(trades: list[Any]) -> list[Any]:
    return [trade for trade in trades if is_valid_taken_trade(trade)]


def data_quality_dashboard(trades: list[Any]) -> dict[str, Any]:
    counts = Counter({"good": 0, "incomplete": 0, "bad": 0})
    missing_counts: dict[str, int] = defaultdict(int)
    warnings = []

    for trade in trades:
        quality = classify_trade_quality(trade)
        counts[quality["data_quality"]] += 1
        for field in quality["missing_fields"]:
            missing_counts[field] += 1
        if quality.get("warnings"):
            warnings.append(
                {
                    "trade_id": as_str(value_of(trade, "id")),
                    "date": as_str(value_of(trade, "date")),
                    "warnings": quality["warnings"],
                }
            )

    taken = [trade for trade in trades if as_str(value_of(trade, "trade_decision", "Taken")) == "Taken"]
    valid = valid_taken_trades(trades)
    return {
        "total_records": len(trades),
        "taken_records": len(taken),
        "valid_taken_trades": len(valid),
        "good": counts["good"],
        "incomplete": counts["incomplete"],
        "bad": counts["bad"],
        "missing_field_warnings": [
            {"field": field, "count": count}
            for field, count in sorted(missing_counts.items(), key=lambda item: item[1], reverse=True)
        ],
        "trade_warnings": warnings[:20],
    }
