from __future__ import annotations

import csv
import io
import json
import re
from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone
from itertools import groupby
from operator import attrgetter
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlencode, quote
from urllib.request import Request, urlopen


SUPPORTED_TIMEFRAMES = {"1m": 1, "5m": 5}
YAHOO_FINANCE_SYMBOLS = {"NQ=F", "MNQ=F", "GC=F"}
YAHOO_FINANCE_INTERVALS = {"1m": "1m", "5m": "5m"}
YAHOO_FINANCE_DEFAULT_RANGES = {"1m": "5d", "5m": "1mo"}
YAHOO_FINANCE_DELAY_WARNING = "Yahoo Finance futures data is delayed and for research only. Do not use it for live execution."
YAHOO_CACHE_DIR = Path(__file__).resolve().parents[2] / "data" / "yahoo_cache"
REQUIRED_CANDLE_FIELDS = ("timestamp", "open", "high", "low", "close")
TIME_COLUMN_ALIASES = ("timestamp", "time")
VOLUME_COLUMN_ALIASES = ("volume", "plot")
SWING_MODE_THRESHOLDS = {
    "aggressive": 40,
    "normal": 55,
    "strict": 70,
}
STRUCTURE_LEVEL_TOLERANCE = 4.0
REFERENCE_LABEL_TIME_TOLERANCE_MULTIPLIER = 2


REFERENCE_LABEL_PATTERNS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("HH", ("HH", "HIGHER_HIGH", "HIGHER HIGH")),
    ("HL", ("HL", "HIGHER_LOW", "HIGHER LOW")),
    ("LH", ("LH", "LOWER_HIGH", "LOWER HIGH")),
    ("LL", ("LL", "LOWER_LOW", "LOWER LOW")),
    ("BOS", ("BOS", "BREAK_OF_STRUCTURE", "BREAK OF STRUCTURE")),
    ("CHOCH", ("CHOCH", "CHoCH", "CHANGE_OF_CHARACTER", "CHANGE OF CHARACTER")),
    ("Liquidity Grab", ("LIQUIDITY_GRAB", "LIQUIDITY GRAB", "LIQ_GRAB", "LIQ GRAB", "SWEEP", "GRAB", "LIQUIDITY")),
    ("FVG", ("FVG", "FAIR_VALUE_GAP", "FAIR VALUE GAP")),
    ("Premium", ("PREMIUM",)),
    ("Equilibrium", ("EQUILIBRIUM", "EQ", "EQB")),
    ("Discount", ("DISCOUNT",)),
)


@dataclass(frozen=True)
class Candle:
    symbol: str
    timeframe: str
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    raw_timestamp: str | None = None
    source_row_index: int | None = None
    source_symbol: str | None = None
    source_filename: str | None = None


@dataclass(frozen=True)
class SwingConfig:
    mode: str = "normal"
    left_candles: int = 2
    right_candles: int = 2
    min_swing_distance: float = 8


def _detected_id(detector_type: str, *parts: object) -> str:
    raw = "|".join(str(part) for part in parts)
    safe = raw.replace(":", "").replace("+", "").replace(" ", "_").replace("|", "-")
    return f"{detector_type}-{safe}"


def _candle_ref(candle: Candle) -> str:
    source = f" row:{candle.source_row_index}" if candle.source_row_index is not None else ""
    raw = f" raw:{candle.raw_timestamp}" if candle.raw_timestamp else ""
    return (
        f"{candle.timestamp.isoformat()}{source}{raw} "
        f"O:{round(candle.open, 4)} H:{round(candle.high, 4)} "
        f"L:{round(candle.low, 4)} C:{round(candle.close, 4)}"
    )


def _detection_debug(candle: Candle, displayed_level: float, level_source: str) -> dict:
    rounded_level = round(displayed_level, 4)
    return {
        "original_csv_row_index": candle.source_row_index,
        "original_timestamp": candle.raw_timestamp or candle.timestamp.isoformat(),
        "parsed_timestamp": candle.timestamp.isoformat(),
        "candle_open": round(candle.open, 4),
        "candle_high": round(candle.high, 4),
        "candle_low": round(candle.low, 4),
        "candle_close": round(candle.close, 4),
        "displayed_level": rounded_level,
        "level_source": level_source,
    }


def _swing_debug(candle: Candle, displayed_level: float, level_source: str) -> dict:
    debug = _detection_debug(candle, displayed_level, level_source)
    return {
        **debug,
        "swing_source_row_index": candle.source_row_index,
        "swing_source_timestamp": candle.raw_timestamp or candle.timestamp.isoformat(),
        "swing_source_open": round(candle.open, 4),
        "swing_source_high": round(candle.high, 4),
        "swing_source_low": round(candle.low, 4),
        "swing_source_close": round(candle.close, 4),
    }


def _copy_detection_debug(row: dict) -> dict:
    keys = (
        "original_csv_row_index",
        "original_timestamp",
        "parsed_timestamp",
        "candle_open",
        "candle_high",
        "candle_low",
        "candle_close",
        "displayed_level",
        "level_source",
    )
    return {key: row.get(key) for key in keys if key in row}


def _copy_structure_debug(node: dict | None) -> dict:
    if not node:
        return {}
    return {
        "swept_structure_node_id": node["detected_id"],
        "swept_structure_node": f"{node['timeframe']} {node['protected_level_role'] or node['structure_type']} @ {node['price']}",
        "swept_timeframe": node["timeframe"],
    }


def _copy_swing_source_debug(swing: dict) -> dict:
    return {
        "original_csv_row_index": swing.get("original_csv_row_index"),
        "original_timestamp": swing.get("original_timestamp"),
        "parsed_timestamp": swing.get("parsed_timestamp"),
        "candle_open": swing.get("candle_open"),
        "candle_high": swing.get("candle_high"),
        "candle_low": swing.get("candle_low"),
        "candle_close": swing.get("candle_close"),
        "displayed_level": swing.get("displayed_level"),
        "level_source": swing.get("level_source"),
    }


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return min(max(value, minimum), maximum)


def _structure_side(kind: str) -> str:
    return "high" if kind == "swing_high" else "low"


def _structure_type(side: str, price: float, last_high: float | None, last_low: float | None) -> str:
    if side == "high":
        return "HH" if last_high is None or price > last_high else "LH"
    return "HL" if last_low is None or price > last_low else "LL"


def _structure_state(last_high_type: str | None, last_low_type: str | None, high_count: int, low_count: int) -> str:
    if high_count < 2 or low_count < 2:
        return "Neutral"
    if last_high_type == "HH" and last_low_type == "HL":
        return "Bullish"
    if last_high_type == "LH" and last_low_type == "LL":
        return "Bearish"
    if last_high_type and last_low_type:
        return "Transition"
    return "Neutral"


def _leg_type(structure_type: str) -> str:
    return "impulse_leg" if structure_type in {"HH", "LL"} else "pullback_leg"


def _reference_levels_near_node(candles: list[Candle], node: dict, tolerance: float = STRUCTURE_LEVEL_TOLERANCE) -> list[str]:
    if not candles:
        return []
    node_time = datetime.fromisoformat(node["timestamp"])
    price = float(node["price"])
    ordered = sorted(candles, key=attrgetter("timestamp"))
    day_rows: dict[object, list[Candle]] = {}
    for candle in ordered:
        day_rows.setdefault(candle.timestamp.date(), []).append(candle)

    days = sorted(day_rows)
    current_day = node_time.date()
    previous_day = days[days.index(current_day) - 1] if current_day in days and days.index(current_day) > 0 else None
    levels: list[tuple[str, float]] = []
    if previous_day:
        rows = day_rows[previous_day]
        levels.extend(
            [
                ("PDH", max(candle.high for candle in rows)),
                ("PDL", min(candle.low for candle in rows)),
            ]
        )

    node_session = session_for_timestamp(node_time)
    session_rows = [candle for candle in ordered if candle.timestamp.date() == current_day and candle.timestamp <= node_time and session_for_timestamp(candle.timestamp) == node_session]
    if session_rows:
        levels.extend(
            [
                ("session high", max(candle.high for candle in session_rows)),
                ("session low", min(candle.low for candle in session_rows)),
            ]
        )

    return [label for label, level in levels if abs(price - level) <= tolerance]


def _event_matches_node(event: dict, node: dict, tolerance: float = STRUCTURE_LEVEL_TOLERANCE) -> bool:
    event_time = datetime.fromisoformat(event["timestamp"])
    node_time = datetime.fromisoformat(node["timestamp"])
    if event_time <= node_time:
        return False
    if event["event_type"] == "sweep_above_high" and node["side"] != "high":
        return False
    if event["event_type"] == "sweep_below_low" and node["side"] != "low":
        return False
    return abs(float(event["price_level"]) - float(node["price"])) <= tolerance or abs(float(event.get("price", event["price_level"])) - float(node["price"])) <= tolerance


def _find_swept_structure_node(event: dict, structure_nodes: list[dict], tolerance: float = STRUCTURE_LEVEL_TOLERANCE) -> dict | None:
    matches = [node for node in structure_nodes if _event_matches_node(event, node, tolerance)]
    if not matches:
        return None
    return sorted(
        matches,
        key=lambda node: (
            abs(float(event["price_level"]) - float(node["price"])),
            -int(node.get("importance_score", 0)),
            node["timestamp"],
        ),
    )[0]


def _source_level_label(source: str) -> str:
    return {
        "previous_day_high": "previous day high",
        "previous_day_low": "previous day low",
        "session_high": "session high",
        "session_low": "session low",
    }.get(source, source.replace("_", " "))


def _sample_metadata(candles: list[Candle], missing_rows: list[dict]) -> dict:
    ordered = sorted(candles, key=attrgetter("timestamp"))
    timeframes = {candle.timeframe for candle in ordered}
    source_filenames = {candle.source_filename for candle in ordered if candle.source_filename}
    source_symbols = {candle.source_symbol for candle in ordered if candle.source_symbol}
    imported_symbols = {candle.symbol for candle in ordered}
    return {
        "first_candle": ordered[0].timestamp.isoformat() if ordered else None,
        "last_candle": ordered[-1].timestamp.isoformat() if ordered else None,
        "first_raw_timestamp": ordered[0].raw_timestamp if ordered else None,
        "last_raw_timestamp": ordered[-1].raw_timestamp if ordered else None,
        "source_filename": sorted(source_filenames)[0] if source_filenames else None,
        "detected_symbol": sorted(source_symbols or imported_symbols)[0] if ordered else None,
        "timeframe_consistent": bool(ordered) and len(timeframes) == 1 and not missing_rows,
        "expected_timeframe_minutes": SUPPORTED_TIMEFRAMES[ordered[0].timeframe] if ordered and len(timeframes) == 1 else None,
    }


