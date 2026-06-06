import os
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models.trade import Trade
from app.schemas.trade import TradeCreate, TradeRead, TradeUpdate
from app.services.csv_io import parse_trades_csv, render_trades_csv
from app.services.data_quality import data_quality_for_trade
from app.services.poc_risk import calculate_poc_risk
from app.services.scoring import calculate_setup_score

router = APIRouter()


def _trade_or_404(db: Session, trade_id: UUID) -> Trade:
    trade = db.get(Trade, trade_id)
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    return trade


def _filtered_statement(
    session: str | None = None,
    location: str | None = None,
    direction: str | None = None,
    market_state: str | None = None,
    regime_label: str | None = None,
    data_type: str | None = None,
    result: str | None = None,
    trade_decision: str | None = None,
    strategy_version: str | None = None,
    setup_type: str | None = None,
    mistake_type: str | None = None,
    news_timing: str | None = None,
    user_id: str | None = None,
    workspace_id: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
):
    stmt = select(Trade)
    filters = {
        "session": session,
        "location": location,
        "direction": direction,
        "market_state": market_state,
        "regime_label": regime_label,
        "data_type": data_type,
        "result": result,
        "trade_decision": trade_decision,
        "strategy_version": strategy_version,
        "setup_type": setup_type,
        "mistake_type": mistake_type,
        "news_timing": news_timing,
        "user_id": user_id,
        "workspace_id": workspace_id,
    }
    for field, value in filters.items():
        if value:
            stmt = stmt.where(getattr(Trade, field) == value)
    if start_date:
        stmt = stmt.where(Trade.date >= start_date)
    if end_date:
        stmt = stmt.where(Trade.date <= end_date)
    return stmt.order_by(Trade.date.desc(), Trade.created_at.desc())


def _with_poc_risk(payload: TradeCreate | TradeUpdate) -> dict:
    data = payload.model_dump(exclude_unset=isinstance(payload, TradeUpdate))
    if isinstance(payload, TradeUpdate) and not {
        "location",
        "market_state",
        "distance_to_poc",
        "poc_risk_level",
    }.intersection(data):
        return data
    if data.get("poc_risk_level") in {None, "Unknown"}:
        data["poc_risk_level"] = calculate_poc_risk(data)["poc_risk_level"]
    if not isinstance(payload, TradeUpdate):
        data["data_quality"] = data_quality_for_trade(data)
        data["setup_score"] = calculate_setup_score(data).get("setup_score")
    return data


@router.get("", response_model=list[TradeRead])
def list_trades(
    db: Session = Depends(get_db),
    session: str | None = None,
    location: str | None = None,
    direction: str | None = None,
    market_state: str | None = None,
    regime_label: str | None = None,
    data_type: str | None = None,
    result: str | None = None,
    trade_decision: str | None = None,
    strategy_version: str | None = None,
    setup_type: str | None = None,
    mistake_type: str | None = None,
    news_timing: str | None = None,
    user_id: str | None = None,
    workspace_id: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
):
    stmt = _filtered_statement(
        session,
        location,
        direction,
        market_state,
        regime_label,
        data_type,
        result,
        trade_decision,
        strategy_version,
        setup_type,
        mistake_type,
        news_timing,
        user_id,
        workspace_id,
        start_date,
        end_date,
    )
    return db.scalars(stmt).all()


@router.post("", response_model=TradeRead, status_code=status.HTTP_201_CREATED)
def create_trade(payload: TradeCreate, db: Session = Depends(get_db)):
    trade = Trade(**_with_poc_risk(payload))
    db.add(trade)
    db.commit()
    db.refresh(trade)
    return trade


@router.post("/import", response_model=list[TradeRead], status_code=status.HTTP_201_CREATED)
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    raw = (await file.read()).decode("utf-8-sig")
    parsed = parse_trades_csv(raw)
    trades = [Trade(**_with_poc_risk(trade)) for trade in parsed]
    db.add_all(trades)
    db.commit()
    for trade in trades:
        db.refresh(trade)
    return trades


@router.get("/export/csv")
def export_csv(db: Session = Depends(get_db)):
    trades = db.scalars(select(Trade).order_by(Trade.date.desc())).all()
    csv_body = render_trades_csv(trades)
    return Response(
        content=csv_body,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=fabio-edge-trades.csv"},
    )


@router.get("/{trade_id}", response_model=TradeRead)
def get_trade(trade_id: UUID, db: Session = Depends(get_db)):
    return _trade_or_404(db, trade_id)


@router.patch("/{trade_id}", response_model=TradeRead)
def update_trade(trade_id: UUID, payload: TradeUpdate, db: Session = Depends(get_db)):
    trade = _trade_or_404(db, trade_id)
    for field, value in _with_poc_risk(payload).items():
        setattr(trade, field, value)
    trade.data_quality = data_quality_for_trade(trade)
    trade.setup_score = calculate_setup_score(trade).get("setup_score")
    db.commit()
    db.refresh(trade)
    return trade


@router.delete("/{trade_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trade(trade_id: UUID, db: Session = Depends(get_db)):
    trade = _trade_or_404(db, trade_id)
    db.delete(trade)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{trade_id}/screenshot", response_model=TradeRead)
async def upload_screenshot(
    trade_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    trade = _trade_or_404(db, trade_id)
    settings = get_settings()
    os.makedirs(settings.upload_dir, exist_ok=True)
    safe_name = os.path.basename(file.filename or "screenshot.png").replace(" ", "_")
    path = os.path.join(settings.upload_dir, f"{trade_id}_{safe_name}")
    with open(path, "wb") as handle:
        handle.write(await file.read())
    trade.screenshot_path = path
    db.commit()
    db.refresh(trade)
    return trade
