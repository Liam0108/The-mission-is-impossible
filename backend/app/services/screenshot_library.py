from __future__ import annotations

from datetime import date
from typing import Any

from app.services.normalization import as_float, as_str, plain, value_of


def _has_tag(trade: Any, tag: str) -> bool:
    tags = [item.strip() for item in as_str(value_of(trade, "screenshot_tags")).split(",") if item.strip()]
    return tag in tags


def filter_screenshots(
    trades: list[Any],
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
) -> list[dict[str, Any]]:
    rows = []
    for trade in trades:
        if not value_of(trade, "screenshot_path"):
            continue
        if session and as_str(value_of(trade, "session")) != session:
            continue
        if direction and as_str(value_of(trade, "direction")) != direction:
            continue
        if location and as_str(value_of(trade, "location")) != location:
            continue
        if result and as_str(value_of(trade, "result")) != result:
            continue
        score = value_of(trade, "setup_score")
        if score_min is not None and (score is None or int(score) < score_min):
            continue
        if score_max is not None and (score is None or int(score) > score_max):
            continue
        trade_date = plain(value_of(trade, "date"))
        if start_date and trade_date < start_date.isoformat():
            continue
        if end_date and trade_date > end_date.isoformat():
            continue
        if strategy_version and as_str(value_of(trade, "strategy_version")) != strategy_version:
            continue
        if market_state and as_str(value_of(trade, "market_state")) != market_state:
            continue
        if regime_label and as_str(value_of(trade, "regime_label")) != regime_label:
            continue
        if choch and as_str(value_of(trade, "choch")) != choch:
            continue
        if sweep and as_str(value_of(trade, "liquidity_sweep")) != sweep:
            continue
        if fvg_reaction and as_str(value_of(trade, "fvg_reaction")) != fvg_reaction:
            continue
        if trade_decision and as_str(value_of(trade, "trade_decision")) != trade_decision:
            continue
        if tag and not _has_tag(trade, tag):
            continue
        rows.append(
            {
                "id": as_str(value_of(trade, "id")),
                "trade_id": as_str(value_of(trade, "id")),
                "date": as_str(trade_date),
                "session": as_str(value_of(trade, "session")),
                "direction": as_str(value_of(trade, "direction")),
                "location": as_str(value_of(trade, "location")),
                "result": as_str(value_of(trade, "result")),
                "setup_score": int(value_of(trade, "setup_score") or 0),
                "strategy_version": as_str(value_of(trade, "strategy_version")),
                "market_state": as_str(value_of(trade, "market_state")),
                "regime_label": as_str(value_of(trade, "regime_label")),
                "choch": as_str(value_of(trade, "choch")),
                "liquidity_sweep": as_str(value_of(trade, "liquidity_sweep")),
                "fvg_reaction": as_str(value_of(trade, "fvg_reaction")),
                "trade_decision": as_str(value_of(trade, "trade_decision")),
                "screenshot_path": as_str(value_of(trade, "screenshot_path")),
                "screenshot_tags": as_str(value_of(trade, "screenshot_tags")),
                "screenshot_favorite": bool(value_of(trade, "screenshot_favorite")),
                "screenshot_bookmarked": bool(value_of(trade, "screenshot_bookmarked")),
                "screenshot_notes": as_str(value_of(trade, "screenshot_notes")),
                "lessons_learned": as_str(value_of(trade, "lessons_learned")),
                "result_r": as_float(value_of(trade, "result_r")),
            }
        )
    return sorted(rows, key=lambda row: row["date"], reverse=True)
