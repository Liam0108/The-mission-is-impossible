from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.trade import Trade
from app.services.data_quality import valid_taken_trades
from app.services.daily_score import trading_scores
from app.services.edge_discovery import discover_edges
from app.services.research import (
    bias_alignment_analytics,
    news_analytics,
    session_refinement_analytics,
    strategy_version_analytics,
)
from app.services.review import review_analytics

router = APIRouter()


def _trades(db: Session, regime_label: str | None = None):
    stmt = select(Trade)
    if regime_label:
        stmt = stmt.where(Trade.regime_label == regime_label)
    return valid_taken_trades(db.scalars(stmt).all())


@router.get("/review")
def review(db: Session = Depends(get_db), regime_label: str | None = None):
    return review_analytics(_trades(db, regime_label))


@router.get("/daily-score")
def daily_score(db: Session = Depends(get_db), regime_label: str | None = None):
    return trading_scores(_trades(db, regime_label))


@router.get("/market-context")
def market_context(db: Session = Depends(get_db), regime_label: str | None = None):
    return bias_alignment_analytics(_trades(db, regime_label))


@router.get("/news")
def news(db: Session = Depends(get_db), regime_label: str | None = None):
    return news_analytics(_trades(db, regime_label))


@router.get("/strategy-versions")
def strategy_versions(db: Session = Depends(get_db), regime_label: str | None = None):
    return strategy_version_analytics(_trades(db, regime_label))


@router.get("/sessions")
def sessions(db: Session = Depends(get_db), regime_label: str | None = None):
    return session_refinement_analytics(_trades(db, regime_label))


@router.get("/edge-discovery")
def edge_discovery(db: Session = Depends(get_db), min_sample: int = 3, regime_label: str | None = None):
    return discover_edges(_trades(db, regime_label), min_sample=min_sample)
