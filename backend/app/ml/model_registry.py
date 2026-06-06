from app.ml.training_config import FUTURE_MODELS


def model_registry_status() -> dict[str, object]:
    return {
        "enabled": False,
        "registered_models": [],
        "future_models": list(FUTURE_MODELS),
        "target": "Predict TP1 before SL",
    }

