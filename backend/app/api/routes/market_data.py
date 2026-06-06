from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.market_data import MarketCandle, SetupCandidateLog
from app.schemas.market_data import MarketLabSummary
from app.services.market_data import Candle, analyze_candles, fetch_yahoo_market_data, normalize_timeframe, parse_candle_csv

router = APIRouter()


def _to_decimal(value: float) -> Decimal:
    return Decimal(str(value))


def _to_service_candle(row: MarketCandle) -> Candle:
    return Candle(
        symbol=row.symbol,
        timeframe=row.timeframe,
        timestamp=row.timestamp,
        open=float(row.open),
        high=float(row.high),
        low=float(row.low),
        close=float(row.close),
        volume=float(row.volume),
        raw_timestamp=row.raw_timestamp,
        source_row_index=row.source_row_index,
        source_symbol=row.source_symbol,
        source_filename=row.source_filename,
    )


def _candidate_timestamp(value: str | datetime) -> datetime:
    return value if isinstance(value, datetime) else datetime.fromisoformat(value)


def _store_candidates(db: Session, candidates: list[dict]) -> None:
    if not candidates:
        return

    symbols = {candidate["symbol"] for candidate in candidates}
    timeframes = {candidate["timeframe"] for candidate in candidates}
    existing = db.scalars(
        select(SetupCandidateLog).where(
            SetupCandidateLog.symbol.in_(symbols),
            SetupCandidateLog.timeframe.in_(timeframes),
        )
    ).all()
    existing_keys = {
        (
            item.symbol,
            item.timeframe,
            item.timestamp,
            item.setup_type,
            item.direction,
        )
        for item in existing
    }

    for candidate in candidates:
        timestamp = _candidate_timestamp(candidate["timestamp"])
        key = (
            candidate["symbol"],
            candidate["timeframe"],
            timestamp,
            candidate["setup_type"],
            candidate["direction"],
        )
        if key in existing_keys:
            continue
        db.add(
            SetupCandidateLog(
                timestamp=timestamp,
                symbol=candidate["symbol"],
                timeframe=candidate["timeframe"],
                direction=candidate["direction"],
                setup_type=candidate["setup_type"],
                confidence_score=candidate["confidence_score"],
                reasons="\n".join(candidate["reasons"]),
            )
        )
        existing_keys.add(key)


def _summary(
    db: Session,
    symbol: str,
    timeframe: str,
    duplicate_rows: int = 0,
    import_summary: dict | None = None,
    swing_config: dict | None = None,
    structure_sweep_config: dict | None = None,
) -> dict:
    rows = db.scalars(
        select(MarketCandle)
        .where(MarketCandle.symbol == symbol.upper(), MarketCandle.timeframe == normalize_timeframe(timeframe))
        .order_by(MarketCandle.timestamp.asc())
    ).all()
    candles = [_to_service_candle(row) for row in rows]
    reference_labels = import_summary.get("reference_labels", []) if import_summary else []
    summary = analyze_candles(
        candles,
        duplicate_rows=duplicate_rows,
        swing_config=swing_config,
        structure_sweep_config=structure_sweep_config,
        reference_labels=reference_labels,
    )
    _store_candidates(db, summary["setup_candidates"])
    db.commit()
    summary["import_summary"] = import_summary
    return summary


