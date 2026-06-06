from app.services.analytics import calculate_dashboard
from app.services.data_quality import valid_taken_trades
from sample_data import EXPECTED_SAMPLE_OUTPUTS, SAMPLE_TRADES_30


def test_dashboard_analytics_use_sample_valid_taken_trades():
    valid = valid_taken_trades(SAMPLE_TRADES_30)
    result = calculate_dashboard(valid)
    expected = EXPECTED_SAMPLE_OUTPUTS["analytics"]

    assert result["total_trades"] == expected["total_trades"]
    assert result["win_rate"] == expected["win_rate"]
    assert result["average_rr"] == expected["average_r"]
    assert result["profit_factor"] == expected["profit_factor"]
    assert result["max_losing_streak"] == expected["max_losing_streak"]
    assert result["performance_curve"][-1]["equity"] == expected["final_equity_r"]
