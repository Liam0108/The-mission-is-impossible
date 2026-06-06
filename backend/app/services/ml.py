from app.constants import MIN_ML_TRADES


def ml_status(trade_count: int) -> dict[str, object]:
    enabled = trade_count >= MIN_ML_TRADES
    return {
        "enabled": enabled,
        "minimum_required_trades": MIN_ML_TRADES,
        "current_trades": trade_count,
        "message": (
            "ML enabled for research mode."
            if enabled
            else f"ML disabled: need at least {MIN_ML_TRADES} valid taken trades."
        ),
        "planned_models": ["Logistic Regression", "Random Forest", "XGBoost"],
        "future_target": "Predict TP1 before SL.",
        "boundary": "ML can only provide decision-support probabilities and must never place orders.",
    }
