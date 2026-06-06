from app.schemas.trade import TradeCreate


def test_skipped_trade_can_be_saved_shape():
    trade = TradeCreate.model_validate(
        {
            "date": "2026-05-31",
            "instrument": "NQ",
            "data_type": "Backtest",
            "session": "NY_AM",
            "direction": "Long",
            "bias_15m": "Long",
            "market_state": "Balanced",
            "location": "POC",
            "liquidity_sweep": "Yes",
            "choch": "No",
            "lh_hl": "No",
            "fvg_reaction": "Weak",
            "volume_state": "Normal",
            "trade_decision": "Skipped",
            "skip_reason": "Near POC",
            "result": "Unknown",
        }
    )

    assert trade.trade_decision == "Skipped"
    assert trade.skip_reason == "Near POC"
    assert trade.result == "Unknown"


def test_trade_logger_clarity_fields_are_accepted():
    trade = TradeCreate.model_validate(
        {
            "date": "2026-06-03",
            "instrument": "NQ",
            "data_type": "Replay",
            "session": "NY_AM",
            "direction": "Short",
            "bias_15m": "Short",
            "market_state": "Imbalanced",
            "location": "VAH",
            "liquidity_sweep": "PDH/PDL",
            "choch": "5m",
            "lh_hl": "LH for Short",
            "fvg_reaction": "Strong",
            "volume_state": "High",
            "trade_decision": "Taken",
            "manual_quality": "A",
            "setup_type": "Fabio Short",
            "result": "TP1",
        }
    )

    assert trade.liquidity_sweep == "PDH/PDL"
    assert trade.choch == "5m"
    assert trade.lh_hl == "LH for Short"
    assert trade.manual_quality == "A"
    assert trade.setup_type == "Fabio Short"


def test_imported_broker_trade_fields_are_accepted():
    trade = TradeCreate.model_validate(
        {
            "date": "2026-06-03",
            "instrument": "NQ",
            "data_type": "Live",
            "session": "NY_AM",
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
            "entry_price": "19000.00",
            "exit_price": "19025.00",
            "stop_loss": "18975.00",
            "result": "TP1",
            "result_r": "1.00",
            "account": "SIM101",
            "broker_symbol": "NQM6",
            "quantity": "1",
            "entry_time": "2026-06-03T09:35:00Z",
            "exit_time": "2026-06-03T09:50:00Z",
            "gross_pnl": "500.00",
            "commission": "4.50",
            "net_pnl": "495.50",
            "broker_trade_id": "TV-123",
            "import_source": "Tradovate",
            "holding_time_minutes": "15",
            "imported": True,
            "review_status": "unreviewed",
        }
    )

    assert trade.imported is True
    assert trade.review_status == "unreviewed"
    assert trade.broker_trade_id == "TV-123"
    assert str(trade.net_pnl) == "495.50"
