from app.services.data_quality import valid_taken_trades
from app.services.management import compare_management_styles
from sample_data import EXPECTED_SAMPLE_OUTPUTS, SAMPLE_TRADES_30


def _strategy(result, name):
    return next(row for row in result["strategies"] if row["name"] == name)


def test_management_rules_match_sample_expected_outputs():
    result = compare_management_styles(valid_taken_trades(SAMPLE_TRADES_30))
    expected = EXPECTED_SAMPLE_OUTPUTS["management"]
    best = _strategy(result, expected["best_rule"])

    assert result["baseline"]["eligible_trades"] == expected["eligible_trades"]
    assert result["best_management_style"] == expected["best_rule"]
    assert best["total_r"] == expected["best_total_r"]
    assert best["average_r"] == expected["best_average_r"]
    assert best["profit_factor"] == expected["best_profit_factor"]
    assert best["max_drawdown"] == expected["best_max_drawdown"]


def test_management_regime_grouping_finds_ny_open_best_rule():
    result = compare_management_styles(valid_taken_trades(SAMPLE_TRADES_30))
    expected = EXPECTED_SAMPLE_OUTPUTS["management"]
    ny_open = next(
        row
        for row in result["regime_comparison"]
        if row["group_field"] == "session" and row["group_value"] == "NY_Open"
    )

    assert ny_open["sample_size"] == expected["ny_open_sample"]
    assert ny_open["best_rule"] == expected["ny_open_best_rule"]
    assert ny_open["best_total_r"] == expected["ny_open_best_total_r"]
