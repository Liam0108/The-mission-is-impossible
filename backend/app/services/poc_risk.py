from typing import Any

from app.services.normalization import as_float, as_str, value_of

POC_HIGH_DISTANCE = 5.0
POC_MEDIUM_DISTANCE = 12.0


def calculate_poc_risk(setup: Any) -> dict[str, Any]:
    location = as_str(value_of(setup, "location"))
    market_state = as_str(value_of(setup, "market_state"))
    provided_level = as_str(value_of(setup, "poc_risk_level"))
    distance_to_poc = value_of(setup, "distance_to_poc")
    distance = as_float(distance_to_poc, default=-1)

    if location == "POC":
        level = "High"
    elif distance >= 0 and distance <= POC_HIGH_DISTANCE:
        level = "High"
    elif market_state == "Balanced" and location == "Other":
        level = "Medium"
    elif location in {"VAH", "VAL"}:
        level = "Medium" if 0 <= distance <= POC_MEDIUM_DISTANCE else "Low"
    elif provided_level in {"Low", "Medium", "High"}:
        level = provided_level
    else:
        level = "Unknown"

    if market_state == "Balanced" and location == "POC":
        level = "High"

    return {
        "poc_risk_level": level,
        "poc_risk_message": f"POC Risk: {level}",
    }


def is_near_poc(trade: Any) -> bool:
    location = as_str(value_of(trade, "location"))
    risk_level = as_str(value_of(trade, "poc_risk_level"))
    distance = as_float(value_of(trade, "distance_to_poc"), default=-1)
    return location == "POC" or risk_level == "High" or (0 <= distance <= POC_HIGH_DISTANCE)


def historical_poc_sl_rate(trades: list[Any]) -> float:
    near_poc = [trade for trade in trades if is_near_poc(trade) and as_str(value_of(trade, "result")) in {"TP1", "BE", "SL"}]
    if not near_poc:
        return 0.0
    sl_count = sum(1 for trade in near_poc if as_str(value_of(trade, "result")) == "SL")
    return round((sl_count / len(near_poc)) * 100, 1)

