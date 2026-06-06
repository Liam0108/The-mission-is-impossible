from app.services.poc_risk import calculate_poc_risk, historical_poc_sl_rate


def test_poc_high_risk_logic():
    result = calculate_poc_risk({"location": "POC", "market_state": "Balanced", "distance_to_poc": 20})

    assert result["poc_risk_level"] == "High"
    assert result["poc_risk_message"] == "POC Risk: High"


def test_historical_sl_rate_near_poc():
    trades = [
        {"location": "POC", "poc_risk_level": "High", "result": "SL"},
        {"location": "POC", "poc_risk_level": "High", "result": "TP1"},
        {"location": "VAH", "poc_risk_level": "Low", "result": "TP1"},
    ]

    assert historical_poc_sl_rate(trades) == 50

