from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

import httpx


YAHOO_QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote"
YAHOO_HEADERS = {
    "User-Agent": "Mozilla/5.0 FabioEdgeResearchLab/1.0",
    "Accept": "application/json,text/plain,*/*",
}


class YahooQuoteError(RuntimeError):
    pass


def normalize_quote_symbols(symbols: str | list[str]) -> list[str]:
    raw_symbols = symbols.split(",") if isinstance(symbols, str) else symbols
    cleaned: list[str] = []
    seen: set[str] = set()
    for item in raw_symbols:
        symbol = item.strip().upper()
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        cleaned.append(symbol)
    return cleaned[:120]


def _finite_number(value: Any) -> float | None:
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None


def _set_if_number(row: dict[str, Any], key: str, value: Any) -> None:
    parsed = _finite_number(value)
    if parsed is not None:
        row[key] = parsed


def parse_yahoo_quote_response(payload: dict[str, Any]) -> list[dict[str, Any]]:
    quote_response = payload.get("quoteResponse")
    if not isinstance(quote_response, dict):
        raise YahooQuoteError("Yahoo response missing quoteResponse.")

    error = quote_response.get("error")
    if error:
        raise YahooQuoteError(f"Yahoo response error: {error}")

    results = quote_response.get("result")
    if not isinstance(results, list):
        raise YahooQuoteError("Yahoo response missing quote results.")

    now = datetime.now(timezone.utc).isoformat()
    quotes: list[dict[str, Any]] = []
    for item in results:
        if not isinstance(item, dict):
            continue
        symbol = str(item.get("symbol") or "").upper().strip()
        if not symbol:
            continue

        row: dict[str, Any] = {
            "ticker": symbol,
            "company_name": str(item.get("shortName") or item.get("longName") or symbol),
            "source": "Yahoo Finance",
            "last_updated": now,
        }
        price = _finite_number(item.get("regularMarketPrice"))
        high_52 = _finite_number(item.get("fiftyTwoWeekHigh"))
        if price is not None:
            row["current_price"] = price
        if price is not None and high_52 is not None and high_52 > 0:
            row["drawdown_52w_pct"] = ((price - high_52) / high_52) * 100
        _set_if_number(row, "market_cap", item.get("marketCap"))
        _set_if_number(row, "pe_ratio", item.get("trailingPE"))
        _set_if_number(row, "average_volume", item.get("averageDailyVolume3Month"))
        _set_if_number(row, "shares_outstanding", item.get("sharesOutstanding"))
        quotes.append(row)

    return quotes


def fetch_yahoo_quotes(symbols: str | list[str]) -> list[dict[str, Any]]:
    symbol_list = normalize_quote_symbols(symbols)
    if not symbol_list:
        return []

    try:
        response = httpx.get(
            YAHOO_QUOTE_URL,
            params={"symbols": ",".join(symbol_list)},
            headers=YAHOO_HEADERS,
            timeout=12,
        )
    except httpx.HTTPError as exc:
        raise YahooQuoteError(f"Yahoo request failed before response: {exc}") from exc

    if response.status_code >= 400:
        body = response.text[:500].replace("\n", " ")
        raise YahooQuoteError(f"Yahoo HTTP {response.status_code}: {body}")

    try:
        payload = response.json()
    except ValueError as exc:
        raise YahooQuoteError("Yahoo response was not valid JSON.") from exc

    return parse_yahoo_quote_response(payload)