@router.get("/summary", response_model=MarketLabSummary)
def market_summary(
    symbol: str = "NQ",
    timeframe: str = "1m",
    swing_mode: str = Query("normal"),
    swing_left_candles: int = Query(2, ge=1, le=20),
    swing_right_candles: int = Query(2, ge=1, le=20),
    min_swing_distance: float = Query(8, ge=0, le=1000),
    min_structure_node_importance: int = Query(50, ge=0, le=100),
    max_structure_sweep_age_minutes: float | None = Query(None, ge=0),
    min_structure_pierce_size: float = Query(0, ge=0, le=1000),
    db: Session = Depends(get_db),
):
    try:
        return _summary(
            db,
            symbol,
            timeframe,
            swing_config={
                "mode": swing_mode,
                "left_candles": swing_left_candles,
                "right_candles": swing_right_candles,
                "min_swing_distance": min_swing_distance,
            },
            structure_sweep_config={
                "min_node_importance": min_structure_node_importance,
                "max_age_minutes": max_structure_sweep_age_minutes,
                "min_pierce_size": min_structure_pierce_size,
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/free-data", response_model=MarketLabSummary)
def free_data_research_summary(
    symbol: str = "NQ=F",
    timeframe: str = "1m",
    range_value: str | None = Query(None, alias="range"),
    force_refresh: bool = False,
    swing_mode: str = Query("normal"),
    swing_left_candles: int = Query(2, ge=1, le=20),
    swing_right_candles: int = Query(2, ge=1, le=20),
    min_swing_distance: float = Query(8, ge=0, le=1000),
    min_structure_node_importance: int = Query(50, ge=0, le=100),
    max_structure_sweep_age_minutes: float | None = Query(None, ge=0),
    min_structure_pierce_size: float = Query(0, ge=0, le=1000),
):
    try:
        candles, free_data = fetch_yahoo_market_data(symbol, timeframe=timeframe, range_value=range_value, force_refresh=force_refresh)
        summary = analyze_candles(
            candles,
            swing_config={
                "mode": swing_mode,
                "left_candles": swing_left_candles,
                "right_candles": swing_right_candles,
                "min_swing_distance": min_swing_distance,
            },
            structure_sweep_config={
                "min_node_importance": min_structure_node_importance,
                "max_age_minutes": max_structure_sweep_age_minutes,
                "min_pierce_size": min_structure_pierce_size,
            },
        )
        summary["free_data"] = free_data
        return summary
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/import", response_model=MarketLabSummary, status_code=status.HTTP_201_CREATED)
async def import_market_csv(
    file: UploadFile = File(...),
    symbol: str = "NQ",
    timeframe: str = "1m",
    swing_mode: str = Query("normal"),
    swing_left_candles: int = Query(2, ge=1, le=20),
    swing_right_candles: int = Query(2, ge=1, le=20),
    min_swing_distance: float = Query(8, ge=0, le=1000),
    min_structure_node_importance: int = Query(50, ge=0, le=100),
    max_structure_sweep_age_minutes: float | None = Query(None, ge=0),
    min_structure_pierce_size: float = Query(0, ge=0, le=1000),
    db: Session = Depends(get_db),
):
    try:
        raw = (await file.read()).decode("utf-8-sig")
        candles, parsed_summary = parse_candle_csv(raw, default_symbol=symbol, default_timeframe=timeframe, source_filename=file.filename)
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV must be UTF-8 encoded") from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    existing_rows = db.scalars(
        select(MarketCandle).where(
            MarketCandle.symbol.in_({candle.symbol for candle in candles} or {symbol.upper()}),
            MarketCandle.timeframe.in_({candle.timeframe for candle in candles} or {normalize_timeframe(timeframe)}),
        )
    ).all()
    existing_keys = {(row.symbol, row.timeframe, row.timestamp) for row in existing_rows}

    inserted_rows = 0
    duplicate_rows = int(parsed_summary["duplicate_rows"])
    for candle in candles:
        key = (candle.symbol, candle.timeframe, candle.timestamp)
        if key in existing_keys:
            duplicate_rows += 1
            continue
        db.add(
            MarketCandle(
                symbol=candle.symbol,
                timeframe=candle.timeframe,
                timestamp=candle.timestamp,
                open=_to_decimal(candle.open),
                high=_to_decimal(candle.high),
                low=_to_decimal(candle.low),
                close=_to_decimal(candle.close),
                volume=_to_decimal(candle.volume),
                raw_timestamp=candle.raw_timestamp,
                source_row_index=candle.source_row_index,
                source_symbol=candle.source_symbol,
                source_filename=candle.source_filename,
            )
        )
        existing_keys.add(key)
        inserted_rows += 1

    db.commit()
    import_summary = {
        **parsed_summary,
        "inserted_rows": inserted_rows,
        "duplicate_rows": duplicate_rows,
    }
    return _summary(
        db,
        symbol,
        timeframe,
        duplicate_rows=duplicate_rows,
        import_summary=import_summary,
        swing_config={
            "mode": swing_mode,
            "left_candles": swing_left_candles,
            "right_candles": swing_right_candles,
            "min_swing_distance": min_swing_distance,
        },
        structure_sweep_config={
            "min_node_importance": min_structure_node_importance,
            "max_age_minutes": max_structure_sweep_age_minutes,
            "min_pierce_size": min_structure_pierce_size,
        },
    )
