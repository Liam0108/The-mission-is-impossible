import random
from typing import Any

from app.services.management import _max_losing_streak
from app.services.normalization import as_float, value_of


def _max_drawdown(values: list[float]) -> float:
    equity = 0.0
    peak = 0.0
    drawdown = 0.0
    for value in values:
        equity += value
        peak = max(peak, equity)
        drawdown = min(drawdown, equity - peak)
    return abs(round(drawdown, 2))


def _risk_dollars(account_size: float, risk_per_trade: float, risk_mode: str) -> float:
    if risk_mode == "dollars":
        return max(0.0, risk_per_trade)
    return max(0.0, account_size * (risk_per_trade / 100))


def _risk_level(
    risk_percent: float,
    probability_daily_loss_limit: float,
    probability_account_drawdown_limit: float,
) -> str:
    if risk_percent <= 0.5 and probability_daily_loss_limit < 10 and probability_account_drawdown_limit < 10:
        return "safe"
    if risk_percent <= 1.0 and probability_daily_loss_limit < 25 and probability_account_drawdown_limit < 25:
        return "caution"
    return "dangerous"


def _percentile(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round((percentile / 100) * (len(ordered) - 1))))
    return round(ordered[index], 2)


def _daily_loss_hit(results: list[float], trades_per_day: int, daily_loss_limit: float) -> bool:
    trades_per_day = max(1, trades_per_day)
    for index in range(0, len(results), trades_per_day):
        if sum(results[index : index + trades_per_day]) <= -abs(daily_loss_limit):
            return True
    return False


def run_monte_carlo(
    trades: list[Any],
    simulations: int = 5000,
    account_size: float = 50000,
    risk_per_trade: float = 0.5,
    risk_mode: str = "percent",
    daily_loss_limit: float | None = None,
    account_drawdown_limit_percent: float = 5,
    trades_per_day: int = 3,
    seed: int | None = 42,
) -> dict[str, Any]:
    valid_simulations = max(1000, min(10000, int(simulations)))
    result_rs = [as_float(value_of(trade, "result_r")) for trade in trades if value_of(trade, "result_r") is not None]
    risk_amount = _risk_dollars(account_size, risk_per_trade, risk_mode)
    risk_percent = round((risk_amount / account_size) * 100, 3) if account_size else 0.0
    daily_limit = daily_loss_limit if daily_loss_limit is not None else account_size * 0.02
    account_drawdown_limit = account_size * (account_drawdown_limit_percent / 100)

    if not result_rs:
        return {
            "enabled": False,
            "message": "Not enough valid taken trades for Monte Carlo.",
            "sample_size": 0,
            "simulations": valid_simulations,
            "account_size": account_size,
            "risk_per_trade": risk_per_trade,
            "risk_mode": risk_mode,
            "risk_amount": risk_amount,
            "risk_percent": risk_percent,
            "daily_loss_limit": daily_limit,
            "account_drawdown_limit": account_drawdown_limit,
            "max_drawdown": 0.0,
            "average_drawdown": 0.0,
            "worst_drawdown": 0.0,
            "drawdown_p95": 0.0,
            "longest_losing_streak": 0,
            "probability_daily_loss_limit": 0.0,
            "probability_account_drawdown_limit": 0.0,
            "risk_level": "dangerous",
        }

    rng = random.Random(seed)
    sample_size = len(result_rs)
    drawdowns = []
    losing_streaks = []
    daily_hits = 0
    account_hits = 0

    for _ in range(valid_simulations):
        sampled_r = [rng.choice(result_rs) for _ in range(sample_size)]
        sampled_dollars = [value * risk_amount for value in sampled_r]
        drawdown = _max_drawdown(sampled_dollars)
        drawdowns.append(drawdown)
        losing_streaks.append(_max_losing_streak(sampled_r))
        if _daily_loss_hit(sampled_dollars, trades_per_day, daily_limit):
            daily_hits += 1
        if drawdown >= account_drawdown_limit:
            account_hits += 1

    probability_daily = round((daily_hits / valid_simulations) * 100, 1)
    probability_account = round((account_hits / valid_simulations) * 100, 1)

    return {
        "enabled": True,
        "message": "Monte Carlo uses only valid taken trades.",
        "sample_size": sample_size,
        "simulations": valid_simulations,
        "account_size": account_size,
        "risk_per_trade": risk_per_trade,
        "risk_mode": risk_mode,
        "risk_amount": round(risk_amount, 2),
        "risk_percent": risk_percent,
        "daily_loss_limit": round(daily_limit, 2),
        "account_drawdown_limit": round(account_drawdown_limit, 2),
        "max_drawdown": round(max(drawdowns), 2),
        "average_drawdown": round(sum(drawdowns) / len(drawdowns), 2),
        "worst_drawdown": round(max(drawdowns), 2),
        "drawdown_p95": _percentile(drawdowns, 95),
        "longest_losing_streak": max(losing_streaks),
        "probability_daily_loss_limit": probability_daily,
        "probability_account_drawdown_limit": probability_account,
        "risk_level": _risk_level(risk_percent, probability_daily, probability_account),
    }
