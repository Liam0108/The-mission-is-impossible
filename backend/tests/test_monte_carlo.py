from app.services.data_quality import valid_taken_trades
from app.services.monte_carlo import run_monte_carlo
from sample_data import EXPECTED_SAMPLE_OUTPUTS, SAMPLE_TRADES_30


def test_monte_carlo_uses_valid_taken_result_r_sample():
    expected = EXPECTED_SAMPLE_OUTPUTS["risk"]
    result = run_monte_carlo(
        valid_taken_trades(SAMPLE_TRADES_30),
        simulations=1000,
        account_size=expected["account_size"],
        risk_per_trade=0.5,
        risk_mode="percent",
        daily_loss_limit=1000,
        account_drawdown_limit_percent=5,
        trades_per_day=3,
        seed=7,
    )

    assert result["enabled"] is True
    assert result["sample_size"] == expected["sample_size"]
    assert result["risk_amount"] == expected["risk_amount"]
    assert result["max_drawdown"] == expected["max_drawdown"]
    assert result["average_drawdown"] == expected["average_drawdown"]
    assert result["worst_drawdown"] == expected["worst_drawdown"]
    assert result["drawdown_p95"] == expected["drawdown_p95"]
    assert result["longest_losing_streak"] == expected["longest_losing_streak"]
    assert result["probability_daily_loss_limit"] == expected["probability_daily_loss_limit"]
    assert result["probability_account_drawdown_limit"] == expected["probability_account_drawdown_limit"]
    assert result["risk_level"] == expected["risk_level"]


def test_monte_carlo_reports_disabled_without_valid_taken_trades():
    result = run_monte_carlo([], simulations=1000, account_size=50000, risk_per_trade=0.5)

    assert result["enabled"] is False
    assert result["sample_size"] == 0
    assert result["message"] == "Not enough valid taken trades for Monte Carlo."
