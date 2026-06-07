from app.schemas.trade import TradeCreate
from app.services.data_quality import classify_trade_quality


def imported_trade_payload() -> dict:
    return {
        "date": "2026-06-04",
        "instrument": "MNQ",
        "data_type": "Live",
        "session": "NY_PM",
        "direction": "Long",
        "bias_15m": "Neutral",
        "market_state": "Balanced",
        "location": "Other",
        "liquidity_sweep": "None",
        "choch": "None",
        "lh_hl": "None",
        "fvg_reaction": "None",
        "volume_state": "Normal",
        "trade_decision": "Taken",
        "entry_price": "30189",
        "exit_price": "30228",
        "stop_loss": None,
        "result": "TP1",
        "result_r": None,
        "data_quality": "incomplete",
        "broker_symbol": "MNQM6",
        "buy_price": "30189",
        "sell_price": "30228",
        "bought_time": "2026-06-04T20:08:41",
        "sold_time": "2026-06-04T19:53:10",
        "quantity": "2",
        "gross_pnl": "156",
        "net_pnl": "156",
        "broker_trade_id": "tradovate-test",
        "import_source": "Tradovate Closed Trades",
        "holding_time_minutes": "15.5",
        "holding_time_text": "15min 30sec",
        "imported": True,
        "review_status": "unreviewed",
    }


def test_tradovate_import_accepts_missing_result_r_and_broker_metadata():
    trade = TradeCreate.model_validate(imported_trade_payload())

    assert trade.instrument == "MNQ"
    assert trade.broker_symbol == "MNQM6"
    assert trade.result == "TP1"
    assert trade.result_r is None
    assert trade.imported is True
    assert trade.review_status == "unreviewed"
    assert str(trade.net_pnl) == "156"
    assert trade.holding_time_text == "15min 30sec"


def test_imported_trade_remains_incomplete_until_review_fields_and_stop_exist():
    quality = classify_trade_quality(imported_trade_payload())

    assert quality["data_quality"] == "incomplete"
    assert {"stop", "result_r", "setup_type", "manual_quality"}.issubset(
        set(quality["missing_fields"])
    )
    assert "regime_label" not in quality["missing_fields"]
    assert "notes" not in quality["missing_fields"]


def test_imported_trade_becomes_good_when_edge_lab_fields_and_r_are_complete():
    payload = {
        **imported_trade_payload(),
        "stop_loss": "30170",
        "result_r": "2.05",
        "setup_type": "Fabio Long",
        "manual_quality": "A",
    }

    quality = classify_trade_quality(payload)

    assert quality["data_quality"] == "good"
    assert quality["missing_fields"] == []
