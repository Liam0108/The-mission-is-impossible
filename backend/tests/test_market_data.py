from datetime import datetime, timezone

from app.services import market_data as market_data_service
from app.services.market_data import (
    Candle,
    analyze_reference_label_mismatches,
    build_protected_structure_v2,
    build_structure_sequence,
    compare_reference_labels,
    detect_fvgs,
    detect_liquidity,
    detect_missing_rows,
    detect_structure,
    detect_structure_sweeps,
    detect_structure_v2,
    enrich_sweeps_with_structure,
    fetch_yahoo_market_data,
    parse_candle_csv,
    parse_yahoo_chart_response,
)


def candle(timestamp: str, open_: float, high: float, low: float, close: float) -> Candle:
    return Candle(
        symbol="NQ",
        timeframe="1m",
        timestamp=datetime.fromisoformat(timestamp),
        open=open_,
        high=high,
        low=low,
        close=close,
        volume=1000,
    )


def structure_swing(timestamp: str, kind: str, price: float, index: int) -> dict:
    return {
        "detected_id": f"swing-v2-{index}",
        "timestamp": timestamp,
        "symbol": "NQ",
        "timeframe": "1m",
        "kind": kind,
        "label": "Swing High" if kind == "swing_high" else "Swing Low",
        "price": price,
        "price_level": price,
        "reason": "",
        "candles_used": [],
        "confidence_score": 70,
        "structure_importance_score": 65,
    }


def test_csv_import_accepts_required_candle_columns():
    raw = """timestamp,open,high,low,close,volume
2026-01-02T09:30:00,100,101,99,100.5,1000
2026-01-02T09:31:00,100.5,102,100,101,1100
"""

    candles, summary = parse_candle_csv(raw, default_symbol="NQ", default_timeframe="1m")

    assert len(candles) == 2
    assert candles[0].symbol == "NQ"
    assert candles[0].timeframe == "1m"
    assert summary["valid_rows"] == 2


def test_tradingview_export_ignores_indicator_columns_and_maps_plot_volume():
    raw = """time,open,high,low,close,Plot,VWAP,Liquidity Pool,Custom Signal
2026-01-02T09:30:00,100,101,99,100.5,2500,100.2,PDH,bullish
2026-01-02T09:31:00,100.5,102,100,101,2600,100.4,,neutral
"""

    candles, summary = parse_candle_csv(raw, default_symbol="NQ", default_timeframe="1m")

    assert len(candles) == 2
    assert candles[0].timestamp == datetime.fromisoformat("2026-01-02T09:30:00")
    assert candles[0].volume == 2500
    assert {"source": "time", "target": "timestamp"} in summary["column_mapping"]
    assert {"source": "Plot", "target": "volume"} in summary["column_mapping"]
    assert "VWAP" in summary["ignored_columns"]
    assert {"source": "Liquidity Pool", "label_type": "Liquidity Grab"} in summary["reference_label_columns"]


def test_tradingview_indicator_columns_become_reference_labels():
    raw = """time,open,high,low,close,Volume,Structure HH,BOS Signal,CHOCH Marker,Liquidity Grab,FVG Zone,Premium Zone,VWAP
2026-01-02T09:30:00,100,101,99,100.5,2500,101,BOS,,false,,Premium,100.2
2026-01-02T09:31:00,100.5,102,100,101,2600,,false,CHOCH,100.25,bullish FVG,,100.4
"""

    candles, summary = parse_candle_csv(raw, default_symbol="NQ", default_timeframe="1m")

    assert len(candles) == 2
    assert {"source": "Structure HH", "label_type": "HH"} in summary["reference_label_columns"]
    assert {"source": "BOS Signal", "label_type": "BOS"} in summary["reference_label_columns"]
    assert {"source": "CHOCH Marker", "label_type": "CHOCH"} in summary["reference_label_columns"]
    assert {"source": "FVG Zone", "label_type": "FVG"} in summary["reference_label_columns"]
    assert "VWAP" in summary["ignored_columns"]
    labels = summary["reference_labels"]
    assert any(label["label_type"] == "HH" and label["price_level"] == 101 for label in labels)
    assert any(label["label_type"] == "BOS" and label["label_value"] == "BOS" for label in labels)
    assert any(label["label_type"] == "Liquidity Grab" and label["price_level"] == 100.25 for label in labels)
    assert any(label["label_type"] == "Premium" for label in labels)


