from typing import Any, Optional

from app.services.normalization import as_float, as_str, value_of


def _profit_factor(results: list[float]) -> float:
    gross_profit = sum(max(result, 0) for result in results)
    gross_loss = abs(sum(min(result, 0) for result in results))
    if gross_loss == 0:
        return round(gross_profit, 2) if gross_profit else 0.0
    return round(gross_profit / gross_loss, 2)


def _max_losing_streak(results: list[float]) -> int:
    streak = 0
    best = 0
    for result in results:
        if result < 0:
            streak += 1
            best = max(best, streak)
        else:
            streak = 0
    return best


def _max_drawdown(results: list[float]) -> float:
    equity = 0.0
    peak = 0.0
    drawdown = 0.0
    for result in results:
        equity += result
        peak = max(peak, equity)
        drawdown = min(drawdown, equity - peak)
    return round(drawdown, 2)


def _tp_r(trade: Any, field: str) -> Optional[float]:
    entry = value_of(trade, "entry_price")
    stop = value_of(trade, "stop_loss")
    target = value_of(trade, field)
    if entry is None or stop is None or target is None:
        return None
    risk = abs(as_float(entry) - as_float(stop))
    if risk == 0:
        return None
    return round(abs(as_float(target) - as_float(entry)) / risk, 2)


def _has_excursion_data(trade: Any) -> bool:
    return value_of(trade, "mfe") is not None and value_of(trade, "mae") is not None and not (
        as_float(value_of(trade, "mfe")) == 0 and as_float(value_of(trade, "mae")) == 0
    )


def _base_loss_or_result(trade: Any) -> float:
    if as_str(value_of(trade, "result")) == "SL":
        return -1.0
    return as_float(value_of(trade, "result_r"))


def _rule_results(
    trades: list[Any],
    partial_exit_percent: float,
    tp2_enabled: bool,
    assumed_tp2_price: Optional[float] = None,
) -> dict[str, list[float]]:
    partial = max(0.0, min(1.0, partial_exit_percent / 100))
    runner = 1 - partial
    results = {
        "TP1 then move stop to BE": [],
        "TP1 then keep original SL": [],
        "TP1 then trail using MFE threshold": [],
        "TP1 partial exit then hold TP2": [],
        "Exit full position at TP1": [],
    }

    for trade in trades:
        tp1_r = _tp_r(trade, "tp1_price") or 1.0
        tp2_r = _tp_r(trade, "tp2_price")
        if tp2_r is None and assumed_tp2_price is not None:
            entry = value_of(trade, "entry_price")
            stop = value_of(trade, "stop_loss")
            risk = abs(as_float(entry) - as_float(stop))
            tp2_r = round(abs(assumed_tp2_price - as_float(entry)) / risk, 2) if risk else None
        mfe = as_float(value_of(trade, "mfe"))
        mae = as_float(value_of(trade, "mae"))
        reached_tp1 = as_str(value_of(trade, "result")) == "TP1" or mfe >= tp1_r

        if not reached_tp1:
            fallback = _base_loss_or_result(trade)
            for key in results:
                results[key].append(fallback)
            continue

        results["TP1 then move stop to BE"].append(round(partial * tp1_r, 2))
        keep_sl_runner = -1.0 if mae <= -1 else min(mfe, tp1_r)
        results["TP1 then keep original SL"].append(round(partial * tp1_r + runner * keep_sl_runner, 2))
        trail_runner = 0.5 if mfe >= max(tp1_r * 1.5, tp1_r + 0.5) else 0.0
        results["TP1 then trail using MFE threshold"].append(round(partial * tp1_r + runner * trail_runner, 2))
        if tp2_enabled and tp2_r is not None and mfe >= tp2_r:
            tp2_runner = tp2_r
        elif mae <= -1:
            tp2_runner = -1.0
        else:
            tp2_runner = 0.0
        results["TP1 partial exit then hold TP2"].append(round(partial * tp1_r + runner * tp2_runner, 2))
        results["Exit full position at TP1"].append(round(tp1_r, 2))

    return results


