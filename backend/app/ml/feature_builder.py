from typing import Any

from app.services.fast_entry import calculate_trade_distances
from app.services.normalization import as_float, as_str, value_of

ML_FEATURES = [
    "session",
    "direction",
    "bias_15m",
    "market_state",
    "location",
    "liquidity_sweep",
    "choch",
    "lh_hl",
    "fvg_reaction",
    "volume_state",
    "rr_ratio",
    "distance_to_poc",
    "distance_to_vah",
    "distance_to_val",
    "poc_risk_level",
]


def build_feature_row(trade: Any) -> dict[str, Any]:
    distances = calculate_trade_distances(
        as_str(value_of(trade, "direction")),
        value_of(trade, "entry_price"),
        value_of(trade, "stop_loss"),
        value_of(trade, "tp1_price"),
    )
    return {
        "session": as_str(value_of(trade, "session")),
        "direction": as_str(value_of(trade, "direction")),
        "bias_15m": as_str(value_of(trade, "bias_15m")),
        "market_state": as_str(value_of(trade, "market_state")),
        "location": as_str(value_of(trade, "location")),
        "liquidity_sweep": as_str(value_of(trade, "liquidity_sweep")),
        "choch": as_str(value_of(trade, "choch")),
        "lh_hl": as_str(value_of(trade, "lh_hl")),
        "fvg_reaction": as_str(value_of(trade, "fvg_reaction")),
        "volume_state": as_str(value_of(trade, "volume_state")),
        "rr_ratio": distances["rr_ratio"],
        "distance_to_poc": as_float(value_of(trade, "distance_to_poc"), default=0.0),
        "distance_to_vah": as_float(value_of(trade, "distance_to_vah"), default=0.0),
        "distance_to_val": as_float(value_of(trade, "distance_to_val"), default=0.0),
        "poc_risk_level": as_str(value_of(trade, "poc_risk_level")),
    }


def is_valid_training_trade(trade: Any) -> bool:
    return as_str(value_of(trade, "trade_decision", "Taken")) == "Taken" and as_str(value_of(trade, "result")) in {
        "TP1",
        "SL",
    }