def yahoo_chart_payload(symbol: str = "NQ=F") -> dict:
    return {
        "chart": {
            "result": [
                {
                    "meta": {"symbol": symbol},
                    "timestamp": [1780482600, 1780482660, 1780482720],
                    "indicators": {
                        "quote": [
                            {
                                "open": [30702.75, 30696.25, 30700.0],
                                "high": [30703.75, 30702.0, 30704.0],
                                "low": [30695.75, 30694.5, 30698.0],
                                "close": [30696.25, 30700.0, 30703.0],
                                "volume": [1000, 1200, 900],
                            }
                        ]
                    },
                }
            ],
            "error": None,
        }
    }


def test_yahoo_chart_response_maps_to_market_candles():
    candles = parse_yahoo_chart_response(yahoo_chart_payload(), "NQ=F", "1m")

    assert len(candles) == 3
    assert candles[0].symbol == "NQ=F"
    assert candles[0].timeframe == "1m"
    assert candles[0].timestamp == datetime.fromtimestamp(1780482600, timezone.utc)
    assert candles[0].raw_timestamp == "1780482600"
    assert candles[0].source_symbol == "NQ=F"
    assert candles[0].source_filename == "Yahoo Finance"
    assert candles[0].low == 30695.75


def test_yahoo_market_data_cache_prevents_repeat_download(monkeypatch, tmp_path):
    calls = 0

    def fake_download(symbol: str, timeframe: str, range_value: str) -> dict:
        nonlocal calls
        calls += 1
        assert symbol == "MNQ=F"
        assert timeframe == "5m"
        assert range_value == "5d"
        return yahoo_chart_payload("MNQ=F")

    monkeypatch.setattr(market_data_service, "YAHOO_CACHE_DIR", tmp_path)
    monkeypatch.setattr(market_data_service, "_download_yahoo_chart", fake_download)

    candles, metadata = fetch_yahoo_market_data("MNQ=F", timeframe="5m", range_value="5d")
    cached_candles, cached_metadata = fetch_yahoo_market_data("MNQ=F", timeframe="5m", range_value="5d")

    assert calls == 1
    assert len(candles) == len(cached_candles) == 3
    assert metadata["cached"] is False
    assert cached_metadata["cached"] is True
    assert cached_metadata["provider"] == "Yahoo Finance"
    assert "research only" in cached_metadata["delay_warning"]


def test_reference_label_comparison_reports_matches_misses_and_extras():
    reference_labels = [
        {
            "detected_id": "tv-1",
            "timestamp": "2026-01-02T09:30:00",
            "symbol": "NQ",
            "timeframe": "1m",
            "label_type": "HH",
            "label_value": "HH",
            "price_level": 101,
            "source_column": "Structure HH",
            "raw_value": "101",
        },
        {
            "detected_id": "tv-2",
            "timestamp": "2026-01-02T09:31:00",
            "symbol": "NQ",
            "timeframe": "1m",
            "label_type": "Liquidity Grab",
            "label_value": "grab",
            "price_level": 99,
            "source_column": "Liquidity Grab",
            "raw_value": "99",
        },
        {
            "detected_id": "tv-3",
            "timestamp": "2026-01-02T09:40:00",
            "symbol": "NQ",
            "timeframe": "1m",
            "label_type": "CHOCH",
            "label_value": "CHOCH",
            "price_level": None,
            "source_column": "CHOCH Marker",
            "raw_value": "CHOCH",
        },
    ]
    protected_structure = [
        {
            "detected_id": "structure-1",
            "source_swing_id": "swing-1",
            "timestamp": "2026-01-02T09:30:30",
            "symbol": "NQ",
            "timeframe": "1m",
            "side": "high",
            "structure_type": "HH",
            "price": 101.25,
            "structure_state": "Bullish",
            "leg_type": "impulse_leg",
            "protected_level_role": None,
            "near_reference_levels": [],
            "later_swept": False,
            "swept_by_event_id": None,
            "importance_score": 80,
            "reason": "",
            "caused_bos": True,
            "caused_choch": False,
            "created_displacement": True,
            "displacement_score": 80,
        }
    ]
    liquidity_events = [
        {
            "detected_id": "sweep-1",
            "timestamp": "2026-01-02T09:31:30",
            "symbol": "NQ",
            "timeframe": "1m",
            "session": "New York",
            "event_type": "sweep_below_low",
            "source": "session_low",
            "level": 99,
            "price": 98.5,
            "price_level": 99,
            "reason": "",
            "candles_used": [],
            "confidence_score": 64,
        }
    ]

    comparison = compare_reference_labels(reference_labels, protected_structure, [], liquidity_events, [], "1m")

    assert len(comparison["matches"]) == 2
    assert len(comparison["missed_tradingview_labels"]) == 1
    assert comparison["metrics"]["structure_match_rate"] == 100
    assert comparison["metrics"]["sweep_liquidity_grab_match_rate"] == 100
    assert comparison["metrics"]["bos_choch_match_rate"] == 0
    assert any(extra["label_type"] == "BOS" for extra in comparison["extra_market_lab_detections"])


