from app.services.fast_entry import calculate_result_r, calculate_trade_distances, duplicate_last_trade_payload


def test_duplicate_last_trade_resets_execution_fields():
    last_trade = {
        "session": "NY_AM",
        "instrument": "NQ",
        "data_type": "Replay",
        "direction": "Long",
        "bias_15m": "Long",
        "market_state": "Imbalanced",
        "location": "VAH",
        "liquidity_sweep": "Yes",
        "choch": "Yes",
        "lh_hl": "Yes",
        "fvg_reaction": "Strong",
        "volume_state": "High",
        "entry_price": 18000,
        "stop_loss": 17980,
        "tp1_price": 18040,
        "result": "TP1",
        "notes": "Do not copy",
        "screenshot_path": "old.png",
    }

    duplicate = duplicate_last_trade_payload(last_trade, trade_date="2026-05-31")

    assert duplicate["session"] == "NY_AM"
    assert duplicate["instrument"] == "NQ"
    assert duplicate["entry_price"] is None
    assert duplicate["stop_loss"] is None
    assert duplicate["tp1_price"] is None
    assert duplicate["result"] == "NoTrade"
    assert duplicate["notes"] == ""
    assert duplicate["screenshot_path"] is None


def test_auto_calculations_for_fast_entry():
    distances = calculate_trade_distances("Long", 18000, 17980, 18040)

    assert distances["risk_distance"] == 20
    assert distances["reward_distance"] == 40
    assert distances["rr_ratio"] == 2
    assert calculate_result_r("TP1", distances["rr_ratio"]) == 2
    assert calculate_result_r("SL", distances["rr_ratio"]) == -1

