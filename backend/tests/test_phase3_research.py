from app.services.daily_score import trading_scores
from app.services.edge_discovery import discover_edges
from app.services.research import bias_alignment_analytics, news_analytics, session_refinement_analytics, strategy_version_analytics
from app.services.review import review_analytics
from app.services.screenshot_library import filter_screenshots


def _trade(**overrides):
    base = {
        "id": "1",
        "date": "2026-05-31",
        "session": "NY_Open",
        "direction": "Long",
        "daily_bias": "Bullish",
        "weekly_bias": "Bullish",
        "monthly_bias": "Neutral",
        "location": "VAH",
        "liquidity_sweep": "Yes",
        "choch": "Yes",
        "fvg_reaction": "Strong",
        "volume_state": "High",
        "market_state": "Imbalanced",
        "trade_decision": "Taken",
        "strategy_version": "Fabio_V2",
        "result": "TP1",
        "result_r": 2,
        "mistake_type": "None",
        "discipline_score": 9,
        "execution_score": 8,
        "emotion_score": 7,
        "high_impact_news": "No",
        "news_timing": "No News",
        "news_type": None,
        "screenshot_path": "uploads/example.png",
        "screenshot_tags": "Winner,VAH,Sweep",
        "screenshot_favorite": True,
        "screenshot_bookmarked": False,
        "screenshot_notes": "clean setup",
        "lessons_learned": "waited for confirmation",
        "setup_score": 86,
    }
    base.update(overrides)
    return base


def test_screenshot_library_filters_by_tag_and_score():
    rows = filter_screenshots(
        [_trade(), _trade(id="2", screenshot_tags="Loser,POC", setup_score=45, location="POC")],
        tag="Winner",
        score_min=80,
    )

    assert len(rows) == 1
    assert rows[0]["trade_id"] == "1"
    assert rows[0]["screenshot_favorite"] is True


def test_review_analytics_finds_expensive_mistake():
    result = review_analytics(
        [
            _trade(mistake_type="FOMO", result="SL", result_r=-1),
            _trade(id="2", mistake_type="FOMO", result="SL", result_r=-2),
            _trade(id="3", mistake_type="None", result="TP1", result_r=2),
        ]
    )

    assert result["top_mistakes"][0]["mistake_type"] == "FOMO"
    assert result["most_expensive_mistakes"][0]["loss_r"] == -3


def test_daily_score_outputs_overall_score():
    result = trading_scores([_trade(), _trade(id="2", emotion_score=5, result_r=-1, mistake_type="Moved Stop")])

    assert result["daily"][0]["overall_score"] > 0
    assert result["daily"][0]["risk_control"] < 100


def test_market_context_news_session_and_strategy_reports():
    trades = [
        _trade(),
        _trade(id="2", direction="Short", daily_bias="Bullish", result="SL", result_r=-1, news_timing="During News", news_type="FOMC"),
    ]

    assert bias_alignment_analytics(trades)["daily_bias"][0]["trades"] >= 1
    assert news_analytics(trades)["sl_rate_during_news"] == 100
    assert strategy_version_analytics(trades)["versions"][0]["name"] == "Fabio_V2"
    assert session_refinement_analytics(trades)["best_session"]["name"] == "NY_Open"


def test_edge_discovery_finds_best_conditions():
    result = discover_edges([_trade(id=str(index)) for index in range(4)], min_sample=3)

    assert result["top_best_conditions"]
    assert result["top_best_conditions"][0]["confidence"] == "Low"