def test_reference_mismatch_analysis_explains_examples_and_recommendations():
    reference_labels = [
        {
            "detected_id": "tv-1",
            "timestamp": "2026-01-02T09:30:00",
            "symbol": "NQ",
            "timeframe": "1m",
            "label_type": "HH",
            "label_value": "HH",
            "price_level": 101,
            "source_column": "Structure HH",
            "raw_value": "101",
            "original_csv_row_index": 2,
        },
        {
            "detected_id": "tv-2",
            "timestamp": "2026-01-02T09:31:00",
            "symbol": "NQ",
            "timeframe": "1m",
            "label_type": "Liquidity Grab",
            "label_value": "grab",
            "price_level": 99,
            "source_column": "Liquidity Grab",
            "raw_value": "99",
            "original_csv_row_index": 3,
        },
        {
            "detected_id": "tv-3",
            "timestamp": "2026-01-02T09:40:00",
            "symbol": "NQ",
            "timeframe": "1m",
            "label_type": "CHOCH",
            "label_value": "CHOCH",
            "price_level": None,
            "source_column": "CHOCH Marker",
            "raw_value": "CHOCH",
            "original_csv_row_index": 12,
        },
    ]
    protected_structure = [
        {
            "detected_id": "structure-1",
            "source_swing_id": "swing-1",
            "timestamp": "2026-01-02T09:30:30",
            "symbol": "NQ",
            "timeframe": "1m",
            "side": "high",
            "structure_type": "HH",
            "price": 101.25,
            "structure_state": "Bullish",
            "leg_type": "impulse_leg",
            "protected_level_role": None,
            "near_reference_levels": [],
            "later_swept": False,
            "swept_by_event_id": None,
            "importance_score": 80,
            "reason": "",
            "caused_bos": True,
            "caused_choch": False,
            "created_displacement": True,
            "displacement_score": 80,
            "original_csv_row_index": 2,
        }
    ]
    liquidity_events = [
        {
            "detected_id": "sweep-1",
            "timestamp": "2026-01-02T09:31:30",
            "symbol": "NQ",
            "timeframe": "1m",
            "session": "New York",
            "event_type": "sweep_below_low",
            "source": "session_low",
            "level": 99,
            "price": 98.5,
            "price_level": 99,
            "reason": "",
            "candles_used": [],
            "confidence_score": 64,
            "original_csv_row_index": 3,
        }
    ]
    comparison = compare_reference_labels(reference_labels, protected_structure, [], liquidity_events, [], "1m")

    analysis = analyze_reference_label_mismatches(reference_labels, protected_structure, [], liquidity_events, [], comparison, "1m")

    assert len(analysis["top_examples"]) <= 10
    assert any(example["status"] == "missed_tradingview_label" and example["label_type"] == "CHOCH" for example in analysis["top_examples"])
    assert any(example["status"] == "extra_market_lab_detection" and example["label_type"] == "BOS" for example in analysis["top_examples"])
    assert any(example["status"] == "matched_with_difference" and example["timestamp_difference_seconds"] == 30 for example in analysis["top_examples"])
    assert analysis["likely_causes"]
    assert analysis["recommended_detector_changes"]


def test_duplicate_candle_detection_skips_duplicate_timestamp():
    raw = """symbol,timeframe,timestamp,open,high,low,close,volume
NQ,1m,2026-01-02T09:30:00,100,101,99,100.5,1000
NQ,1m,2026-01-02T09:30:00,100.5,102,100,101,1100
"""

    candles, summary = parse_candle_csv(raw)

    assert len(candles) == 1
    assert summary["duplicate_rows"] == 1