def normalize_swing_config(config: SwingConfig | dict | None = None) -> SwingConfig:
    if isinstance(config, SwingConfig):
        raw = {
            "mode": config.mode,
            "left_candles": config.left_candles,
            "right_candles": config.right_candles,
            "min_swing_distance": config.min_swing_distance,
        }
    else:
        raw = config or {}

    mode = raw.get("mode", "normal")
    if mode not in SWING_MODE_THRESHOLDS:
        mode = "normal"

    return SwingConfig(
        mode=mode,
        left_candles=int(_clamp(round(float(raw.get("left_candles", raw.get("left", 2)))), 1, 20)),
        right_candles=int(_clamp(round(float(raw.get("right_candles", raw.get("right", 2)))), 1, 20)),
        min_swing_distance=_clamp(float(raw.get("min_swing_distance", 8)), 0, 1000),
    )


def _header_key(value: str) -> str:
    return value.strip().lower().replace(" ", "_")


def _find_header(header_map: dict[str, str], aliases: tuple[str, ...]) -> str | None:
    for alias in aliases:
        found = header_map.get(alias)
        if found:
            return found
    return None


def _label_text_key(value: str) -> str:
    return re.sub(r"[^A-Z0-9]+", "_", value.strip().upper()).strip("_")


def _classify_reference_label(text: str) -> str | None:
    key = _label_text_key(text)
    spaced = key.replace("_", " ")
    tokens = set(key.split("_"))
    for label_type, patterns in REFERENCE_LABEL_PATTERNS:
        for pattern in patterns:
            pattern_key = _label_text_key(pattern)
            pattern_spaced = pattern_key.replace("_", " ")
            if pattern_key in {"HH", "HL", "LH", "LL", "EQ"}:
                if pattern_key in tokens:
                    return label_type
                continue
            if pattern_key in key or pattern_spaced in spaced:
                return label_type
    return None


def _detect_reference_label_columns(fieldnames: list[str], mapped_sources: set[str]) -> list[dict]:
    columns: list[dict] = []
    for header in fieldnames:
        if header in mapped_sources:
            continue
        label_type = _classify_reference_label(header)
        if not label_type:
            continue
        columns.append({"source": header, "label_type": label_type})
    return columns


def _is_active_reference_value(value: str) -> bool:
    text = value.strip()
    if not text:
        return False
    return text.lower() not in {"0", "0.0", "false", "no", "na", "n/a", "nan", "null", "none", "-"}


def _extract_reference_price(value: str) -> float | None:
    text = value.strip()
    try:
        parsed = float(text)
        return round(parsed, 4) if abs(parsed) >= 100 else None
    except ValueError:
        pass

    for match in re.finditer(r"[-+]?\d+(?:\.\d+)?", text):
        parsed = float(match.group(0))
        if abs(parsed) >= 100:
            return round(parsed, 4)
    return None


def _reference_label_value(raw_value: str, header_label_type: str | None, value_label_type: str | None) -> str:
    text = raw_value.strip()
    if text.lower() in {"1", "1.0", "true", "yes"} and header_label_type:
        return header_label_type
    return text or value_label_type or header_label_type or "Label"


def _symbol_from_filename(source_filename: str | None) -> str | None:
    if not source_filename:
        return None
    normalized = source_filename.upper().replace(".", "_").replace("-", "_").replace(" ", "_")
    tokens = {token for token in normalized.split("_") if token}
    for symbol in ("MNQ", "NQ", "MES", "ES", "GC"):
        if symbol in tokens or normalized.startswith(symbol):
            return symbol
    return None


def detect_candle_column_mapping(fieldnames: list[str]) -> dict:
    header_map = {_header_key(header): header for header in fieldnames}
    mapping = {
        "timestamp": _find_header(header_map, TIME_COLUMN_ALIASES),
        "open": _find_header(header_map, ("open",)),
        "high": _find_header(header_map, ("high",)),
        "low": _find_header(header_map, ("low",)),
        "close": _find_header(header_map, ("close",)),
        "volume": _find_header(header_map, VOLUME_COLUMN_ALIASES),
    }
    missing_required = [field for field in REQUIRED_CANDLE_FIELDS if not mapping[field]]
    mapped_sources = {source for source in mapping.values() if source}
    reference_label_columns = _detect_reference_label_columns(fieldnames, mapped_sources)
    reference_sources = {item["source"] for item in reference_label_columns}
    warnings = [
        *(f"Missing required {'time or timestamp' if field == 'timestamp' else field} column." for field in missing_required),
        *(("Volume column missing. Import will use 0 for volume.",) if not mapping["volume"] else ()),
    ]
    return {
        "column_mapping": [{"source": source, "target": target} for target, source in mapping.items() if source],
        "reference_label_columns": reference_label_columns,
        "missing_required": missing_required,
        "warnings": warnings,
        "ignored_columns": [header for header in fieldnames if header not in mapped_sources and header not in reference_sources],
        "can_import": not missing_required,
        "mapping": mapping,
    }


def _parse_timestamp(value: str) -> datetime:
    raw = value.strip()
    if not raw:
        raise ValueError("timestamp is required")
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"Invalid timestamp: {value}") from exc


