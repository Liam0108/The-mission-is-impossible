from collections import defaultdict
from typing import Any

from app.services.normalization import as_float, as_str, plain, value_of


def _rate(count: int, total: int) -> float:
    return round((count / total) * 100, 1) if total else 0.0


def _expectancy(trades: list[Any]) -> float:
    return round(sum(as_float(value_of(trade, "result_r")) for trade in trades) / len(trades), 2) if trades else 0.0


def _profit_factor(trades: list[Any]) -> float:
    gross_profit = sum(max(as_float(value_of(trade, "result_r")), 0) for trade in trades)
    gross_loss = abs(sum(min(as_float(value_of(trade, "result_r")), 0) for trade in trades))
    if gross_loss == 0:
        return round(gross_profit, 2) if gross_profit else 0.0
    return round(gross_profit / gross_loss, 2)


def _max_streak(trades: list[Any], winning: bool) -> int:
    streak = 0
    best = 0
    ordered = sorted(trades, key=lambda trade: as_str(plain(value_of(trade, "date"))))
    for trade in ordered:
        result_r = as_float(value_of(trade, "result_r"))
        qualifies = result_r > 0 if winning else result_r < 0
        if qualifies:
            streak += 1
            best = max(best, streak)
        else:
            streak = 0
    return best


def _group_performance(trades: list[Any], field: str) -> list[dict[str, Any]]:
    groups: dict[str, list[Any]] = defaultdict(list)
    for trade in trades:
        if field == "month":
            key = as_str(plain(value_of(trade, "date")))[:7]
        else:
            key = as_str(value_of(trade, field)) or "Unknown"
        groups[key].append(trade)

    rows = []
    for name, group in groups.items():
        rows.append(
            {
                "name": name,
                "trades": len(group),
                "win_rate": _rate(sum(1 for trade in group if as_str(value_of(trade, "result")) == "TP1"), len(group)),
                "tp1_rate": _rate(sum(1 for trade in group if as_str(value_of(trade, "result")) == "TP1"), len(group)),
                "sl_rate": _rate(sum(1 for trade in group if as_str(value_of(trade, "result")) == "SL"), len(group)),
                "expectancy": _expectancy(group),
                "result_r": round(sum(as_float(value_of(trade, "result_r")) for trade in group), 2),
            }
        )
    return sorted(rows, key=lambda row: row["result_r"], reverse=True)


def _trade_summary_rows(trades: list[Any], reverse: bool) -> list[dict[str, Any]]:
    ordered = sorted(trades, key=lambda trade: as_float(value_of(trade, "result_r")), reverse=reverse)
    rows = []
    for trade in ordered[:5]:
        rows.append(
            {
                "name": f"{as_str(plain(value_of(trade, 'date')))} {as_str(value_of(trade, 'session'))} {as_str(value_of(trade, 'location'))}",
                "trades": 1,
                "win_rate": 100.0 if as_str(value_of(trade, "result")) == "TP1" else 0.0,
                "tp1_rate": 100.0 if as_str(value_of(trade, "result")) == "TP1" else 0.0,
                "sl_rate": 100.0 if as_str(value_of(trade, "result")) == "SL" else 0.0,
                "expectancy": as_float(value_of(trade, "result_r")),
                "result_r": as_float(value_of(trade, "result_r")),
            }
        )
    return rows


def _mistake_rows(trades: list[Any]) -> list[dict[str, Any]]:
    groups: dict[str, list[Any]] = defaultdict(list)
    for trade in trades:
        groups[as_str(value_of(trade, "mistake_type", "None")) or "None"].append(trade)
    rows = []
    for mistake, group in groups.items():
        losses = [trade for trade in group if as_float(value_of(trade, "result_r")) < 0]
        rows.append(
            {
                "mistake_type": mistake,
                "count": len(group),
                "loss_r": round(sum(as_float(value_of(trade, "result_r")) for trade in losses), 2),
                "win_rate": _rate(sum(1 for trade in group if as_str(value_of(trade, "result")) == "TP1"), len(group)),
            }
        )
    return rows