def test_missing_row_detection_uses_timeframe_spacing():
    candles = [
        candle("2026-01-02T09:30:00", 100, 101, 99, 100),
        candle("2026-01-02T09:32:00", 100, 102, 99, 101),
    ]

    missing = detect_missing_rows(candles)

    assert len(missing) == 1
    assert missing[0]["timestamp"] == "2026-01-02T09:31:00"


def test_swing_detection_labels_hh_after_prior_swing_high():
    candles = [
        candle("2026-01-02T09:30:00", 100, 101, 98, 100),
        candle("2026-01-02T09:31:00", 100, 104, 99, 103),
        candle("2026-01-02T09:32:00", 103, 102, 97, 98),
        candle("2026-01-02T09:33:00", 98, 106, 99, 105),
        candle("2026-01-02T09:34:00", 105, 103, 98, 100),
    ]

    swings = detect_structure(candles)
    high_labels = [swing["label"] for swing in swings if swing["kind"] == "swing_high"]

    assert high_labels == ["Swing High", "HH"]


def test_swing_detector_v2_reduces_noise_and_explains_accepted_swings():
    candles = [
        candle("2026-01-02T09:30:00", 98, 100, 95, 99),
        candle("2026-01-02T09:31:00", 99, 103, 96, 102),
        candle("2026-01-02T09:32:00", 102, 101, 94, 95),
        candle("2026-01-02T09:33:00", 95, 104, 97, 103),
        candle("2026-01-02T09:34:00", 103, 102, 93, 94),
        candle("2026-01-02T09:35:00", 97, 112, 96, 111),
        candle("2026-01-02T09:36:00", 111, 106, 95, 96),
        candle("2026-01-02T09:37:00", 96, 105, 92, 103),
        candle("2026-01-02T09:38:00", 103, 110, 94, 109),
        candle("2026-01-02T09:39:00", 103, 104, 90, 91),
        candle("2026-01-02T09:40:00", 91, 108, 96, 107),
        candle("2026-01-02T09:41:00", 107, 107, 95, 96),
    ]

    swings_v1 = detect_structure(candles)
    swings_v2 = detect_structure_v2(candles, {"mode": "normal", "left_candles": 2, "right_candles": 2, "min_swing_distance": 8})

    assert len(swings_v1) > len(swings_v2)
    assert swings_v2
    assert all("Accepted by Swing V2 normal mode" in swing["reason"] for swing in swings_v2)
    assert all(len(swing["candles_used"]) == 5 for swing in swings_v2)
    assert all(0 <= swing["structure_importance_score"] <= 100 for swing in swings_v2)
    assert all("Structure importance" in swing["structure_importance_reason"] for swing in swings_v2)


def test_swing_detector_v2_honors_minimum_distance_between_same_side_swings():
    candles = [
        candle("2026-01-02T09:30:00", 100, 100, 94, 98),
        candle("2026-01-02T09:31:00", 98, 103, 96, 102),
        candle("2026-01-02T09:32:00", 102, 107, 97, 106),
        candle("2026-01-02T09:33:00", 106, 114, 98, 113),
        candle("2026-01-02T09:34:00", 113, 108, 96, 97),
        candle("2026-01-02T09:35:00", 97, 106, 95, 105),
        candle("2026-01-02T09:36:00", 105, 110, 96, 109),
        candle("2026-01-02T09:37:00", 109, 119, 97, 118),
        candle("2026-01-02T09:38:00", 118, 111, 96, 97),
        candle("2026-01-02T09:39:00", 97, 107, 95, 106),
    ]

    loose = detect_structure_v2(candles, {"mode": "aggressive", "left_candles": 2, "right_candles": 2, "min_swing_distance": 4})
    strict_distance = detect_structure_v2(candles, {"mode": "aggressive", "left_candles": 2, "right_candles": 2, "min_swing_distance": 8})

    loose_highs = [swing for swing in loose if swing["kind"] == "swing_high"]
    strict_highs = [swing for swing in strict_distance if swing["kind"] == "swing_high"]
    assert len(loose_highs) == 2
    assert len(strict_highs) == 1


