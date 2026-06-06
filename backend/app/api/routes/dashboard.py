from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.trade import Trade
from app.schemas.dashboard import DashboardResponse
from app.services.analytics import calculate_dashboard
from app.services.data_quality import data_quality_dashboard, valid_taken_trades

router = APIRouter()


@router.get("", response_model=DashboardResponse)
def dashboard(
    db: Session = Depends(get_db),
    session: str | None = None,
    location: str | None = None,
    direction: str | None = None,
    market_state: str | None = None,
    regime_label: str | None = None,
    trade_decision: str | None = None,
    user_id: str | None = None,
    workspace_id: str | None = None,
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
        "trade_decision": trade_decision,
        "user_id": user_id,
        "workspace_id": workspace_id,
    }.items():
        if value:
            stmt = stmt.where(getattr(Trade, field) == value)
    if start_date:
        stmt = stmt.where(Trade.date >= start_date)
    if end_date:
        stmt = stmt.where(Trade.date <= end_date)

    trades = db.scalars(stmt.order_by(Trade.date.asc())).all()
    dashboard_data = calculate_dashboard(valid_taken_trades(trades))
    dashboard_data["data_quality"] = data_quality_dashboard(trades)
    return dashboard_data
