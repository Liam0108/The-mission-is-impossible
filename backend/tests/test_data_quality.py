from app.services.data_quality import classify_trade_quality, data_quality_dashboard, valid_taken_trades
from sample_data import BAD_TAKEN_TRADES, EXPECTED_SAMPLE_OUTPUTS, GOOD_TAKEN_TRADES, INCOMPLETE_TAKEN_TRADES, SAMPLE_TRADES_30


def test_data_quality_classifies_good_incomplete_and_bad_trades():
    assert classify_trade_quality(GOOD_TAKEN_TRADES[0])["data_quality"] == "good"

    incomplete = classify_trade_quality(INCOMPLETE_TAKEN_TRADES[0])
    assert incomplete["data_quality"] == "incomplete"
    assert "entry" in incomplete["missing_fields"]

    bad = classify_trade_quality(BAD_TAKEN_TRADES[0])
    assert bad["data_quality"] == "bad"
    assert "result must be TP1, BE, or SL" in bad["warnings"]


def test_data_quality_dashboard_counts_sample_dataset():
    result = data_quality_dashboard(SAMPLE_TRADES_30)
    expected = EXPECTED_SAMPLE_OUTPUTS["data_quality"]

    assert result["total_records"] == expected["total_records"]
    assert result["taken_records"] == expected["taken_records"]
    assert result["valid_taken_trades"] == expected["valid_taken_trades"]
    assert result["good"] == expected["good"]
    assert result["incomplete"] == expected["incomplete"]
    assert result["bad"] == expected["bad"]
    assert {row["field"] for row in result["missing_field_warnings"]} == {"entry", "stop", "result", "15m_bias"}


def test_valid_taken_trades_only_returns_good_taken_records():
    valid = valid_taken_trades(SAMPLE_TRADES_30)

    assert len(valid) == EXPECTED_SAMPLE_OUTPUTS["data_quality"]["valid_taken_trades"]
    assert all(trade["trade_decision"] == "Taken" for trade in valid)
    assert all(classify_trade_quality(trade)["data_quality"] == "good" for trade in valid)