def _parse_number(value: str, field: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid {field}: {value}") from exc


def _reference_labels_from_row(row: dict[str, str], candle: Candle, reference_label_columns: list[dict]) -> list[dict]:
    labels: list[dict] = []
    for column in reference_label_columns:
        source = column["source"]
        raw_value = (row.get(source, "") or "").strip()
        if not _is_active_reference_value(raw_value):
            continue
        header_label_type = column.get("label_type")
        value_label_type = _classify_reference_label(raw_value)
        label_type = value_label_type or header_label_type
        if not label_type:
            continue
        price_level = _extract_reference_price(raw_value)
        label_value = _reference_label_value(raw_value, header_label_type, value_label_type)
        labels.append(
            {
                "detected_id": _detected_id("tv_label", candle.symbol, candle.timeframe, candle.timestamp.isoformat(), source, label_type, len(labels)),
                "timestamp": candle.timestamp.isoformat(),
                "symbol": candle.symbol,
                "timeframe": candle.timeframe,
                "label_type": label_type,
                "label_value": label_value,
                "price_level": price_level,
                "source_column": source,
                "raw_value": raw_value,
                "original_csv_row_index": candle.source_row_index,
                "original_timestamp": candle.raw_timestamp,
            }
        )
    return labels


def normalize_timeframe(value: str) -> str:
    timeframe = value.strip().lower()
    if timeframe not in SUPPORTED_TIMEFRAMES:
        raise ValueError("Only 1m and 5m candle CSV files are supported")
    return timeframe


def detect_missing_rows(candles: list[Candle]) -> list[dict]:
    missing: list[dict] = []
    ordered = sorted(candles, key=lambda candle: (candle.symbol, candle.timeframe, candle.timestamp))

    for (symbol, timeframe), group in groupby(ordered, key=lambda candle: (candle.symbol, candle.timeframe)):
        rows = list(group)
        expected_delta = timedelta(minutes=SUPPORTED_TIMEFRAMES[timeframe])
        for previous, current in zip(rows, rows[1:]):
            gap = current.timestamp - previous.timestamp
            if gap <= expected_delta:
                continue
            missing_count = int(gap / expected_delta) - 1
            for index in range(missing_count):
                missing_at = previous.timestamp + expected_delta * (index + 1)
                missing.append(
                    {
                        "symbol": symbol,
                        "timeframe": timeframe,
                        "timestamp": missing_at.isoformat(),
                    }
                )
    return missing


def parse_candle_csv(raw: str, default_symbol: str = "NQ", default_timeframe: str = "1m", source_filename: str | None = None) -> tuple[list[Candle], dict]:
    default_timeframe = normalize_timeframe(default_timeframe)
    reader = csv.DictReader(io.StringIO(raw))
    if not reader.fieldnames:
        raise ValueError("CSV file is empty")

    mapping_result = detect_candle_column_mapping(reader.fieldnames)
    if not mapping_result["can_import"]:
        raise ValueError(f"Missing required candle columns: {', '.join(mapping_result['missing_required'])}")
    mapping = mapping_result["mapping"]
    header_map = {_header_key(header): header for header in reader.fieldnames}

    candles: list[Candle] = []
    reference_labels: list[dict] = []
    seen: set[tuple[str, str, datetime]] = set()
    duplicate_rows = 0
    raw_rows = 0
    filename_symbol = _symbol_from_filename(source_filename)

    for row in reader:
        raw_rows += 1
        csv_symbol = (row.get(header_map.get("symbol", ""), "") or "").strip().upper()
        symbol = (csv_symbol or default_symbol).strip().upper()
        timeframe = normalize_timeframe((row.get(header_map.get("timeframe", ""), "") or default_timeframe).strip())
        volume_header = mapping["volume"]
        raw_timestamp = row[mapping["timestamp"]]
        candle = Candle(
            symbol=symbol,
            timeframe=timeframe,
            timestamp=_parse_timestamp(raw_timestamp),
            open=_parse_number(row[mapping["open"]], "open"),
            high=_parse_number(row[mapping["high"]], "high"),
            low=_parse_number(row[mapping["low"]], "low"),
            close=_parse_number(row[mapping["close"]], "close"),
            volume=_parse_number(row[volume_header], "volume") if volume_header else 0,
            raw_timestamp=raw_timestamp,
            source_row_index=reader.line_num,
            source_symbol=csv_symbol or filename_symbol or symbol,
            source_filename=source_filename,
        )
        if candle.high < candle.low:
            raise ValueError(f"Invalid candle range at {candle.timestamp.isoformat()}")
        key = (candle.symbol, candle.timeframe, candle.timestamp)
        if key in seen:
            duplicate_rows += 1
            continue
        seen.add(key)
        candles.append(candle)
        reference_labels.extend(_reference_labels_from_row(row, candle, mapping_result["reference_label_columns"]))

    candles = sorted(candles, key=lambda candle: (candle.symbol, candle.timeframe, candle.timestamp))
    missing_rows = detect_missing_rows(candles)
    summary = {
        "raw_rows": raw_rows,
        "valid_rows": len(candles),
        "duplicate_rows": duplicate_rows,
        "missing_rows": len(missing_rows),
        "missing_timestamps": missing_rows[:50],
        "column_mapping": mapping_result["column_mapping"],
        "reference_label_columns": mapping_result["reference_label_columns"],
        "reference_labels": reference_labels,
        "warnings": mapping_result["warnings"],
        "ignored_columns": mapping_result["ignored_columns"],
        **_sample_metadata(candles, missing_rows),
    }
    return candles, summary


def _normalize_yahoo_symbol(value: str) -> str:
    symbol = value.strip().upper()
    if symbol not in YAHOO_FINANCE_SYMBOLS:
        raise ValueError("Free Data Research Mode supports NQ=F, MNQ=F, and GC=F")
    return symbol


def _yahoo_range_for_timeframe(timeframe: str, range_value: str | None) -> str:
    return (range_value or YAHOO_FINANCE_DEFAULT_RANGES[timeframe]).strip()


def _yahoo_cache_file(symbol: str, timeframe: str, range_value: str) -> Path:
    safe_symbol = re.sub(r"[^A-Z0-9]+", "_", symbol.upper()).strip("_")
    safe_range = re.sub(r"[^A-Za-z0-9]+", "_", range_value).strip("_")
    return YAHOO_CACHE_DIR / f"{safe_symbol}_{timeframe}_{safe_range}.json"


def _download_yahoo_chart(symbol: str, timeframe: str, range_value: str) -> dict:
    interval = YAHOO_FINANCE_INTERVALS[timeframe]
    query = urlencode({"interval": interval, "range": range_value, "includePrePost": "true"})
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{quote(symbol, safe='')}?{query}"
    request = Request(url, headers={"User-Agent": "Fabio Edge Research Lab/1.0"})
    try:
        with urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except (OSError, URLError, json.JSONDecodeError) as exc:
        raise ValueError(f"Unable to download Yahoo Finance data: {exc}") from exc


def parse_yahoo_chart_response(payload: dict, requested_symbol: str, timeframe: str) -> list[Candle]:
    timeframe = normalize_timeframe(timeframe)
    requested_symbol = _normalize_yahoo_symbol(requested_symbol)
    chart = payload.get("chart", {})
    error = chart.get("error")
    if error:
        message = error.get("description") or error.get("code") or "Yahoo Finance returned an error"
        raise ValueError(str(message))

    results = chart.get("result") or []
    if not results:
        raise ValueError("Yahoo Finance returned no chart data")

    result = results[0]
    timestamps = result.get("timestamp") or []
    quotes = result.get("indicators", {}).get("quote") or []
    if not timestamps or not quotes:
        raise ValueError("Yahoo Finance chart response did not include OHLC data")

    quote_row = quotes[0]
    opens = quote_row.get("open") or []
    highs = quote_row.get("high") or []
    lows = quote_row.get("low") or []
    closes = quote_row.get("close") or []
    volumes = quote_row.get("volume") or []
    meta = result.get("meta") or {}
    source_symbol = str(meta.get("symbol") or requested_symbol).upper()

    candles: list[Candle] = []
    seen: set[datetime] = set()
    for index, epoch_seconds in enumerate(timestamps):
        values = (
            opens[index] if index < len(opens) else None,
            highs[index] if index < len(highs) else None,
            lows[index] if index < len(lows) else None,
            closes[index] if index < len(closes) else None,
        )
        if epoch_seconds is None or any(value is None for value in values):
            continue

        timestamp = datetime.fromtimestamp(int(epoch_seconds), timezone.utc)
        if timestamp in seen:
            continue
        seen.add(timestamp)
        volume = volumes[index] if index < len(volumes) and volumes[index] is not None else 0
        candle = Candle(
            symbol=requested_symbol,
            timeframe=timeframe,
            timestamp=timestamp,
            open=float(values[0]),
            high=float(values[1]),
            low=float(values[2]),
            close=float(values[3]),
            volume=float(volume),
            raw_timestamp=str(epoch_seconds),
            source_row_index=index + 1,
            source_symbol=source_symbol,
            source_filename="Yahoo Finance",
        )
        if candle.high < candle.low:
            continue
        candles.append(candle)

    candles = sorted(candles, key=attrgetter("timestamp"))
    if not candles:
        raise ValueError("Yahoo Finance data did not include valid candles")
    return candles


def fetch_yahoo_market_data(symbol: str, timeframe: str = "1m", range_value: str | None = None, force_refresh: bool = False) -> tuple[list[Candle], dict]:
    timeframe = normalize_timeframe(timeframe)
    symbol = _normalize_yahoo_symbol(symbol)
    range_value = _yahoo_range_for_timeframe(timeframe, range_value)
    cache_file = _yahoo_cache_file(symbol, timeframe, range_value)
    cache_file.parent.mkdir(parents=True, exist_ok=True)

    cached = cache_file.exists() and not force_refresh
    if cached:
        payload = json.loads(cache_file.read_text(encoding="utf-8"))
    else:
        payload = _download_yahoo_chart(symbol, timeframe, range_value)
        cache_file.write_text(json.dumps(payload), encoding="utf-8")

    candles = parse_yahoo_chart_response(payload, symbol, timeframe)
    downloaded_at = datetime.now(timezone.utc).isoformat()
    if cache_file.exists():
        downloaded_at = datetime.fromtimestamp(cache_file.stat().st_mtime, timezone.utc).isoformat()

    chart = payload.get("chart", {})
    result = (chart.get("result") or [{}])[0]
    meta = result.get("meta") or {}
    return candles, {
        "provider": "Yahoo Finance",
        "requested_symbol": symbol,
        "source_symbol": str(meta.get("symbol") or symbol),
        "timeframe": timeframe,
        "yahoo_interval": YAHOO_FINANCE_INTERVALS[timeframe],
        "range": range_value,
        "cached": cached,
        "cache_path": str(cache_file),
        "downloaded_at": downloaded_at,
        "last_candle": candles[-1].timestamp.isoformat() if candles else None,
        "delay_warning": YAHOO_FINANCE_DELAY_WARNING,
    }


def session_for_timestamp(timestamp: datetime) -> str:
    current = timestamp.time()
    if time(18, 0) <= current or current < time(3, 0):
        return "Asia"
    if time(3, 0) <= current < time(8, 30):
        return "London"
    if time(8, 30) <= current < time(9, 30):
        return "Pre-Market"
    if time(9, 30) <= current < time(16, 0):
        return "New York"
    return "After-Hours"


def detect_structure(candles: list[Candle]) -> list[dict]:
    swings: list[dict] = []
    ordered = sorted(candles, key=attrgetter("timestamp"))
    last_swing_high: float | None = None
    last_swing_low: float | None = None

    for index in range(1, len(ordered) - 1):
        previous = ordered[index - 1]
        current = ordered[index]
        following = ordered[index + 1]

        if current.high > previous.high and current.high > following.high:
            label = "Swing High" if last_swing_high is None else ("HH" if current.high > last_swing_high else "LH")
            last_swing_high = current.high
            swings.append(
                {
                    "detected_id": _detected_id("swing", current.symbol, current.timeframe, current.timestamp.isoformat(), label),
                    "timestamp": current.timestamp.isoformat(),
                    "symbol": current.symbol,
                    "timeframe": current.timeframe,
                    "kind": "swing_high",
                    "label": label,
                    "price": round(current.high, 4),
                    "price_level": round(current.high, 4),
                    "reason": "Current candle high is above both the previous and next candle highs.",
                    "candles_used": [_candle_ref(previous), _candle_ref(current), _candle_ref(following)],
                    "confidence_score": 60,
                    **_swing_debug(current, current.high, "high"),
                }
            )

        if current.low < previous.low and current.low < following.low:
            label = "Swing Low" if last_swing_low is None else ("HL" if current.low > last_swing_low else "LL")
            last_swing_low = current.low
            swings.append(
                {
                    "detected_id": _detected_id("swing", current.symbol, current.timeframe, current.timestamp.isoformat(), label),
                    "timestamp": current.timestamp.isoformat(),
                    "symbol": current.symbol,
                    "timeframe": current.timeframe,
                    "kind": "swing_low",
                    "label": label,
                    "price": round(current.low, 4),
                    "price_level": round(current.low, 4),
                    "reason": "Current candle low is below both the previous and next candle lows.",
                    "candles_used": [_candle_ref(previous), _candle_ref(current), _candle_ref(following)],
                    "confidence_score": 60,
                    **_swing_debug(current, current.low, "low"),
                }
            )

    return swings


def _score_swing_v2(current: Candle, window_rows: list[Candle], price: float, last_accepted_price: float | None, min_distance: float) -> dict:
    highs = [candle.high for candle in window_rows]
    lows = [candle.low for candle in window_rows]
    swing_size = max(price - min(lows), max(highs) - price, 0)
    distance_base = max(min_distance, 0.25)
    distance = min_distance if last_accepted_price is None else abs(price - last_accepted_price)
    size_score = _clamp((swing_size / distance_base) * 40, 0, 40)
    candle_range = max(current.high - current.low, 0.01)
    displacement_score = _clamp((abs(current.close - current.open) / candle_range) * 30, 0, 30)
    average_volume = sum(candle.volume for candle in window_rows) / max(len(window_rows), 1)
    volume_ratio = current.volume / average_volume if average_volume > 0 else 1
    volume_score = 30 if volume_ratio >= 1.5 else 20 if volume_ratio >= 1.1 else 10 if volume_ratio >= 0.9 else 0
    score = round(size_score + displacement_score + volume_score, 1)

    return {
        "distance": round(distance, 2),
        "size_score": round(size_score, 1),
        "displacement_score": round(displacement_score, 1),
        "volume_score": round(volume_score, 1),
        "score": score,
    }


def _swing_v2_reason(config: SwingConfig, scores: dict, threshold: int) -> str:
    return (
        f"Accepted by Swing V2 {config.mode} mode. "
        f"{config.left_candles} left / {config.right_candles} right candles confirmed the local extreme. "
        f"Distance {scores['distance']} >= {config.min_swing_distance} points. "
        f"Score {scores['score']} >= {threshold} from size {scores['size_score']}, "
        f"displacement {scores['displacement_score']}, volume {scores['volume_score']}."
    )


def _structure_importance_v1(current: Candle, context_rows: list[Candle], label: str, kind: str) -> dict:
    prior_rows = context_rows[:-1]
    average_range = sum(max(candle.high - candle.low, 0.01) for candle in prior_rows) / max(len(prior_rows), 1)
    body = abs(current.close - current.open)
    displacement = min(round((body / max(average_range, 0.01)) * 18), 25)
    bos_potential = 20 if label in {"HH", "LL"} else 10 if label in {"HL", "LH"} else 6
    choch_potential = 12 if (kind == "swing_high" and label == "LH") or (kind == "swing_low" and label == "HL") else 4
    prior_high = max((candle.high for candle in prior_rows), default=current.high)
    prior_low = min((candle.low for candle in prior_rows), default=current.low)
    swept_high = current.high > prior_high and current.close < prior_high
    swept_low = current.low < prior_low and current.close > prior_low
    liquidity_interaction = 20 if swept_high or swept_low else 12 if current.high >= prior_high or current.low <= prior_low else 4
    session = session_for_timestamp(current.timestamp)
    session_significance = 10 if session == "New York" else 8 if session in {"Pre-Market", "London"} else 5 if session == "Asia" else 3
    average_volume = sum(candle.volume for candle in prior_rows) / max(len(prior_rows), 1)
    volume_ratio = current.volume / average_volume if average_volume > 0 else 1
    volume_expansion = 13 if volume_ratio >= 1.5 else 9 if volume_ratio >= 1.15 else 5 if volume_ratio >= 0.9 else 0
    score = min(100, displacement + bos_potential + choch_potential + liquidity_interaction + session_significance + volume_expansion)

    return {
        "score": int(score),
        "reason": (
            f"Structure importance {int(score)}/100: displacement {displacement}, BOS potential {bos_potential}, "
            f"CHOCH potential {choch_potential}, liquidity {liquidity_interaction}, session {session_significance}, "
            f"volume {volume_expansion}."
        ),
    }


def detect_structure_v2(candles: list[Candle], config: SwingConfig | dict | None = None) -> list[dict]:
    swing_config = normalize_swing_config(config)
    ordered = sorted(candles, key=attrgetter("timestamp"))
    swings: list[dict] = []
    last_swing_high: float | None = None
    last_swing_low: float | None = None
    threshold = SWING_MODE_THRESHOLDS[swing_config.mode]

    for index in range(swing_config.left_candles, len(ordered) - swing_config.right_candles):
        current = ordered[index]
        left_rows = ordered[index - swing_config.left_candles : index]
        right_rows = ordered[index + 1 : index + 1 + swing_config.right_candles]
        window_rows = [*left_rows, current, *right_rows]
        is_swing_high = current.high > max(candle.high for candle in left_rows) and current.high > max(candle.high for candle in right_rows)
        is_swing_low = current.low < min(candle.low for candle in left_rows) and current.low < min(candle.low for candle in right_rows)

        if is_swing_high:
            scores = _score_swing_v2(current, window_rows, current.high, last_swing_high, swing_config.min_swing_distance)
            if scores["distance"] >= swing_config.min_swing_distance and scores["score"] >= threshold:
                label = "Swing High" if last_swing_high is None else ("HH" if current.high > last_swing_high else "LH")
                importance = _structure_importance_v1(current, ordered[max(0, index - 20) : index + 1], label, "swing_high")
                last_swing_high = current.high
                swings.append(
                    {
                        "detected_id": _detected_id("swing_v2", current.symbol, current.timeframe, current.timestamp.isoformat(), label),
                        "timestamp": current.timestamp.isoformat(),
                        "symbol": current.symbol,
                        "timeframe": current.timeframe,
                        "kind": "swing_high",
                        "label": label,
                        "price": round(current.high, 4),
                        "price_level": round(current.high, 4),
                        "reason": f"{_swing_v2_reason(swing_config, scores, threshold)} {importance['reason']}",
                        "candles_used": [_candle_ref(candle) for candle in window_rows],
                        "confidence_score": min(round(scores["score"]), 100),
                        "structure_importance_score": importance["score"],
                        "structure_importance_reason": importance["reason"],
                        **_swing_debug(current, current.high, "high"),
                    }
                )

        if is_swing_low:
            scores = _score_swing_v2(current, window_rows, current.low, last_swing_low, swing_config.min_swing_distance)
            if scores["distance"] >= swing_config.min_swing_distance and scores["score"] >= threshold:
                label = "Swing Low" if last_swing_low is None else ("HL" if current.low > last_swing_low else "LL")
                importance = _structure_importance_v1(current, ordered[max(0, index - 20) : index + 1], label, "swing_low")
                last_swing_low = current.low
                swings.append(
                    {
                        "detected_id": _detected_id("swing_v2", current.symbol, current.timeframe, current.timestamp.isoformat(), label),
                        "timestamp": current.timestamp.isoformat(),
                        "symbol": current.symbol,
                        "timeframe": current.timeframe,
                        "kind": "swing_low",
                        "label": label,
                        "price": round(current.low, 4),
                        "price_level": round(current.low, 4),
                        "reason": f"{_swing_v2_reason(swing_config, scores, threshold)} {importance['reason']}",
                        "candles_used": [_candle_ref(candle) for candle in window_rows],
                        "confidence_score": min(round(scores["score"]), 100),
                        "structure_importance_score": importance["score"],
                        "structure_importance_reason": importance["reason"],
                        **_swing_debug(current, current.low, "low"),
                    }
                )

    return swings


def build_structure_sequence(swings: list[dict], candles: list[Candle] | None = None, liquidity_events: list[dict] | None = None) -> list[dict]:
    ordered_swings = sorted(swings, key=lambda swing: swing["timestamp"])
    nodes: list[dict] = []
    last_high: float | None = None
    last_low: float | None = None
    last_high_type: str | None = None
    last_low_type: str | None = None
    high_count = 0
    low_count = 0

    for swing in ordered_swings:
        side = _structure_side(swing["kind"])
        price = float(swing["price_level"])
        structure_type = _structure_type(side, price, last_high, last_low)
        if side == "high":
            high_count += 1
            last_high = price
            last_high_type = structure_type
        else:
            low_count += 1
            last_low = price
            last_low_type = structure_type

        state = _structure_state(last_high_type, last_low_type, high_count, low_count)
        node = {
            "detected_id": _detected_id("structure", swing["symbol"], swing["timeframe"], swing["timestamp"], structure_type),
            "source_swing_id": swing["detected_id"],
            "timestamp": swing["timestamp"],
            "symbol": swing["symbol"],
            "timeframe": swing["timeframe"],
            "side": side,
            "structure_type": structure_type,
            "price": price,
            "structure_state": state,
            "leg_type": _leg_type(structure_type),
            "protected_level_role": None,
            "near_reference_levels": [],
            "later_swept": False,
            "swept_by_event_id": None,
            "importance_score": 0,
            "reason": "",
            **_copy_swing_source_debug(swing),
        }
        nodes.append(node)

        if state == "Bullish":
            latest_hl = next((item for item in reversed(nodes) if item["structure_type"] == "HL"), None)
            if latest_hl:
                latest_hl["protected_level_role"] = "protected_low"
        elif state == "Bearish":
            latest_lh = next((item for item in reversed(nodes) if item["structure_type"] == "LH"), None)
            if latest_lh:
                latest_lh["protected_level_role"] = "protected_high"

    for node in nodes:
        node["near_reference_levels"] = _reference_levels_near_node(candles or [], node)
        for event in liquidity_events or []:
            if _event_matches_node(event, node):
                node["later_swept"] = True
                node["swept_by_event_id"] = event["detected_id"]
                break

        source_swing = next((swing for swing in ordered_swings if swing["detected_id"] == node["source_swing_id"]), None)
        reasons: list[str] = []
        score = 10
        if (node["structure_state"] == "Bullish" and node["structure_type"] in {"HH", "HL"}) or (node["structure_state"] == "Bearish" and node["structure_type"] in {"LH", "LL"}):
            score += 20
            reasons.append(f"belongs to clear {node['structure_state'].lower()} sequence")
        elif node["structure_state"] == "Transition":
            score += 10
            reasons.append("marks a transition sequence")
        else:
            reasons.append("not enough sequence context yet")

        if node["protected_level_role"]:
            score += 25
            reasons.append(node["protected_level_role"].replace("_", " "))

        swing_importance = int(source_swing.get("structure_importance_score") or source_swing.get("confidence_score") or 0) if source_swing else 0
        if swing_importance >= 70:
            score += 15
            reasons.append("strong displacement swing")
        elif swing_importance >= 50:
            score += 10
            reasons.append("moderate displacement swing")

        if node["near_reference_levels"]:
            score += 15
            reasons.append(f"near {', '.join(node['near_reference_levels'])}")

        if node["later_swept"]:
            score += 20
            reasons.append("later became swept liquidity")

        node["importance_score"] = int(_clamp(score, 0, 100))
        node["reason"] = f"{node['structure_type']} {node['leg_type'].replace('_', ' ')} in {node['structure_state']} state; " + "; ".join(reasons) + "."

    return nodes


def _candle_by_swing(candles: list[Candle], swing: dict) -> Candle | None:
    swing_time = datetime.fromisoformat(swing["timestamp"])
    for candle in candles:
        if candle.timestamp == swing_time:
            return candle
    return None


def _displacement_profile(candles: list[Candle], swing: dict, lookback: int = 10) -> dict:
    ordered = sorted(candles, key=attrgetter("timestamp"))
    candle = _candle_by_swing(ordered, swing)
    if not candle:
        return {"created": False, "score": 0, "reason": "No source candle available for displacement check."}

    index = ordered.index(candle)
    prior_rows = ordered[max(0, index - lookback) : index]
    average_range = sum(max(row.high - row.low, 0.01) for row in prior_rows) / max(len(prior_rows), 1)
    body = abs(candle.close - candle.open)
    candle_range = max(candle.high - candle.low, 0.01)
    body_ratio = body / average_range if average_range > 0 else 0
    close_position = (candle.close - candle.low) / candle_range
    directional_close = close_position >= 0.7 if swing["kind"] == "swing_high" else close_position <= 0.3
    volume_rows = prior_rows or [candle]
    average_volume = sum(row.volume for row in volume_rows) / max(len(volume_rows), 1)
    volume_ratio = candle.volume / average_volume if average_volume > 0 else 1
    score = int(
        _clamp(
            (min(body_ratio, 2.5) / 2.5) * 55
            + (20 if directional_close else 8)
            + (25 if volume_ratio >= 1.5 else 15 if volume_ratio >= 1.15 else 8 if volume_ratio >= 0.9 else 0),
            0,
            100,
        )
    )
    created = body_ratio >= 1.15 and directional_close and score >= 55
    return {
        "created": created,
        "score": score,
        "reason": f"displacement score {score}/100 from body {round(body_ratio, 2)}x average range and volume {round(volume_ratio, 2)}x",
    }


def build_protected_structure_v2(swings: list[dict], candles: list[Candle] | None = None, liquidity_events: list[dict] | None = None) -> list[dict]:
    ordered_swings = sorted(swings, key=lambda swing: swing["timestamp"])
    ordered_candles = sorted(candles or [], key=attrgetter("timestamp"))
    raw_nodes: list[dict] = []
    last_high: float | None = None
    last_low: float | None = None
    last_high_type: str | None = None
    last_low_type: str | None = None
    high_count = 0
    low_count = 0
    prior_state = "Neutral"

    for swing in ordered_swings:
        side = _structure_side(swing["kind"])
        price = float(swing["price_level"])
        previous_high = last_high
        previous_low = last_low
        structure_type = _structure_type(side, price, last_high, last_low)
        caused_bos = (side == "high" and previous_high is not None and price > previous_high) or (side == "low" and previous_low is not None and price < previous_low)
        caused_choch = (prior_state == "Bearish" and side == "high" and caused_bos) or (prior_state == "Bullish" and side == "low" and caused_bos)
        displacement = _displacement_profile(ordered_candles, swing)

        if side == "high":
            high_count += 1
            last_high = price
            last_high_type = structure_type
        else:
            low_count += 1
            last_low = price
            last_low_type = structure_type

        state = _structure_state(last_high_type, last_low_type, high_count, low_count)
        node = {
            "detected_id": _detected_id("protected_structure_v2", swing["symbol"], swing["timeframe"], swing["timestamp"], structure_type),
            "source_swing_id": swing["detected_id"],
            "timestamp": swing["timestamp"],
            "symbol": swing["symbol"],
            "timeframe": swing["timeframe"],
            "side": side,
            "structure_type": structure_type,
            "price": price,
            "structure_state": state,
            "leg_type": _leg_type(structure_type),
            "protected_level_role": None,
            "near_reference_levels": [],
            "later_swept": False,
            "swept_by_event_id": None,
            "importance_score": 0,
            "reason": "",
            "caused_bos": caused_bos,
            "caused_choch": caused_choch,
            "created_displacement": displacement["created"],
            "displacement_score": displacement["score"],
            **_copy_swing_source_debug(swing),
        }
        raw_nodes.append(node)

        if caused_bos and side == "high":
            latest_low = next((item for item in reversed(raw_nodes[:-1]) if item["side"] == "low"), None)
            if latest_low:
                latest_low["protected_level_role"] = "protected_low"
        elif caused_bos and side == "low":
            latest_high = next((item for item in reversed(raw_nodes[:-1]) if item["side"] == "high"), None)
            if latest_high:
                latest_high["protected_level_role"] = "protected_high"

        prior_state = state

    filtered_nodes: list[dict] = []
    for node in raw_nodes:
        node["near_reference_levels"] = _reference_levels_near_node(ordered_candles, node)
        for event in liquidity_events or []:
            if _event_matches_node(event, node):
                node["later_swept"] = True
                node["swept_by_event_id"] = event["detected_id"]
                break

        keep_reasons: list[str] = []
        score = 15
        if node["caused_bos"]:
            score += 25
            keep_reasons.append("caused BOS")
        if node["caused_choch"]:
            score += 25
            keep_reasons.append("caused CHOCH")
        if node["created_displacement"]:
            score += 18
            keep_reasons.append(f"created displacement ({node['displacement_score']}/100)")
        if node["protected_level_role"]:
            score += 28
            keep_reasons.append(node["protected_level_role"].replace("_", " "))
        if not keep_reasons:
            continue

        if node["near_reference_levels"]:
            score += 10
            keep_reasons.append(f"near {', '.join(node['near_reference_levels'])}")
        if node["later_swept"]:
            score += 12
            keep_reasons.append("later swept")

        role_label = node["protected_level_role"].replace("_", " ").title() if node["protected_level_role"] else node["structure_type"]
        node["importance_score"] = int(_clamp(score, 0, 100))
        node["reason"] = (
            f"Protected Structure V2 kept {role_label} at {node['price']}: "
            + "; ".join(keep_reasons)
            + f". State {node['structure_state']}; leg {node['leg_type'].replace('_', ' ')}."
        )
        filtered_nodes.append(node)

    return filtered_nodes


def enrich_sweeps_with_structure(liquidity_events: list[dict], structure_nodes: list[dict]) -> list[dict]:
    enriched: list[dict] = []
    for event in liquidity_events:
        node = _find_swept_structure_node(event, structure_nodes)
        direction = "above" if event["event_type"] == "sweep_above_high" else "below"
        if node:
            node_label = node["protected_level_role"] or node["structure_type"]
            score = int(_clamp(40 + int(node.get("importance_score", 0)) * 0.5 + (10 if node.get("protected_level_role") else 0), 0, 100))
            reason = f"Sweep {direction} {node['timeframe']} {node_label}; linked node importance {node['importance_score']}."
            enriched.append(
                {
                    **event,
                    "swept_level_type": node_label,
                    "sweep_importance_score": score,
                    "sweep_importance_reason": reason,
                    **_copy_structure_debug(node),
                }
            )
            continue

        source_label = _source_level_label(event["source"])
        source_score = 62 if event["source"].startswith("previous_day") else 54 if event["source"].startswith("session") else 35
        enriched.append(
            {
                **event,
                "swept_level_type": source_label,
                "swept_structure_node_id": None,
                "swept_structure_node": None,
                "swept_timeframe": event["timeframe"],
                "sweep_importance_score": source_score,
                "sweep_importance_reason": f"Sweep {direction} {source_label}; no matching prior structure node within {STRUCTURE_LEVEL_TOLERANCE} points.",
            }
        )
    return enriched


def _structure_sweep_node_type(node: dict) -> str:
    role = node.get("protected_level_role")
    if role == "protected_high":
        return "protected high"
    if role == "protected_low":
        return "protected low"
    return node["structure_type"]


def _structure_sweep_direction(node: dict) -> str | None:
    if node["side"] == "high" and (node["structure_type"] in {"HH", "LH"} or node.get("protected_level_role") == "protected_high"):
        return "above"
    if node["side"] == "low" and (node["structure_type"] in {"LL", "HL"} or node.get("protected_level_role") == "protected_low"):
        return "below"
    return None


def _structure_sweep_score(node: dict, pierce_distance: float, close_back_distance: float) -> int:
    protected_bonus = 12 if node.get("protected_level_role") else 0
    pierce_score = min(pierce_distance * 4, 14)
    close_back_score = min(close_back_distance * 3, 10)
    return int(round(_clamp(25 + int(node.get("importance_score", 0)) * 0.5 + protected_bonus + pierce_score + close_back_score, 0, 100)))


def detect_structure_sweeps(
    candles: list[Candle],
    structure_nodes: list[dict],
    min_node_importance: int = 50,
    max_age_minutes: float | None = None,
    min_pierce_size: float = 0,
) -> list[dict]:
    ordered_candles = sorted(candles, key=attrgetter("timestamp"))
    ordered_nodes = sorted(structure_nodes, key=lambda node: node["timestamp"])
    events: list[dict] = []
    seen: set[tuple[str, str]] = set()

    for candle in ordered_candles:
        for node in ordered_nodes:
            node_time = datetime.fromisoformat(node["timestamp"])
            if candle.timestamp <= node_time:
                continue
            if int(node.get("importance_score", 0)) < min_node_importance:
                continue
            age_minutes = (candle.timestamp - node_time).total_seconds() / 60
            if max_age_minutes is not None and age_minutes > max_age_minutes:
                continue

            direction = _structure_sweep_direction(node)
            if direction == "above":
                pierce_distance = candle.high - float(node["price"])
                close_back_distance = float(node["price"]) - candle.close
                swept = pierce_distance > 0 and close_back_distance > 0
            elif direction == "below":
                pierce_distance = float(node["price"]) - candle.low
                close_back_distance = candle.close - float(node["price"])
                swept = pierce_distance > 0 and close_back_distance > 0
            else:
                continue

            if not swept or pierce_distance < min_pierce_size:
                continue

            key = (candle.timestamp.isoformat(), node["detected_id"])
            if key in seen:
                continue
            seen.add(key)

            node_type = _structure_sweep_node_type(node)
            score = _structure_sweep_score(node, pierce_distance, close_back_distance)
            event_type = "sweep_above_structure" if direction == "above" else "sweep_below_structure"
            events.append(
                {
                    "detected_id": _detected_id("structure_sweep", candle.symbol, candle.timeframe, candle.timestamp.isoformat(), node["detected_id"]),
                    "timestamp": candle.timestamp.isoformat(),
                    "symbol": candle.symbol,
                    "timeframe": candle.timeframe,
                    "direction": direction,
                    "event_type": event_type,
                    "swept_node_id": node["detected_id"],
                    "swept_node_time": node["timestamp"],
                    "swept_node_type": node_type,
                    "swept_structure_type": node["structure_type"],
                    "swept_node_price": round(float(node["price"]), 4),
                    "swept_node_state": node["structure_state"],
                    "pierce_distance": round(pierce_distance, 4),
                    "close_back_distance": round(close_back_distance, 4),
                    "importance_score": score,
                    "reason": (
                        f"Price swept {direction} {node['timeframe']} {node_type} at {round(float(node['price']), 4)} "
                        f"and closed back inside by {round(close_back_distance, 4)} points. "
                        f"Node importance {node['importance_score']}; pierce {round(pierce_distance, 4)}."
                    ),
                    "candles_used": [_candle_ref(candle), f"structure_node:{node['detected_id']}"],
                    **_detection_debug(candle, float(node["price"]), node_type),
                }
            )

    return sorted(events, key=lambda event: event["timestamp"])


def mark_structure_nodes_swept_by_structure_sweeps(structure_nodes: list[dict], structure_sweeps: list[dict]) -> list[dict]:
    first_sweep_by_node = {event["swept_node_id"]: event for event in structure_sweeps}
    for node in structure_nodes:
        event = first_sweep_by_node.get(node["detected_id"])
        if not event:
            continue
        already_swept = node.get("later_swept", False)
        node["later_swept"] = True
        node["swept_by_event_id"] = event["detected_id"]
        if not already_swept:
            node["importance_score"] = int(_clamp(int(node.get("importance_score", 0)) + 20, 0, 100))
            node["reason"] = f"{node['reason']} Later swept by structure sweep."
    return structure_nodes


def detect_liquidity(candles: list[Candle]) -> list[dict]:
    ordered = sorted(candles, key=attrgetter("timestamp"))
    by_day: dict[object, list[Candle]] = {}
    for candle in ordered:
        by_day.setdefault(candle.timestamp.date(), []).append(candle)

    day_levels: dict[object, dict[str, float]] = {}
    for day, rows in by_day.items():
        day_levels[day] = {
            "high": max(candle.high for candle in rows),
            "low": min(candle.low for candle in rows),
        }
    sorted_days = sorted(day_levels)
    previous_day_levels: dict[object, dict[str, float]] = {}
    for index, day in enumerate(sorted_days[1:], start=1):
        previous_day_levels[day] = day_levels[sorted_days[index - 1]]

    events: list[dict] = []
    session_levels: dict[tuple[object, str], dict[str, float]] = {}

    for candle in ordered:
        session = session_for_timestamp(candle.timestamp)
        day = candle.timestamp.date()
        previous_day = previous_day_levels.get(day)

        if previous_day:
            if candle.high > previous_day["high"] and candle.close < previous_day["high"]:
                events.append(
                    {
                        "detected_id": _detected_id("sweep", candle.symbol, candle.timeframe, candle.timestamp.isoformat(), "pdh"),
                        "timestamp": candle.timestamp.isoformat(),
                        "symbol": candle.symbol,
                        "timeframe": candle.timeframe,
                        "session": session,
                        "event_type": "sweep_above_high",
                        "source": "previous_day_high",
                        "level": round(previous_day["high"], 4),
                        "price": round(candle.high, 4),
                        "price_level": round(previous_day["high"], 4),
                        "reason": "Candle traded above previous day high and closed back below that level.",
                        "candles_used": [_candle_ref(candle), f"previous_day_high:{round(previous_day['high'], 4)}"],
                        "confidence_score": 72,
                        **_detection_debug(candle, previous_day["high"], "previous_day_high"),
                    }
                )
            if candle.low < previous_day["low"] and candle.close > previous_day["low"]:
                events.append(
                    {
                        "detected_id": _detected_id("sweep", candle.symbol, candle.timeframe, candle.timestamp.isoformat(), "pdl"),
                        "timestamp": candle.timestamp.isoformat(),
                        "symbol": candle.symbol,
                        "timeframe": candle.timeframe,
                        "session": session,
                        "event_type": "sweep_below_low",
                        "source": "previous_day_low",
                        "level": round(previous_day["low"], 4),
                        "price": round(candle.low, 4),
                        "price_level": round(previous_day["low"], 4),
                        "reason": "Candle traded below previous day low and closed back above that level.",
                        "candles_used": [_candle_ref(candle), f"previous_day_low:{round(previous_day['low'], 4)}"],
                        "confidence_score": 72,
                        **_detection_debug(candle, previous_day["low"], "previous_day_low"),
                    }
                )

        session_key = (day, session)
        levels = session_levels.get(session_key)
        if levels:
            if candle.high > levels["high"] and candle.close < levels["high"]:
                events.append(
                    {
                        "detected_id": _detected_id("sweep", candle.symbol, candle.timeframe, candle.timestamp.isoformat(), "session_high"),
                        "timestamp": candle.timestamp.isoformat(),
                        "symbol": candle.symbol,
                        "timeframe": candle.timeframe,
                        "session": session,
                        "event_type": "sweep_above_high",
                        "source": "session_high",
                        "level": round(levels["high"], 4),
                        "price": round(candle.high, 4),
                        "price_level": round(levels["high"], 4),
                        "reason": "Candle traded above the active session high and closed back below that level.",
                        "candles_used": [_candle_ref(candle), f"session_high:{round(levels['high'], 4)}"],
                        "confidence_score": 64,
                        **_detection_debug(candle, levels["high"], "session_high"),
                    }
                )
            if candle.low < levels["low"] and candle.close > levels["low"]:
                events.append(
                    {
                        "detected_id": _detected_id("sweep", candle.symbol, candle.timeframe, candle.timestamp.isoformat(), "session_low"),
                        "timestamp": candle.timestamp.isoformat(),
                        "symbol": candle.symbol,
                        "timeframe": candle.timeframe,
                        "session": session,
                        "event_type": "sweep_below_low",
                        "source": "session_low",
                        "level": round(levels["low"], 4),
                        "price": round(candle.low, 4),
                        "price_level": round(levels["low"], 4),
                        "reason": "Candle traded below the active session low and closed back above that level.",
                        "candles_used": [_candle_ref(candle), f"session_low:{round(levels['low'], 4)}"],
                        "confidence_score": 64,
                        **_detection_debug(candle, levels["low"], "session_low"),
                    }
                )
            levels["high"] = max(levels["high"], candle.high)
            levels["low"] = min(levels["low"], candle.low)
        else:
            session_levels[session_key] = {"high": candle.high, "low": candle.low}

    return events


def detect_fvgs(candles: list[Candle]) -> list[dict]:
    ordered = sorted(candles, key=attrgetter("timestamp"))
    fvgs: list[dict] = []

    for index in range(2, len(ordered)):
        first = ordered[index - 2]
        current = ordered[index]

        if first.high < current.low:
            lower = first.high
            upper = current.low
            returned = any(later.low <= upper and later.high >= lower for later in ordered[index + 1 :])
            fvgs.append(
                {
                    "detected_id": _detected_id("fvg", current.symbol, current.timeframe, current.timestamp.isoformat(), "bullish"),
                    "timestamp": current.timestamp.isoformat(),
                    "symbol": current.symbol,
                    "timeframe": current.timeframe,
                    "fvg_type": "bullish",
                    "lower_bound": round(lower, 4),
                    "upper_bound": round(upper, 4),
                    "gap_size": round(upper - lower, 4),
                    "returned": returned,
                    "price_level": round((lower + upper) / 2, 4),
                    "reason": "Bullish three-candle FVG: candle 1 high is below candle 3 low.",
                    "candles_used": [_candle_ref(first), _candle_ref(ordered[index - 1]), _candle_ref(current)],
                    "confidence_score": 68 if returned else 62,
                    **_detection_debug(current, (lower + upper) / 2, "fvg_midpoint"),
                }
            )

        if first.low > current.high:
            lower = current.high
            upper = first.low
            returned = any(later.high >= lower and later.low <= upper for later in ordered[index + 1 :])
            fvgs.append(
                {
                    "detected_id": _detected_id("fvg", current.symbol, current.timeframe, current.timestamp.isoformat(), "bearish"),
                    "timestamp": current.timestamp.isoformat(),
                    "symbol": current.symbol,
                    "timeframe": current.timeframe,
                    "fvg_type": "bearish",
                    "lower_bound": round(lower, 4),
                    "upper_bound": round(upper, 4),
                    "gap_size": round(upper - lower, 4),
                    "returned": returned,
                    "price_level": round((lower + upper) / 2, 4),
                    "reason": "Bearish three-candle FVG: candle 1 low is above candle 3 high.",
                    "candles_used": [_candle_ref(first), _candle_ref(ordered[index - 1]), _candle_ref(current)],
                    "confidence_score": 68 if returned else 62,
                    **_detection_debug(current, (lower + upper) / 2, "fvg_midpoint"),
                }
            )

    return fvgs


def generate_setup_candidates(candles: list[Candle], liquidity_events: list[dict], fvgs: list[dict], swings: list[dict]) -> list[dict]:
    ordered = sorted(candles, key=attrgetter("timestamp"))
    index_by_timestamp = {candle.timestamp.isoformat(): index for index, candle in enumerate(ordered)}
    candidates: list[dict] = []
    keys: set[tuple[str, str, str, str]] = set()

    for event in liquidity_events:
        direction = "Short" if event["event_type"] == "sweep_above_high" else "Long"
        key = (event["timestamp"], "Sweep Reversal", direction, event["symbol"])
        if key in keys:
            continue
        keys.add(key)
        candidates.append(
            {
                "detected_id": _detected_id("candidate", event["symbol"], event["timeframe"], event["timestamp"], "sweep_reversal", direction),
                "timestamp": event["timestamp"],
                "symbol": event["symbol"],
                "timeframe": event["timeframe"],
                "direction": direction,
                "setup_type": "Sweep Reversal",
                "confidence_score": 68 if event["source"].startswith("previous_day") else 60,
                "reasons": [f"{event['source']} {event['event_type'].replace('_', ' ')}"],
                "price_level": event["price_level"],
                "reason": f"Candidate created from {event['source']} {event['event_type'].replace('_', ' ')}.",
                "candles_used": event["candles_used"],
                **_copy_detection_debug(event),
            }
        )

    recent_swing_by_index: dict[int, str] = {}
    for swing in swings:
        index = index_by_timestamp.get(swing["timestamp"])
        if index is not None:
            recent_swing_by_index[index] = swing["label"]

    for fvg in fvgs:
        fvg_index = index_by_timestamp.get(fvg["timestamp"])
        if fvg_index is None:
            continue
        recent_events = [
            event
            for event in liquidity_events
            if event["symbol"] == fvg["symbol"]
            and event["timeframe"] == fvg["timeframe"]
            and (event_index := index_by_timestamp.get(event["timestamp"])) is not None
            and 0 <= fvg_index - event_index <= 10
        ]
        recent_swing = recent_swing_by_index.get(fvg_index)

        if fvg["fvg_type"] == "bullish" and any(event["event_type"] == "sweep_below_low" for event in recent_events):
            confidence = 74 + (5 if fvg["gap_size"] >= 2 else 0) + (4 if recent_swing in {"HL", "HH"} else 0)
            key = (fvg["timestamp"], "Fabio Long candidate", "Long", fvg["symbol"])
            if key not in keys:
                keys.add(key)
                candidates.append(
                    {
                        "detected_id": _detected_id("candidate", fvg["symbol"], fvg["timeframe"], fvg["timestamp"], "fabio_long"),
                        "timestamp": fvg["timestamp"],
                        "symbol": fvg["symbol"],
                        "timeframe": fvg["timeframe"],
                        "direction": "Long",
                        "setup_type": "Fabio Long candidate",
                        "confidence_score": min(confidence, 95),
                        "reasons": ["Recent sweep below low", "Bullish FVG", "Structure support present" if recent_swing else "Structure not confirmed"],
                        "price_level": fvg["price_level"],
                        "reason": "Recent sweep below low followed by bullish FVG within the lookback window.",
                        "candles_used": fvg["candles_used"] + [event["detected_id"] for event in recent_events],
                        **_copy_detection_debug(fvg),
                    }
                )

        if fvg["fvg_type"] == "bearish" and any(event["event_type"] == "sweep_above_high" for event in recent_events):
            confidence = 74 + (5 if fvg["gap_size"] >= 2 else 0) + (4 if recent_swing in {"LH", "LL"} else 0)
            key = (fvg["timestamp"], "Fabio Short candidate", "Short", fvg["symbol"])
            if key not in keys:
                keys.add(key)
                candidates.append(
                    {
                        "detected_id": _detected_id("candidate", fvg["symbol"], fvg["timeframe"], fvg["timestamp"], "fabio_short"),
                        "timestamp": fvg["timestamp"],
                        "symbol": fvg["symbol"],
                        "timeframe": fvg["timeframe"],
                        "direction": "Short",
                        "setup_type": "Fabio Short candidate",
                        "confidence_score": min(confidence, 95),
                        "reasons": ["Recent sweep above high", "Bearish FVG", "Structure support present" if recent_swing else "Structure not confirmed"],
                        "price_level": fvg["price_level"],
                        "reason": "Recent sweep above high followed by bearish FVG within the lookback window.",
                        "candles_used": fvg["candles_used"] + [event["detected_id"] for event in recent_events],
                        **_copy_detection_debug(fvg),
                    }
                )

    return sorted(candidates, key=lambda candidate: candidate["timestamp"], reverse=True)


def _label_group(label_type: str) -> str:
    if label_type in {"HH", "HL", "LH", "LL"}:
        return "structure"
    if label_type in {"BOS", "CHOCH"}:
        return "bos_choch"
    if label_type == "Liquidity Grab":
        return "sweep_liquidity"
    if label_type == "FVG":
        return "fvg"
    return "zone"


def _comparison_detection_entries(
    protected_structure: list[dict],
    structure_sweeps: list[dict],
    liquidity_events: list[dict],
    fvgs: list[dict],
) -> list[dict]:
    entries: list[dict] = []
    for node in protected_structure:
        if node["structure_type"] in {"HH", "HL", "LH", "LL"}:
            entries.append(
                {
                    "detected_id": node["detected_id"],
                    "timestamp": node["timestamp"],
                    "label_type": node["structure_type"],
                    "label_value": node["protected_level_role"] or node["structure_type"],
                    "price_level": round(float(node["price"]), 4),
                    "source": "Protected Structure V2",
                    "original_csv_row_index": node.get("original_csv_row_index"),
                }
            )
        if node.get("caused_bos"):
            entries.append(
                {
                    "detected_id": f"{node['detected_id']}-bos",
                    "timestamp": node["timestamp"],
                    "label_type": "BOS",
                    "label_value": node["structure_type"],
                    "price_level": round(float(node["price"]), 4),
                    "source": "Protected Structure V2",
                    "original_csv_row_index": node.get("original_csv_row_index"),
                }
            )
        if node.get("caused_choch"):
            entries.append(
                {
                    "detected_id": f"{node['detected_id']}-choch",
                    "timestamp": node["timestamp"],
                    "label_type": "CHOCH",
                    "label_value": node["structure_type"],
                    "price_level": round(float(node["price"]), 4),
                    "source": "Protected Structure V2",
                    "original_csv_row_index": node.get("original_csv_row_index"),
                }
            )

    for event in structure_sweeps:
        entries.append(
            {
                "detected_id": event["detected_id"],
                "timestamp": event["timestamp"],
                "label_type": "Liquidity Grab",
                "label_value": event["swept_node_type"],
                "price_level": round(float(event["swept_node_price"]), 4),
                "source": "Structure Sweep",
                "original_csv_row_index": event.get("original_csv_row_index"),
            }
        )

    for event in liquidity_events:
        entries.append(
            {
                "detected_id": event["detected_id"],
                "timestamp": event["timestamp"],
                "label_type": "Liquidity Grab",
                "label_value": event.get("swept_level_type") or event["source"],
                "price_level": round(float(event["price_level"]), 4),
                "source": "Liquidity Sweep",
                "original_csv_row_index": event.get("original_csv_row_index"),
            }
        )

    for fvg in fvgs:
        entries.append(
            {
                "detected_id": fvg["detected_id"],
                "timestamp": fvg["timestamp"],
                "label_type": "FVG",
                "label_value": fvg["fvg_type"],
                "price_level": round(float(fvg["price_level"]), 4),
                "source": "FVG Detector",
                "original_csv_row_index": fvg.get("original_csv_row_index"),
            }
        )
    return entries


def _metric_for_group(reference_labels: list[dict], matches: list[dict], group: str) -> float:
    total = sum(1 for label in reference_labels if _label_group(label["label_type"]) == group)
    if not total:
        return 0.0
    matched = sum(1 for match in matches if _label_group(match["label_type"]) == group)
    return round((matched / total) * 100, 1)


def compare_reference_labels(
    reference_labels: list[dict],
    protected_structure: list[dict],
    structure_sweeps: list[dict],
    liquidity_events: list[dict],
    fvgs: list[dict],
    timeframe: str | None = None,
) -> dict:
    detection_entries = _comparison_detection_entries(protected_structure, structure_sweeps, liquidity_events, fvgs)
    timeframe_minutes = SUPPORTED_TIMEFRAMES.get(timeframe or "1m", 1)
    time_tolerance_seconds = timeframe_minutes * 60 * REFERENCE_LABEL_TIME_TOLERANCE_MULTIPLIER
    matched_detection_ids: set[str] = set()
    matches: list[dict] = []
    missed: list[dict] = []

    for label in sorted(reference_labels, key=lambda item: item["timestamp"]):
        label_time = datetime.fromisoformat(label["timestamp"])
        candidates: list[tuple[float, float, dict]] = []
        for detection in detection_entries:
            if detection["detected_id"] in matched_detection_ids:
                continue
            if detection["label_type"] != label["label_type"]:
                continue
            detection_time = datetime.fromisoformat(detection["timestamp"])
            time_diff = abs((detection_time - label_time).total_seconds())
            if time_diff > time_tolerance_seconds:
                continue
            price_diff = None
            if label.get("price_level") is not None and detection.get("price_level") is not None:
                price_diff = abs(float(detection["price_level"]) - float(label["price_level"]))
                if price_diff > STRUCTURE_LEVEL_TOLERANCE:
                    continue
            candidates.append((time_diff, price_diff if price_diff is not None else 0, detection))

        if not candidates:
            missed.append(
                {
                    "reference_label_id": label["detected_id"],
                    "timestamp": label["timestamp"],
                    "label_type": label["label_type"],
                    "label_value": label["label_value"],
                    "price_level": label.get("price_level"),
                    "source_column": label["source_column"],
                    "status": "missed_tradingview_label",
                }
            )
            continue

        time_diff, price_diff, detection = sorted(candidates, key=lambda item: (item[0], item[1]))[0]
        matched_detection_ids.add(detection["detected_id"])
        matches.append(
            {
                "reference_label_id": label["detected_id"],
                "market_detection_id": detection["detected_id"],
                "label_type": label["label_type"],
                "reference_timestamp": label["timestamp"],
                "market_timestamp": detection["timestamp"],
                "reference_value": label["label_value"],
                "market_value": detection["label_value"],
                "reference_price_level": label.get("price_level"),
                "market_price_level": detection.get("price_level"),
                "source_column": label["source_column"],
                "market_source": detection["source"],
                "timestamp_difference_seconds": round(time_diff, 2),
                "price_difference": round(price_diff, 4) if label.get("price_level") is not None and detection.get("price_level") is not None else None,
                "status": "matched",
            }
        )

    extra = [
        {
            "market_detection_id": detection["detected_id"],
            "timestamp": detection["timestamp"],
            "label_type": detection["label_type"],
            "label_value": detection["label_value"],
            "price_level": detection.get("price_level"),
            "market_source": detection["source"],
            "status": "extra_market_lab_detection",
        }
        for detection in detection_entries
        if detection["detected_id"] not in matched_detection_ids
    ]

    return {
        "matches": matches,
        "missed_tradingview_labels": missed,
        "extra_market_lab_detections": extra,
        "metrics": {
            "structure_match_rate": _metric_for_group(reference_labels, matches, "structure"),
            "sweep_liquidity_grab_match_rate": _metric_for_group(reference_labels, matches, "sweep_liquidity"),
            "bos_choch_match_rate": _metric_for_group(reference_labels, matches, "bos_choch"),
        },
    }


def _seconds_between(left: str, right: str) -> float:
    return abs((datetime.fromisoformat(left) - datetime.fromisoformat(right)).total_seconds())


def _price_difference(left: float | None, right: float | None) -> float | None:
    if left is None or right is None:
        return None
    return round(abs(float(left) - float(right)), 4)


def _nearest_reference_label(detection: dict, reference_labels: list[dict], same_type: bool = True) -> dict | None:
    candidates = [
        label
        for label in reference_labels
        if (label["label_type"] == detection["label_type"] if same_type else _label_group(label["label_type"]) == _label_group(detection["label_type"]))
    ]
    if not candidates:
        return None
    return sorted(
        candidates,
        key=lambda label: (
            _seconds_between(label["timestamp"], detection["timestamp"]),
            _price_difference(label.get("price_level"), detection.get("price_level")) or 0,
        ),
    )[0]


def _nearest_detection_entry(label: dict, detection_entries: list[dict], same_type: bool = True) -> dict | None:
    candidates = [
        detection
        for detection in detection_entries
        if (detection["label_type"] == label["label_type"] if same_type else _label_group(detection["label_type"]) == _label_group(label["label_type"]))
    ]
    if not candidates:
        return None
    return sorted(
        candidates,
        key=lambda detection: (
            _seconds_between(label["timestamp"], detection["timestamp"]),
            _price_difference(label.get("price_level"), detection.get("price_level")) or 0,
        ),
    )[0]


def _mismatch_cause_for_pair(time_diff: float | None, price_diff: float | None, time_tolerance_seconds: float, same_type_found: bool, group_neighbor_found: bool) -> str:
    if same_type_found and time_diff is not None and price_diff is not None and time_diff > time_tolerance_seconds and price_diff <= STRUCTURE_LEVEL_TOLERANCE:
        return "timezone_or_source_row_alignment"
    if same_type_found and time_diff is not None and price_diff is not None and time_diff <= time_tolerance_seconds and price_diff > STRUCTURE_LEVEL_TOLERANCE:
        return "price_level_difference"
    if same_type_found and time_diff is not None and time_diff > time_tolerance_seconds:
        return "timestamp_difference"
    if group_neighbor_found:
        return "structure_sequencing"
    return "swing_filtering"


def _cause_label(cause: str) -> str:
    return {
        "timezone_or_source_row_alignment": "Possible timezone or source-row alignment issue",
        "timestamp_difference": "Timestamp difference outside tolerance",
        "price_level_difference": "Price level differs from TradingView label",
        "structure_sequencing": "Structure sequencing differs from TradingView",
        "swing_filtering": "Swing filtering likely removed or added the structure point",
        "unrecognized_reference_column": "TradingView label column may be missing or unrecognized",
        "matched_with_drift": "Matched, but timestamp or price has drift",
    }.get(cause, cause.replace("_", " "))


def _recommendation_for_cause(cause: str) -> str:
    return {
        "timezone_or_source_row_alignment": "Add a timezone/source-row calibration check before changing swing thresholds.",
        "timestamp_difference": "Compare confirmation candle time vs source swing candle time; consider exposing both in matcher settings.",
        "price_level_difference": "Check whether TradingView labels use wick, close, midpoint, or confirmation candle level.",
        "structure_sequencing": "Review HH/HL/LH/LL sequencing rules and protected-level state transitions against the indicator.",
        "swing_filtering": "Calibrate Swing V2 left/right candles, minimum distance, and displacement threshold using labeled samples.",
        "unrecognized_reference_column": "Confirm the TradingView export includes the expected indicator label columns and non-empty values.",
        "matched_with_drift": "Keep current rule for now; inspect recurring drift before changing tolerance.",
    }.get(cause, "Collect more labeled examples before changing detector rules.")


def _mismatch_example(
    status: str,
    label_type: str,
    cause: str,
    reference_timestamp: str | None = None,
    market_timestamp: str | None = None,
    reference_price_level: float | None = None,
    market_price_level: float | None = None,
    source_column: str | None = None,
    market_source: str | None = None,
    reference_row: int | None = None,
    market_row: int | None = None,
    reference_value: str | None = None,
    market_value: str | None = None,
) -> dict:
    time_diff = _seconds_between(reference_timestamp, market_timestamp) if reference_timestamp and market_timestamp else None
    price_diff = _price_difference(reference_price_level, market_price_level)
    evidence_parts = [
        _cause_label(cause),
        f"TV {reference_value or label_type}" if reference_value else "",
        f"Market {market_value}" if market_value else "",
        f"time diff {round(time_diff, 2)}s" if time_diff is not None else "",
        f"price diff {price_diff}" if price_diff is not None else "",
        f"TV row {reference_row}" if reference_row is not None else "",
        f"Market row {market_row}" if market_row is not None else "",
    ]
    severity = 50
    if status == "missed_tradingview_label":
        severity += 35
    elif status == "extra_market_lab_detection":
        severity += 25
    if label_type in {"HH", "HL", "LH", "LL", "BOS", "CHOCH"}:
        severity += 15
    if time_diff is not None:
        severity += min(int(time_diff // 60), 20)
    if price_diff is not None:
        severity += min(int(price_diff), 20)

    return {
        "status": status,
        "label_type": label_type,
        "reference_timestamp": reference_timestamp,
        "market_timestamp": market_timestamp,
        "reference_price_level": reference_price_level,
        "market_price_level": market_price_level,
        "timestamp_difference_seconds": round(time_diff, 2) if time_diff is not None else None,
        "price_difference": price_diff,
        "source_column": source_column,
        "market_source": market_source,
        "reference_row": reference_row,
        "market_row": market_row,
        "likely_cause": cause,
        "evidence": "; ".join(part for part in evidence_parts if part),
        "recommended_change": _recommendation_for_cause(cause),
        "severity_score": min(severity, 100),
    }


def analyze_reference_label_mismatches(
    reference_labels: list[dict],
    protected_structure: list[dict],
    structure_sweeps: list[dict],
    liquidity_events: list[dict],
    fvgs: list[dict],
    label_comparison: dict,
    timeframe: str | None = None,
) -> dict:
    detection_entries = _comparison_detection_entries(protected_structure, structure_sweeps, liquidity_events, fvgs)
    detection_by_id = {entry["detected_id"]: entry for entry in detection_entries}
    reference_by_id = {label["detected_id"]: label for label in reference_labels}
    timeframe_minutes = SUPPORTED_TIMEFRAMES.get(timeframe or "1m", 1)
    time_tolerance_seconds = timeframe_minutes * 60 * REFERENCE_LABEL_TIME_TOLERANCE_MULTIPLIER
    examples: list[dict] = []

    for missed in label_comparison["missed_tradingview_labels"]:
        if missed["label_type"] not in {"HH", "HL", "LH", "LL", "BOS", "CHOCH", "Liquidity Grab"}:
            continue
        label = reference_by_id.get(missed["reference_label_id"], missed)
        nearest_same_type = _nearest_detection_entry(label, detection_entries, same_type=True)
        nearest_same_group = _nearest_detection_entry(label, detection_entries, same_type=False)
        nearest = nearest_same_type or nearest_same_group
        time_diff = _seconds_between(label["timestamp"], nearest["timestamp"]) if nearest else None
        price_diff = _price_difference(label.get("price_level"), nearest.get("price_level")) if nearest else None
        cause = _mismatch_cause_for_pair(time_diff, price_diff, time_tolerance_seconds, nearest_same_type is not None, nearest_same_group is not None)
        examples.append(
            _mismatch_example(
                "missed_tradingview_label",
                label["label_type"],
                cause,
                reference_timestamp=label["timestamp"],
                market_timestamp=nearest.get("timestamp") if nearest else None,
                reference_price_level=label.get("price_level"),
                market_price_level=nearest.get("price_level") if nearest else None,
                source_column=label.get("source_column"),
                market_source=nearest.get("source") if nearest else None,
                reference_row=label.get("original_csv_row_index"),
                market_row=nearest.get("original_csv_row_index") if nearest else None,
                reference_value=label.get("label_value"),
                market_value=nearest.get("label_value") if nearest else None,
            )
        )

    for extra in label_comparison["extra_market_lab_detections"]:
        if extra["label_type"] not in {"HH", "HL", "LH", "LL", "BOS", "CHOCH", "Liquidity Grab"}:
            continue
        detection = detection_by_id.get(extra["market_detection_id"], extra)
        nearest_same_type = _nearest_reference_label(detection, reference_labels, same_type=True)
        nearest_same_group = _nearest_reference_label(detection, reference_labels, same_type=False)
        nearest = nearest_same_type or nearest_same_group
        if not nearest:
            cause = "unrecognized_reference_column"
            time_diff = None
            price_diff = None
        else:
            time_diff = _seconds_between(nearest["timestamp"], detection["timestamp"])
            price_diff = _price_difference(nearest.get("price_level"), detection.get("price_level"))
            cause = _mismatch_cause_for_pair(time_diff, price_diff, time_tolerance_seconds, nearest_same_type is not None, nearest_same_group is not None)
        examples.append(
            _mismatch_example(
                "extra_market_lab_detection",
                detection["label_type"],
                cause,
                reference_timestamp=nearest.get("timestamp") if nearest else None,
                market_timestamp=detection.get("timestamp"),
                reference_price_level=nearest.get("price_level") if nearest else None,
                market_price_level=detection.get("price_level"),
                source_column=nearest.get("source_column") if nearest else None,
                market_source=detection.get("source"),
                reference_row=nearest.get("original_csv_row_index") if nearest else None,
                market_row=detection.get("original_csv_row_index"),
                reference_value=nearest.get("label_value") if nearest else None,
                market_value=detection.get("label_value"),
            )
        )

    for match in label_comparison["matches"]:
        if match["label_type"] not in {"HH", "HL", "LH", "LL", "BOS", "CHOCH", "Liquidity Grab"}:
            continue
        if not match.get("timestamp_difference_seconds") and not match.get("price_difference"):
            continue
        label = reference_by_id.get(match["reference_label_id"], {})
        detection = detection_by_id.get(match["market_detection_id"], {})
        examples.append(
            _mismatch_example(
                "matched_with_difference",
                match["label_type"],
                "matched_with_drift",
                reference_timestamp=match["reference_timestamp"],
                market_timestamp=match["market_timestamp"],
                reference_price_level=match.get("reference_price_level"),
                market_price_level=match.get("market_price_level"),
                source_column=match.get("source_column"),
                market_source=match.get("market_source"),
                reference_row=label.get("original_csv_row_index"),
                market_row=detection.get("original_csv_row_index"),
                reference_value=match.get("reference_value"),
                market_value=match.get("market_value"),
            )
        )

    top_examples = sorted(examples, key=lambda item: item["severity_score"], reverse=True)[:10]
    cause_counts: dict[str, int] = {}
    for example in examples:
        cause_counts[example["likely_cause"]] = cause_counts.get(example["likely_cause"], 0) + 1
    likely_causes = [
        {
            "cause": cause,
            "count": count,
            "evidence": _cause_label(cause),
        }
        for cause, count in sorted(cause_counts.items(), key=lambda item: item[1], reverse=True)
    ]
    recommended = []
    for cause in [item["cause"] for item in likely_causes]:
        recommendation = _recommendation_for_cause(cause)
        if recommendation not in recommended:
            recommended.append(recommendation)

    return {
        "top_examples": top_examples,
        "likely_causes": likely_causes,
        "recommended_detector_changes": recommended,
    }


def analyze_candles(
    candles: list[Candle],
    duplicate_rows: int = 0,
    missing_rows: list[dict] | None = None,
    swing_config: SwingConfig | dict | None = None,
    structure_sweep_config: dict | None = None,
    reference_labels: list[dict] | None = None,
) -> dict:
    ordered = sorted(candles, key=attrgetter("timestamp"))
    normalized_swing_config = normalize_swing_config(swing_config)
    raw_structure_sweep_config = structure_sweep_config or {}
    missing = missing_rows if missing_rows is not None else detect_missing_rows(ordered)
    swings = detect_structure(ordered)
    swings_v2 = detect_structure_v2(ordered, normalized_swing_config)
    raw_liquidity_events = detect_liquidity(ordered)
    raw_structure_sequence = build_structure_sequence(swings_v2, ordered, raw_liquidity_events)
    protected_structure = build_protected_structure_v2(swings_v2, ordered, raw_liquidity_events)
    structure_sweeps = detect_structure_sweeps(
        ordered,
        protected_structure,
        min_node_importance=int(raw_structure_sweep_config.get("min_node_importance", 50)),
        max_age_minutes=raw_structure_sweep_config.get("max_age_minutes"),
        min_pierce_size=float(raw_structure_sweep_config.get("min_pierce_size", 0)),
    )
    protected_structure = mark_structure_nodes_swept_by_structure_sweeps(protected_structure, structure_sweeps)
    liquidity_events = enrich_sweeps_with_structure(raw_liquidity_events, protected_structure)
    fvgs = detect_fvgs(ordered)
    candidates = generate_setup_candidates(ordered, liquidity_events, fvgs, swings)
    labels = reference_labels or []
    label_comparison = compare_reference_labels(
        labels,
        protected_structure,
        structure_sweeps,
        liquidity_events,
        fvgs,
        ordered[0].timeframe if ordered else None,
    )
    mismatch_analysis = analyze_reference_label_mismatches(
        labels,
        protected_structure,
        structure_sweeps,
        liquidity_events,
        fvgs,
        label_comparison,
        ordered[0].timeframe if ordered else None,
    )
    sessions: dict[str, int] = {}
    for candle in ordered:
        session = session_for_timestamp(candle.timestamp)
        sessions[session] = sessions.get(session, 0) + 1

    return {
        "candle_count": len(ordered),
        "duplicate_rows": duplicate_rows,
        "missing_rows": len(missing),
        "missing_timestamps": missing[:50],
        **_sample_metadata(ordered, missing),
        "session_counts": sessions,
        "swings": swings[-100:],
        "swings_v2": swings_v2[-100:],
        "swings_v1_count": len(swings),
        "swings_v2_count": len(swings_v2),
        "structure_sequence": raw_structure_sequence[-100:],
        "protected_structure": protected_structure[-100:],
        "protected_structure_count": len(protected_structure),
        "structure_sweeps": structure_sweeps[-100:],
        "reference_labels": labels[-500:],
        "label_comparison": {
            "matches": label_comparison["matches"][:200],
            "missed_tradingview_labels": label_comparison["missed_tradingview_labels"][:200],
            "extra_market_lab_detections": label_comparison["extra_market_lab_detections"][:200],
            "metrics": label_comparison["metrics"],
        },
        "mismatch_analysis": mismatch_analysis,
        "structure_sweep_config": {
            "min_node_importance": int(raw_structure_sweep_config.get("min_node_importance", 50)),
            "max_age_minutes": raw_structure_sweep_config.get("max_age_minutes"),
            "min_pierce_size": float(raw_structure_sweep_config.get("min_pierce_size", 0)),
        },
        "swing_config": {
            "mode": normalized_swing_config.mode,
            "left_candles": normalized_swing_config.left_candles,
            "right_candles": normalized_swing_config.right_candles,
            "min_swing_distance": normalized_swing_config.min_swing_distance,
        },
        "liquidity_events": liquidity_events[-100:],
        "fvgs": fvgs[-100:],
        "setup_candidates": candidates[:100],
    }