def calculate_dashboard(trades: list[Any]) -> dict[str, Any]:
    total = len(trades)
    tp1 = sum(1 for trade in trades if as_str(value_of(trade, "result")) == "TP1")
    be = sum(1 for trade in trades if as_str(value_of(trade, "result")) == "BE")
    sl = sum(1 for trade in trades if as_str(value_of(trade, "result")) == "SL")
    result_rs = [as_float(value_of(trade, "result_r")) for trade in trades]
    taken = [trade for trade in trades if as_str(value_of(trade, "trade_decision", "Taken")) == "Taken"]
    skipped = [trade for trade in trades if as_str(value_of(trade, "trade_decision", "Taken")) == "Skipped"]
    watched = [trade for trade in trades if as_str(value_of(trade, "trade_decision", "Taken")) == "Watched"]
    invalidated = [trade for trade in trades if as_str(value_of(trade, "trade_decision", "Taken")) == "Invalidated"]

    equity = 0.0
    curve = []
    ordered = sorted(trades, key=lambda trade: as_str(plain(value_of(trade, "date"))))
    for trade in ordered:
        equity += as_float(value_of(trade, "result_r"))
        curve.append({"date": as_str(plain(value_of(trade, "date"))), "equity": round(equity, 2)})

    return {
        "total_trades": total,
        "win_rate": _rate(tp1, total),
        "tp1_rate": _rate(tp1, total),
        "be_rate": _rate(be, total),
        "sl_rate": _rate(sl, total),
        "average_rr": round(sum(result_rs) / total, 2) if total else 0.0,
        "profit_factor": _profit_factor(trades),
        "expectancy": _expectancy(trades),
        "max_winning_streak": _max_streak(trades, winning=True),
        "max_losing_streak": _max_streak(trades, winning=False),
        "average_mfe": round(sum(as_float(value_of(trade, "mfe")) for trade in trades) / total, 2) if total else 0.0,
        "average_mae": round(sum(as_float(value_of(trade, "mae")) for trade in trades) / total, 2) if total else 0.0,
        "taken_count": len(taken),
        "skipped_count": len(skipped),
        "watched_count": len(watched),
        "invalidated_count": len(invalidated),
        "skipped_tp1_rate": _rate(sum(1 for trade in skipped if as_str(value_of(trade, "result")) == "TP1"), len(skipped)),
        "skipped_sl_rate": _rate(sum(1 for trade in skipped if as_str(value_of(trade, "result")) == "SL"), len(skipped)),
        "best_skipped_opportunities": _trade_summary_rows(skipped, reverse=True),
        "worst_taken_trades": _trade_summary_rows(taken, reverse=False),
        "top_mistakes": sorted(_mistake_rows(trades), key=lambda row: row["count"], reverse=True)[:5],
        "losses_by_mistake_type": sorted(_mistake_rows(trades), key=lambda row: row["loss_r"])[:5],
        "performance_curve": curve,
        "monthly_performance": _group_performance(trades, "month"),
        "session_performance": _group_performance(trades, "session"),
        "location_performance": _group_performance(trades, "location"),
        "poc_performance": _group_performance(
            [trade for trade in trades if as_str(value_of(trade, "location")) in {"POC", "VAH", "VAL", "Other"}],
            "location",
        ),
        "strategy_performance": _group_performance(
            [trade for trade in trades if value_of(trade, "strategy_version")],
            "strategy_version",
        ),
        "news_timing_performance": _group_performance(trades, "news_timing"),
        "detailed_session_performance": _group_performance(trades, "session"),
    }


def best_and_worst_conditions(trades: list[Any], fields: tuple[str, ...] = ("session", "location", "direction", "market_state")) -> dict[str, Any]:
    conditions = []
    for field in fields:
        for row in _group_performance(trades, field):
            conditions.append({"condition": field, **row})

    ordered_by_expectancy = sorted(conditions, key=lambda row: row["expectancy"], reverse=True)
    ordered_by_tp1 = sorted(conditions, key=lambda row: row["win_rate"], reverse=True)
    ordered_by_sl = sorted(conditions, key=lambda row: row["result_r"])

    return {
        "best_performing_conditions": ordered_by_expectancy[:8],
        "worst_performing_conditions": ordered_by_expectancy[-8:],
        "highest_tp1_conditions": ordered_by_tp1[:8],
        "highest_sl_conditions": ordered_by_sl[:8],
    }