def test_swing_debug_level_matches_source_candle_low_for_tradingview_example():
    raw = """timestamp,open,high,low,close,volume
2026-06-03T06:36:00+01:00,30712,30716,30707,30711,1000
2026-06-03T06:37:00+01:00,30710,30712,30700,30703,1050
2026-06-03T06:38:00+01:00,30702.75,30703.75,30695.75,30696.25,1500
2026-06-03T06:39:00+01:00,30698,30708,30699,30705,1200
2026-06-03T06:40:00+01:00,30704,30711,30701,30710,1100
"""
    candles, _summary = parse_candle_csv(raw, default_symbol="NQ", default_timeframe="1m", source_filename="NQ_2026-06-03.csv")

    swings = detect_structure_v2(candles, {"mode": "aggressive", "left_candles": 2, "right_candles": 2, "min_swing_distance": 0})
    example_swing = next(swing for swing in swings if swing["original_timestamp"] == "2026-06-03T06:38:00+01:00")

    assert example_swing["kind"] == "swing_low"
    assert example_swing["level_source"] == "low"
    assert example_swing["price_level"] == 30695.75
    assert example_swing["displayed_level"] == 30695.75
    assert example_swing["candle_low"] == 30695.75
    assert example_swing["swing_source_low"] == 30695.75
    assert example_swing["original_csv_row_index"] == 4
    assert example_swing["price_level"] != 30666.5


def test_structure_sequence_tracks_state_and_protected_levels():
    swings = [
        structure_swing("2026-01-02T09:30:00", "swing_high", 100, 1),
        structure_swing("2026-01-02T09:31:00", "swing_low", 90, 2),
        structure_swing("2026-01-02T09:32:00", "swing_high", 110, 3),
        structure_swing("2026-01-02T09:33:00", "swing_low", 95, 4),
        structure_swing("2026-01-02T09:34:00", "swing_high", 108, 5),
        structure_swing("2026-01-02T09:35:00", "swing_low", 85, 6),
    ]

    nodes = build_structure_sequence(swings)

    assert [node["structure_type"] for node in nodes] == ["HH", "HL", "HH", "HL", "LH", "LL"]
    assert nodes[3]["structure_state"] == "Bullish"
    assert nodes[3]["protected_level_role"] == "protected_low"
    assert nodes[4]["structure_state"] == "Transition"
    assert nodes[5]["structure_state"] == "Bearish"
    assert nodes[4]["protected_level_role"] == "protected_high"


def test_protected_structure_v2_keeps_only_meaningful_structure_nodes():
    swings = [
        structure_swing("2026-01-02T09:30:00", "swing_high", 100, 1),
        structure_swing("2026-01-02T09:31:00", "swing_low", 90, 2),
        structure_swing("2026-01-02T09:32:00", "swing_high", 99, 3),
        structure_swing("2026-01-02T09:33:00", "swing_low", 91, 4),
        structure_swing("2026-01-02T09:34:00", "swing_high", 112, 5),
        structure_swing("2026-01-02T09:35:00", "swing_low", 97, 6),
        structure_swing("2026-01-02T09:36:00", "swing_low", 85, 7),
    ]
    candles = [
        candle("2026-01-02T09:30:00", 99, 100, 97, 99),
        candle("2026-01-02T09:31:00", 99, 100, 90, 91),
        candle("2026-01-02T09:32:00", 95, 99, 90, 94),
        candle("2026-01-02T09:33:00", 100, 101, 91, 94),
        candle("2026-01-02T09:34:00", 94, 112, 93, 111),
        candle("2026-01-02T09:35:00", 111, 112, 97, 110),
        candle("2026-01-02T09:36:00", 110, 111, 85, 86),
    ]

    nodes = build_protected_structure_v2(swings, candles)
    kept_prices = [node["price"] for node in nodes]

    assert 99 not in kept_prices
    assert any(node["caused_bos"] and node["structure_type"] == "HH" and node["price"] == 112 for node in nodes)
    assert any(node["caused_choch"] and node["structure_type"] == "LL" and node["price"] == 85 for node in nodes)
    assert any(node["protected_level_role"] == "protected_low" for node in nodes)
    assert any(node["protected_level_role"] == "protected_high" for node in nodes)
    assert all(
        node["caused_bos"] or node["caused_choch"] or node["created_displacement"] or node["protected_level_role"]
        for node in nodes
    )