def _summarize_rule(name: str, results: list[float], warning: Optional[str] = None) -> dict[str, Any]:
    total = round(sum(results), 2)
    count = len(results)
    return {
        "name": name,
        "total_r": total,
        "average_r": round(total / count, 2) if count else 0.0,
        "win_rate": round((sum(1 for result in results if result > 0) / count) * 100, 1) if count else 0.0,
        "max_drawdown": _max_drawdown(results),
        "max_losing_streak": _max_losing_streak(results),
        "profit_factor": _profit_factor(results),
        "sample_size": count,
        "warning": warning,
    }


def compare_management_styles(
    trades: list[Any],
    partial_exit_percent: float = 50,
    be_after_tp1: bool = True,
    tp2_enabled: bool = True,
    tp2_price: Optional[float] = None,
) -> dict[str, Any]:
    candidates = [
        trade
        for trade in trades
        if as_str(value_of(trade, "trade_decision", "Taken")) == "Taken"
        and value_of(trade, "entry_price") is not None
        and value_of(trade, "stop_loss") is not None
        and value_of(trade, "tp1_price") is not None
    ]
    eligible = [trade for trade in candidates if _has_excursion_data(trade)]
    warning = None
    if len(eligible) < len(candidates) or not eligible:
        warning = "Not enough MFE/MAE or TP2 data to evaluate this rule."

    rule_results = _rule_results(eligible, partial_exit_percent, tp2_enabled, tp2_price)
    rule_warnings = {
        name: warning
        for name in rule_results
        if warning
        or (
            name == "TP1 partial exit then hold TP2"
            and tp2_price is None
            and not any(_tp_r(trade, "tp2_price") for trade in eligible)
        )
    }
    rows = [_summarize_rule(name, results, rule_warnings.get(name)) for name, results in rule_results.items()]
    best = max(rows, key=lambda row: row["total_r"], default=None)
    return {
        "enabled": True,
        "assumptions": {
            "partial_exit_percent": partial_exit_percent,
            "be_after_tp1": be_after_tp1,
            "tp2_enabled": tp2_enabled,
            "tp2_price": tp2_price,
        },
        "baseline": {"trades": len(trades), "eligible_trades": len(eligible)},
        "best_management_style": best["name"] if best else None,
        "strategies": rows,
        "regime_comparison": compare_management_by_regime(
            trades,
            partial_exit_percent=partial_exit_percent,
            tp2_enabled=tp2_enabled,
            tp2_price=tp2_price,
        ),
    }


def compare_management_by_regime(
    trades: list[Any],
    partial_exit_percent: float = 50,
    tp2_enabled: bool = True,
    tp2_price: Optional[float] = None,
    group_fields: tuple[str, ...] = (
        "market_state",
        "regime_label",
        "session",
        "location",
        "poc_risk_level",
        "news_timing",
        "strategy_version",
    ),
) -> list[dict[str, Any]]:
    rows = []
    candidates = [
        trade
        for trade in trades
        if as_str(value_of(trade, "trade_decision", "Taken")) == "Taken"
        and value_of(trade, "entry_price") is not None
        and value_of(trade, "stop_loss") is not None
        and value_of(trade, "tp1_price") is not None
        and _has_excursion_data(trade)
    ]

    for field in group_fields:
        groups: dict[str, list[Any]] = {}
        for trade in candidates:
            value = as_str(value_of(trade, field)) or "Unknown"
            groups.setdefault(value, []).append(trade)

        for value, group in groups.items():
            rule_results = _rule_results(group, partial_exit_percent, tp2_enabled, tp2_price)
            strategies = [_summarize_rule(name, results) for name, results in rule_results.items()]
            best = max(strategies, key=lambda row: row["total_r"], default=None)
            rows.append(
                {
                    "group_field": field,
                    "group_value": value,
                    "sample_size": len(group),
                    "best_rule": best["name"] if best else None,
                    "best_total_r": best["total_r"] if best else 0.0,
                    "best_average_r": best["average_r"] if best else 0.0,
                    "best_profit_factor": best["profit_factor"] if best else 0.0,
                    "strategies": strategies,
                }
            )

    return sorted(rows, key=lambda row: (row["group_field"], -row["sample_size"], -row["best_total_r"]))
