from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.trade import Trade
from app.services.analytics import best_and_worst_conditions
from app.services.data_quality import data_quality_dashboard, valid_taken_trades
from app.services.management import compare_management_styles
from app.services.monte_carlo import run_monte_carlo
from app.services.ml import ml_status

router = APIRouter()


@router.get("/conditions")
def conditions(
    db: Session = Depends(get_db),
    session: str | None = None,
    location: str | None = None,
    direction: str | None = None,
    market_state: str | None = None,
    regime_label: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
):
    stmt = select(Trade)
    for field, value in {
        "session": session,
        "location": location,
        "direction": direction,
        "market_state": market_state,
        "regime_label": regime_label,
    }.items():
        if value:
            stmt = stmt.where(getattr(Trade, field) == value)
    if start_date:
        stmt = stmt.where(Trade.date >= start_date)
    if end_date:
        stmt = stmt.where(Trade.date <= end_date)
    trades = valid_taken_trades(db.scalars(stmt).all())
    return best_and_worst_conditions(trades)


@router.get("/management")
def management(
    db: Session = Depends(get_db),
    partial_exit_percent: float = 50,
    be_after_tp1: bool = True,
    tp2_enabled: bool = True,
    tp2_price: float | None = None,
    regime_label: str | None = None,
):
    stmt = select(Trade)
    if regime_label:
        stmt = stmt.where(Trade.regime_label == regime_label)
    trades = valid_taken_trades(db.scalars(stmt).all())
    return compare_management_styles(trades, partial_exit_percent, be_after_tp1, tp2_enabled, tp2_price)


@router.get("/data-quality")
def data_quality(db: Session = Depends(get_db)):
    return data_quality_dashboard(db.scalars(select(Trade)).all())


@router.get("/monte-carlo")
def monte_carlo(
    db: Session = Depends(get_db),
    simulations: int = 5000,
    account_size: float = 50000,
    risk_per_trade: float = 0.5,
    risk_mode: str = "percent",
    daily_loss_limit: float | None = None,
    account_drawdown_limit_percent: float = 5,
    trades_per_day: int = 3,
    seed: int | None = 42,
    regime_label: str | None = None,
):
    stmt = select(Trade)
    if regime_label:
        stmt = stmt.where(Trade.regime_label == regime_label)
    trades = valid_taken_trades(db.scalars(stmt).all())
    return run_monte_carlo(
        trades,
        simulations=simulations,
        account_size=account_size,
        risk_per_trade=risk_per_trade,
        risk_mode=risk_mode,
        daily_loss_limit=daily_loss_limit,
        account_drawdown_limit_percent=account_drawdown_limit_percent,
        trades_per_day=trades_per_day,
        seed=seed,
    )


@router.get("/ml-status")
def machine_learning_status(db: Session = Depends(get_db)):
    trade_count = len(valid_taken_trades(db.scalars(select(Trade)).all()))
    return ml_status(trade_count)