def test_sweep_importance_links_to_prior_protected_structure_node():
    swings = [
        structure_swing("2026-01-02T09:30:00", "swing_high", 100, 1),
        structure_swing("2026-01-02T09:31:00", "swing_low", 90, 2),
        structure_swing("2026-01-02T09:32:00", "swing_high", 110, 3),
        structure_swing("2026-01-02T09:33:00", "swing_low", 95, 4),
    ]
    raw_sweep = {
        "detected_id": "sweep-1",
        "timestamp": "2026-01-02T09:40:00",
        "symbol": "NQ",
        "timeframe": "1m",
        "session": "New York",
        "event_type": "sweep_below_low",
        "source": "session_low",
        "level": 95,
        "price": 94,
        "price_level": 95,
        "reason": "test sweep",
        "candles_used": [],
        "confidence_score": 64,
    }

    nodes = build_structure_sequence(swings, liquidity_events=[raw_sweep])
    enriched = enrich_sweeps_with_structure([raw_sweep], nodes)
    protected_low = next(node for node in nodes if node["price"] == 95)

    assert protected_low["later_swept"] is True
    assert enriched[0]["swept_level_type"] == "protected_low"
    assert enriched[0]["swept_structure_node_id"] == protected_low["detected_id"]
    assert enriched[0]["swept_timeframe"] == "1m"
    assert enriched[0]["sweep_importance_score"] >= protected_low["importance_score"] * 0.5


def test_structure_sweep_detector_finds_pierce_and_close_back():
    swings = [
        structure_swing("2026-01-02T09:30:00", "swing_high", 100, 1),
        structure_swing("2026-01-02T09:31:00", "swing_low", 90, 2),
        structure_swing("2026-01-02T09:32:00", "swing_high", 110, 3),
        structure_swing("2026-01-02T09:33:00", "swing_low", 95, 4),
    ]
    nodes = build_structure_sequence(swings)
    candles = [
        candle("2026-01-02T09:40:00", 96, 98, 93.5, 96),
        candle("2026-01-02T09:41:00", 111, 112.5, 108, 109),
    ]

    sweeps = detect_structure_sweeps(candles, nodes, min_node_importance=20, min_pierce_size=0.25)

    low_sweep = next(event for event in sweeps if event["direction"] == "below")
    high_sweep = next(event for event in sweeps if event["direction"] == "above")
    assert low_sweep["swept_node_type"] == "protected low"
    assert low_sweep["swept_structure_type"] == "HL"
    assert low_sweep["swept_node_price"] == 95
    assert low_sweep["pierce_distance"] == 1.5
    assert low_sweep["close_back_distance"] == 1
    assert high_sweep["swept_node_type"] == "HH"
    assert high_sweep["pierce_distance"] == 2.5
    assert high_sweep["close_back_distance"] == 1


def test_structure_sweep_detector_honors_filters():
    swings = [
        structure_swing("2026-01-02T09:30:00", "swing_high", 100, 1),
        structure_swing("2026-01-02T09:31:00", "swing_low", 90, 2),
        structure_swing("2026-01-02T09:32:00", "swing_high", 110, 3),
        structure_swing("2026-01-02T09:33:00", "swing_low", 95, 4),
    ]
    nodes = build_structure_sequence(swings)
    candles = [candle("2026-01-02T10:40:00", 96, 98, 94.8, 96)]

    assert detect_structure_sweeps(candles, nodes, min_node_importance=95) == []
    assert detect_structure_sweeps(candles, nodes, min_node_importance=50, max_age_minutes=10) == []
    assert detect_structure_sweeps(candles, nodes, min_node_importance=50, min_pierce_size=0.5) == []


def test_sweep_detection_finds_previous_day_high_sweep():
    candles = [
        candle("2026-01-01T09:30:00", 95, 100, 90, 96),
        candle("2026-01-01T09:31:00", 96, 99, 92, 95),
        candle("2026-01-02T09:30:00", 99, 101, 97, 99.5),
    ]

    events = detect_liquidity(candles)

    assert any(event["source"] == "previous_day_high" and event["event_type"] == "sweep_above_high" for event in events)


def test_fvg_detection_marks_return_to_bullish_gap():
    candles = [
        candle("2026-01-02T09:30:00", 100, 100, 99, 99.5),
        candle("2026-01-02T09:31:00", 99.5, 101, 99, 100.5),
        candle("2026-01-02T09:32:00", 102, 103, 102, 102.5),
        candle("2026-01-02T09:33:00", 102.5, 103, 101.5, 102),
    ]

    fvgs = detect_fvgs(candles)

    assert fvgs[0]["fvg_type"] == "bullish"
    assert fvgs[0]["gap_size"] == 2
    assert fvgs[0]["returned"] is True
