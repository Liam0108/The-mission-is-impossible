from app.services.analytics import calculate_dashboard
from app.services.probability import calculate_historical_probabilities
from app.services.scoring import calculate_setup_score


def test_scoring_grades_high_quality_setup():
    setup = {
        "session": "NY_AM",
        "direction": "Long",
        "bias_15m": "Long",
        "market_state": "Imbalanced",
        "location": "VAH",
        "liquidity_sweep": "Yes",
        "choch": "Yes",
        "lh_hl": "Yes",
        "fvg_reaction": "Strong",
        "volume_state": "High",
        "planned_rr": 2.0,
    }

    result = calculate_setup_score(setup)

    assert result["setup_score"] == 100
    assert result["trade_grade"] == "A+"


def test_probability_uses_similar_historical_frequency():
    setup = {
        "session": "NY_AM",
        "location": "VAH",
        "liquidity_sweep": "Yes",
        "choch": "Yes",
        "lh_hl": "Yes",
        "fvg_reaction": "Strong",
        "volume_state": "High",
    }
    trades = []
    for index in range(31):
        trades.append({**setup, "id": f"tp1-{index}", "date": "2026-01-01", "result": "TP1", "result_r": 1.0})
    for index in range(6):
        trades.append({**setup, "id": f"be-{index}", "date": "2026-01-02", "result": "BE", "result_r": 0.0})
        trades.append({**setup, "id": f"sl-{index}", "date": "2026-01-03", "result": "SL", "result_r": -1.0})

    result = calculate_historical_probabilities(setup, trades)

    assert result["sample_size"] == 43
    assert result["tp1_probability"] == 72.1
    assert result["be_probability"] == 14.0
    assert result["sl_probability"] == 14.0
    assert result["confidence_level"] == "High"


def test_dashboard_statistics():
    trades = [
        {"date": "2026-01-01", "session": "NY_AM", "location": "VAH", "result": "TP1", "result_r": 2, "mfe": 2.5, "mae": -0.5},
        {"date": "2026-01-02", "session": "NY_AM", "location": "POC", "result": "BE", "result_r": 0, "mfe": 1.0, "mae": -0.4},
        {"date": "2026-01-03", "session": "London", "location": "VAL", "result": "SL", "result_r": -1, "mfe": 0.3, "mae": -1.0},
    ]

    result = calculate_dashboard(trades)

    assert result["total_trades"] == 3
    assert result["tp1_rate"] == 33.3
    assert result["profit_factor"] == 2.0
    assert result["expectancy"] == 0.33
    assert result["max_winning_streak"] == 1
    assert result["max_losing_streak"] == 1
