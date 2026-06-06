from dataclasses import dataclass

from app.constants import MIN_ML_TRADES

TARGET = "tp1_before_sl"
FUTURE_MODELS = ("Logistic Regression", "Random Forest", "XGBoost")


@dataclass(frozen=True)
class TrainingGate:
    minimum_valid_taken_trades: int = MIN_ML_TRADES
    enabled: bool = False


TRAINING_GATE = TrainingGate()

