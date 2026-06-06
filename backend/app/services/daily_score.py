from collections import defaultdict
from datetime import date
from statistics import pstdev
from typing import Any

from app.services.normalization import as_float, as_str, plain, value_of


def _avg(values: list[float]) -> float:
    return round(sum(values) / len(values), 1) if values else 0.0


def _score_from_field(trades: list[Any], field: str) -> float:
    values = [as_float(value_of(trade, field)) * 10 for trade in trades if value_of(trade, field) is not None]
    return _avg(values)


def _risk_score(trades: list[Any]) -> float:
    if not trades:
        return 0.0
    penalties = 0
    for trade in trades:
        mistake = as_str(value_of(trade, "mistake_type", "None"))
        if mistake in {"No Stop", "Moved Stop", "Ignored Risk", "Overtrading"}:
            penalties += 18
        elif as_float(value_of(trade, "result_r")) < -1:
            penalties += 10
    return max(0.0, round(100 - (penalties / len(trades)), 1))


def _consistency_score(trades: list[Any]) -> float:
    if len(trades) < 2:
        return 100.0 if trades else 0.0
    scores = [as_float(value_of(trade, "result_r")) for trade in trades]
    return max(0.0, round(100 - min(pstdev(scores) * 20, 100), 1))


def _summary_for_period(name: str, trades: list[Any]) -> dict[str, Any]:
    discipline = _score_from_field(trades, "discipline_score")
    execution = _score_from_field(trades, "execution_score")
    emotion = _score_from_field(trades, "emotion_score")
    risk = _risk_score(trades)
    consistency = _consistency_score(trades)
    overall = _avg([score for score in [discipline, execution, risk, consistency, emotion] if score > 0])
    return {
        "period": name,
        "trades": len(trades),
        "discipline": discipline,
        "execution": execution,
        "risk_control": risk,
        "consistency": consistency,
        "emotional_control": emotion,
        "overall_score": overall,
    }


def trading_scores(trades: list[Any]) -> dict[str, list[dict[str, Any]]]:
    by_day: dict[str, list[Any]] = defaultdict(list)
    by_week: dict[str, list[Any]] = defaultdict(list)
    by_month: dict[str, list[Any]] = defaultdict(list)

    for trade in trades:
        day = as_str(plain(value_of(trade, "date")))
        by_day[day].append(trade)
        by_month[day[:7]].append(trade)
        try:
            parsed = date.fromisoformat(day[:10])
            week_key = f"{parsed.isocalendar().year}-W{parsed.isocalendar().week:02d}"
        except ValueError:
            week_key = day[:10]
        by_week[week_key].append(trade)

    return {
        "daily": [_summary_for_period(key, by_day[key]) for key in sorted(by_day)],
        "weekly": [_summary_for_period(key, by_week[key]) for key in sorted(by_week)],
        "monthly": [_summary_for_period(key, by_month[key]) for key in sorted(by_month)],
    }
