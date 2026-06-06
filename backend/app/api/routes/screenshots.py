from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.trade import Trade
from app.services.screenshot_library import filter_screenshots

router = APIRouter()


@router.get("")
def screenshot_library(
    db: Session = Depends(get_db),
    session: str | None = None,
    direction: str | None = None,
    location: str | None = None,
    result: str | None = None,
    score_min: int | None = None,
    score_max: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    strategy_version: str | None = None,
    market_state: str | None = None,
    regime_label: str | None = None,
    choch: str | None = None,
    sweep: str | None = None,
    fvg_reaction: str | None = None,
    trade_decision: str | None = None,
    tag: str | None = None,
):
    trades = db.scalars(select(Trade).where(Trade.screenshot_path.is_not(None))).all()
    return filter_screenshots(
        trades,
        session=session,
        direction=direction,
        location=location,
        result=result,
        score_min=score_min,
        score_max=score_max,
        start_date=start_date,
        end_date=end_date,
        strategy_version=strategy_version,
        market_state=market_state,
        regime_label=regime_label,
        choch=choch,
        sweep=sweep,
        fvg_reaction=fvg_reaction,
        trade_decision=trade_decision,
        tag=tag,
    )
