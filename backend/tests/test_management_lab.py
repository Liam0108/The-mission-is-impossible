from app.services.management import compare_management_styles


def test_management_lab_warns_when_data_missing():
    result = compare_management_styles(
        [
            {
                "trade_decision": "Taken",
                "entry_price": 100,
                "stop_loss": 90,
                "tp1_price": 120,
                "result": "TP1",
                "result_r": 2,
                "mfe": 0,
                "mae": 0,
            }
        ]
    )

    assert result["baseline"]["eligible_trades"] == 0
    assert result["strategies"][0]["warning"] == "Not enough MFE/MAE or TP2 data to evaluate this rule."


def test_management_lab_compares_rules():
    result = compare_management_styles(
        [
            {
                "trade_decision": "Taken",
                "entry_price": 100,
                "stop_loss": 90,
                "tp1_price": 120,
                "tp2_price": 140,
                "result": "TP1",
                "result_r": 2,
                "mfe": 4,
                "mae": -0.2,
            }
        ]
    )

    assert result["enabled"] is True
    assert result["best_management_style"] is not None

