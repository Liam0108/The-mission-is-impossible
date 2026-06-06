from app.services.probability import search_similar_setups, similarity_score


def test_similarity_engine_returns_weighted_ranking():
    setup = {
        "session": "NY_AM",
        "direction": "Long",
        "bias_15m": "Long",
        "market_state": "Imbalanced",
        "regime_label": "Trend Up",
        "location": "VAH",
        "liquidity_sweep": "Yes",
        "choch": "Yes",
        "lh_hl": "Yes",
        "fvg_reaction": "Strong",
        "volume_state": "High",
        "trade_decision": "Taken",
    }
    close_match = {**setup, "id": "a", "date": "2026-05-01", "result": "TP1", "result_r": 2, "mfe": 2.5, "mae": -0.5}
    weaker_match = {
        **setup,
        "id": "b",
        "date": "2026-05-02",
        "location": "POC",
        "choch": "No",
        "result": "SL",
        "result_r": -1,
        "mfe": 0.2,
        "mae": -1,
    }

    result = search_similar_setups(setup, [weaker_match, close_match])

    assert similarity_score(setup, close_match) == 100
    assert result["most_similar_trades"][0]["id"] == "a"
    assert result["tp1_probability"] == 50
