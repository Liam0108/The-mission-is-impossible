from typing import Any, Optional

from app.services.normalization import as_float, plain, value_of

COPY_FIELDS = (
    "session",
    "instrument",
    "data_type",
    "direction",
    "bias_15m",
    "market_state",
    "location",
    "liquidity_sweep",
    "choch",
    "lh_hl",
    "fvg_reaction",
    "volume_state",
    "trade_decision",
    "distance_to_poc",
    "distance_to_vah",
    "distance_to_val",
    "poc_risk_level",
    "user_id",
    "workspace_id",
)

RESET_FIELDS = {
    "entry_price": None,
    "stop_loss": None,
    "tp1_price": None,
    "tp2_price": None,
    "risk_amount": None,
    "result": "NoTrade",
    "result_r": 0,
    "mfe": 0,
    "mae": 0,
    "notes": "",
    "screenshot_path": None,
    "skip_reason": None,
    "management_rule_notes": None,
}


def duplicate_last_trade_payload(last_trade: Any, trade_date: Optional[str] = None) -> dict[str, Any]:
    payload = {field: plain(value_of(last_trade, field)) for field in COPY_FIELDS}
    payload.update(RESET_FIELDS)
    if trade_date:
        payload["date"] = trade_date
    return payload


def calculate_trade_distances(
    direction: str,
    entry_price: Optional[float],
    stop_loss: Optional[float],
    tp1_price: Optional[float],
) -> dict[str, Optional[float]]:
    if entry_price is None or stop_loss is None:
        return {"risk_distance": None, "reward_distance": None, "rr_ratio": None}

    entry = as_float(entry_price)
    stop = as_float(stop_loss)
    tp1 = as_float(tp1_price) if tp1_price is not None else None
    risk_distance = abs(entry - stop)
    reward_distance = abs(tp1 - entry) if tp1 is not None else None
    rr_ratio = round(reward_distance / risk_distance, 2) if reward_distance is not None and risk_distance else None
    return {
        "risk_distance": round(risk_distance, 2),
        "reward_distance": round(reward_distance, 2) if reward_distance is not None else None,
        "rr_ratio": rr_ratio,
    }


def calculate_result_r(result: str, rr_ratio: Optional[float]) -> float:
    if result == "TP1":
        return round(rr_ratio or 1.0, 2)
    if result == "BE":
        return 0.0
    if result == "SL":
        return -1.0
    return 0.0
