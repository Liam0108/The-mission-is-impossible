from collections import defaultdict
from typing import Any

from app.services.analytics import _group_performance
from app.services.normalization import as_float, as_str, value_of


def _rate(count: int, total: int) -> float:
    return round((count / total) * 100, 1) if total else 0.0


def _profit_factor(trades: list[Any]) -> float:
    gross_profit = sum(max(as_float(value_of(trade, "result_r")), 0) for trade in trades)
    gross_loss = abs(sum(min(as_float(value_of(trade, "result_r")), 0) for trade in trades))
    return round(gross_profit / gross_loss, 2) if gross_loss else round(gross_profit, 2)


def _performance_row(name: str, trades: list[Any]) -> dict[str, Any]:
    total = len(trades)
    return {
        "name": name,
        "trades": total,
        "win_rate": _rate(sum(1 for trade in trades if as_str(value_of(trade, "result")) == "TP1"), total),
        "tp1_rate": _rate(sum(1 for trade in trades if as_str(value_of(trade, "result")) == "TP1"), total),
        "sl_rate": _rate(sum(1 for trade in trades if as_str(value_of(trade, "result")) == "SL"), total),
        "expectancy": round(sum(as_float(value_of(trade, "result_r")) for trade in trades) / total, 2) if total else 0.0,
        "result_r": round(sum(as_float(value_of(trade, "result_r")) for trade in trades), 2),
        "profit_factor": _profit_factor(trades),
    }


def _alignment_bucket(trade: Any, bias_field: str) -> str:
    direction = as_str(value_of(trade, "direction"))
    bias = as_str(value_of(trade, bias_field, "Neutral"))
    if bias == "Neutral":
        return "Neutral"
    if (direction == "Long" and bias == "Bullish") or (direction == "Short" and bias == "Bearish"):
        return "With Bias"
    return "Against Bias"


def bias_alignment_analytics(trades: list[Any]) -> dict[str, Any]:
    response = {}
    for field in ("daily_bias", "weekly_bias", "monthly_bias"):
        groups: dict[str, list[Any]] = defaultdict(list)
        for trade in trades:
            groups[_alignment_bucket(trade, field)].append(trade)
        response[field] = [_performance_row(name, group) for name, group in groups.items()]
    return response


def news_analytics(trades: list[Any]) -> dict[str, Any]:
    during = [trade for trade in trades if as_str(value_of(trade, "news_timing")) == "During News"]
    before = [trade for trade in trades if as_str(value_of(trade, "news_timing")) == "Before News"]
    after = [trade for trade in trades if as_str(value_of(trade, "news_timing")) == "After News"]
    high_impact = [trade for trade in trades if as_str(value_of(trade, "high_impact_news")) == "Yes"]
    by_type = _group_performance([trade for trade in trades if value_of(trade, "news_type")], "news_type")
    return {
        "tp1_rate_during_news": _performance_row("During News", during)["tp1_rate"],
        "sl_rate_during_news": _performance_row("During News", during)["sl_rate"],
        "performance_before_news": _performance_row("Before News", before),
        "performance_after_news": _performance_row("After News", after),
        "performance_by_news_type": by_type,
        "highest_risk_news_events": sorted(by_type, key=lambda row: row["sl_rate"], reverse=True)[:5],
        "best_conditions_around_news": sorted(by_type, key=lambda row: row["expectancy"], reverse=True)[:5],
        "high_impact_summary": _performance_row("High Impact News", high_impact),
    }


def strategy_version_analytics(trades: list[Any]) -> dict[str, Any]:
    rows = _group_performance([trade for trade in trades if value_of(trade, "strategy_version")], "strategy_version")
    return {
        "versions": rows,
        "performance_evolution": rows,
    }


def session_refinement_analytics(trades: list[Any]) -> dict[str, Any]:
    rows = _group_performance(trades, "session")
    best = rows[0] if rows else None
    worst = sorted(rows, key=lambda row: row["expectancy"])[0] if rows else None
    consistent = sorted(rows, key=lambda row: (row["win_rate"], row["trades"]), reverse=True)[0] if rows else None
    return {
        "sessions": rows,
        "best_session": best,
        "worst_session": worst,
        "most_consistent_session": consistent,
    }

