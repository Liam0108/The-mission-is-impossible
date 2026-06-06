from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.trade import Trade
from app.schemas.analyzer import AnalyzerRequest, AnalyzerResponse
from app.services.data_quality import valid_taken_trades
from app.services.management import compare_management_styles
from app.services.poc_risk import calculate_poc_risk, historical_poc_sl_rate
from app.services.probability import calculate_historical_probabilities
from app.services.scoring import calculate_setup_score

router = APIRouter()


@router.post("/evaluate", response_model=AnalyzerResponse)
def evaluate_setup(payload: AnalyzerRequest, db: Session = Depends(get_db)):
    all_trades = db.scalars(select(Trade)).all()
    historical_trades = valid_taken_trades(all_trades)
    if payload.regime_label:
        historical_trades = [trade for trade in historical_trades if trade.regime_label == payload.regime_label]
    probability = calculate_historical_probabilities(payload, historical_trades)
    score = calculate_setup_score(payload, probability)
    poc_risk = calculate_poc_risk(payload)
    management = compare_management_styles(historical_trades)
    return {
        **score,
        **probability,
        **poc_risk,
        "historical_poc_sl_rate": historical_poc_sl_rate(historical_trades),
        "best_management_rule": management["best_management_style"],
    }
