from __future__ import annotations

import json
import math
import os
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx


SEC_TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json"
SEC_COMPANY_FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
SEC_USER_AGENT = os.getenv(
    "SEC_USER_AGENT",
    "FabioEdgeResearchLab/1.0 fabio-edge-research-lab@example.com",
)
SEC_HEADERS = {
    "User-Agent": SEC_USER_AGENT,
    "Accept": "application/json",
    "Accept-Encoding": "gzip, deflate",
}
SEC_MIN_REQUEST_INTERVAL_SECONDS = max(
    0.5,
    float(os.getenv("SEC_MIN_REQUEST_INTERVAL_SECONDS", "1.0")),
)
SEC_CACHE_DIR = Path(
    os.getenv(
        "SEC_CACHE_DIR",
        str(Path(__file__).resolve().parents[2] / "data" / "sec_edgar"),
    )
)
TICKER_MAP_CACHE_TTL = timedelta(days=7)
COMPANY_FACTS_CACHE_TTL = timedelta(hours=24)

OPERATING_CASH_FLOW_CONCEPTS = (
    "NetCashProvidedByUsedInOperatingActivities",
    "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
)
CAPEX_CONCEPTS = (
    "PaymentsToAcquirePropertyPlantAndEquipment",
    "PaymentsToAcquireProductiveAssets",
)
REVENUE_CONCEPTS = (
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "Revenues",
    "SalesRevenueNet",
    "SalesRevenueGoodsNet",
    "SalesRevenueServicesNet",
)
NET_INCOME_CONCEPTS = (
    "NetIncomeLoss",
    "ProfitLoss",
    "NetIncomeLossAvailableToCommonStockholdersBasic",
)
EQUITY_CONCEPTS = (
    "StockholdersEquity",
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
)
TOTAL_DEBT_CONCEPTS = (
    "DebtAndFinanceLeaseObligations",
    "LongTermDebtAndFinanceLeaseObligations",
    "LongTermDebt",
)
CURRENT_DEBT_CONCEPTS = (
    "ShortTermBorrowings",
    "ShortTermDebt",
    "DebtCurrent",
    "LongTermDebtCurrent",
    "LongTermDebtAndFinanceLeaseObligationsCurrent",
)
NONCURRENT_DEBT_CONCEPTS = (
    "LongTermDebtNoncurrent",
    "LongTermDebtAndFinanceLeaseObligationsNoncurrent",
    "DebtNoncurrent",
)
SHARES_OUTSTANDING_CONCEPTS = (
    "EntityCommonStockSharesOutstanding",
    "WeightedAverageNumberOfDilutedSharesOutstanding",
    "WeightedAverageNumberOfSharesOutstandingBasic",
)
ANNUAL_FORMS = {"10-K", "10-K/A"}

_request_lock = threading.Lock()
_last_request_started = 0.0


class SecEdgarError(RuntimeError):
    pass


def normalize_sec_symbols(symbols: str | list[str]) -> list[str]:
    raw_symbols = symbols.split(",") if isinstance(symbols, str) else symbols
    cleaned: list[str] = []
    seen: set[str] = set()
    for item in raw_symbols:
        symbol = item.strip().upper()
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        cleaned.append(symbol)
    return cleaned[:25]


def zero_pad_cik(value: Any) -> str:
    digits = "".join(character for character in str(value) if character.isdigit())
    if not digits:
        raise SecEdgarError("CIK is missing or invalid.")
    return digits.zfill(10)


def parse_sec_ticker_map(payload: Any) -> dict[str, dict[str, str]]:
    if isinstance(payload, dict):
        records = list(payload.values())
    elif isinstance(payload, list):
        records = payload
    else:
        raise SecEdgarError("SEC ticker mapping response has an unsupported shape.")

    mapping: dict[str, dict[str, str]] = {}
    for item in records:
        if not isinstance(item, dict):
            continue
        ticker = str(item.get("ticker") or "").strip().upper()
        cik = item.get("cik_str")
        if not ticker or cik is None:
            continue
        mapping[ticker] = {
            "ticker": ticker,
            "cik": zero_pad_cik(cik),
            "company_name": str(item.get("title") or ticker),
        }
    if not mapping:
        raise SecEdgarError("SEC ticker mapping response contained no usable records.")
    return mapping


def _finite_number(value: Any) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None


def _iso_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _is_annual_fact(item: dict[str, Any]) -> bool:
    if str(item.get("form") or "").upper() not in ANNUAL_FORMS:
        return False
    fiscal_period = str(item.get("fp") or "").upper()
    if fiscal_period and fiscal_period != "FY":
        return False
    start = _iso_datetime(item.get("start"))
    end = _iso_datetime(item.get("end"))
    if start and end:
        duration_days = (end - start).days
        if duration_days < 300 or duration_days > 430:
            return False
    return _finite_number(item.get("val")) is not None


def _fiscal_year(item: dict[str, Any]) -> str:
    fiscal_year = item.get("fy")
    if fiscal_year is not None and str(fiscal_year).strip():
        return str(fiscal_year)
    end = str(item.get("end") or "")
    return end[:4]


def _fact_sort_key(item: dict[str, Any]) -> tuple[str, str, str]:
    return (
        str(item.get("filed") or ""),
        str(item.get("end") or ""),
        str(item.get("accn") or ""),
    )


def _annual_concept_values(
    us_gaap: dict[str, Any],
    concepts: tuple[str, ...],
) -> dict[str, dict[str, Any]]:
    return _annual_concept_values_for_units(us_gaap, concepts, ("USD",))


def _annual_concept_values_for_units(
    taxonomy: dict[str, Any],
    concepts: tuple[str, ...],
    unit_names: tuple[str, ...],
) -> dict[str, dict[str, Any]]:
    selected: dict[str, dict[str, Any]] = {}
    for concept in concepts:
        concept_data = taxonomy.get(concept)
        if not isinstance(concept_data, dict):
            continue
        units = concept_data.get("units")
        if not isinstance(units, dict):
            continue
        unit_rows: list[Any] = []
        for unit_name in unit_names:
            rows = units.get(unit_name)
            if isinstance(rows, list):
                unit_rows = rows
                break
        if not unit_rows:
            continue
        concept_rows: dict[str, dict[str, Any]] = {}
        for raw_item in unit_rows:
            if not isinstance(raw_item, dict) or not _is_annual_fact(raw_item):
                continue
            fiscal_year = _fiscal_year(raw_item)
            if not fiscal_year:
                continue
            item = {**raw_item, "concept": concept}
            current = concept_rows.get(fiscal_year)
            if current is None or _fact_sort_key(item) > _fact_sort_key(current):
                concept_rows[fiscal_year] = item
        for fiscal_year, item in concept_rows.items():
            selected.setdefault(fiscal_year, item)
    return selected


def _latest_annual_row(
    taxonomy: dict[str, Any],
    concepts: tuple[str, ...],
    unit_names: tuple[str, ...] = ("USD",),
) -> dict[str, Any] | None:
    values = _annual_concept_values_for_units(taxonomy, concepts, unit_names)
    if not values:
        return None
    fiscal_year = max(values, key=_year_sort_key)
    return values[fiscal_year]


def _annual_rows_sorted(
    taxonomy: dict[str, Any],
    concepts: tuple[str, ...],
    unit_names: tuple[str, ...] = ("USD",),
) -> list[dict[str, Any]]:
    values = _annual_concept_values_for_units(taxonomy, concepts, unit_names)
    return [values[year] for year in sorted(values, key=_year_sort_key, reverse=True)]


def _row_value(row: dict[str, Any] | None) -> float | None:
    return _finite_number(row.get("val")) if row else None


def _percent_change(current: float | None, prior: float | None) -> float | None:
    if current is None or prior is None or prior == 0:
        return None
    return ((current - prior) / abs(prior)) * 100


def _debt_value(us_gaap: dict[str, Any]) -> tuple[float | None, dict[str, str]]:
    total_row = _latest_annual_row(us_gaap, TOTAL_DEBT_CONCEPTS)
    total_value = _row_value(total_row)
    if total_value is not None:
        return total_value, {"debt": str(total_row.get("concept") or "")}

    current_row = _latest_annual_row(us_gaap, CURRENT_DEBT_CONCEPTS)
    noncurrent_row = _latest_annual_row(us_gaap, NONCURRENT_DEBT_CONCEPTS)
    current_value = _row_value(current_row) or 0
    noncurrent_value = _row_value(noncurrent_row) or 0
    if current_value == 0 and noncurrent_value == 0:
        return None, {}
    return current_value + noncurrent_value, {
        "current_debt": str(current_row.get("concept") if current_row else ""),
        "noncurrent_debt": str(noncurrent_row.get("concept") if noncurrent_row else ""),
    }


def extract_sec_fundamentals(payload: dict[str, Any]) -> dict[str, Any]:
    facts = payload.get("facts")
    us_gaap = facts.get("us-gaap") if isinstance(facts, dict) else None
    dei = facts.get("dei") if isinstance(facts, dict) else None
    if not isinstance(us_gaap, dict):
        return {"fundamental_status": "missing", "fundamental_error": "No us-gaap facts found."}

    revenue_rows = _annual_rows_sorted(us_gaap, REVENUE_CONCEPTS)
    net_income_rows = _annual_rows_sorted(us_gaap, NET_INCOME_CONCEPTS)
    equity_rows = _annual_rows_sorted(us_gaap, EQUITY_CONCEPTS)
    latest_revenue = _row_value(revenue_rows[0] if revenue_rows else None)
    prior_revenue = _row_value(revenue_rows[1] if len(revenue_rows) > 1 else None)
    latest_net_income = _row_value(net_income_rows[0] if net_income_rows else None)
    latest_equity = _row_value(equity_rows[0] if equity_rows else None)
    prior_equity = _row_value(equity_rows[1] if len(equity_rows) > 1 else None)
    debt, debt_concepts = _debt_value(us_gaap)

    share_taxonomy = dei if isinstance(dei, dict) else us_gaap
    share_row = _latest_annual_row(share_taxonomy, SHARES_OUTSTANDING_CONCEPTS, ("shares",))
    shares = _row_value(share_row)

    average_equity = None
    if latest_equity is not None and prior_equity is not None:
        average_equity = (latest_equity + prior_equity) / 2
    elif latest_equity is not None:
        average_equity = latest_equity

    concept_map = {
        "revenue": str(revenue_rows[0].get("concept") if revenue_rows else ""),
        "net_income": str(net_income_rows[0].get("concept") if net_income_rows else ""),
        "equity": str(equity_rows[0].get("concept") if equity_rows else ""),
        "shares_outstanding": str(share_row.get("concept") if share_row else ""),
        **debt_concepts,
    }
    values = {
        "revenue_growth_pct": _percent_change(latest_revenue, prior_revenue),
        "net_margin_pct": (latest_net_income / latest_revenue) * 100 if latest_net_income is not None and latest_revenue else None,
        "roe_pct": (latest_net_income / average_equity) * 100 if latest_net_income is not None and average_equity else None,
        "debt_to_equity": debt / latest_equity if debt is not None and latest_equity else None,
        "shares_outstanding": shares,
        "sec_fundamental_concepts": concept_map,
        "sec_fundamental_periods": {
            "revenue": [row.get("fy") for row in revenue_rows[:2]],
            "net_income": [row.get("fy") for row in net_income_rows[:1]],
            "equity": [row.get("fy") for row in equity_rows[:2]],
        },
    }
    usable = [
        values["revenue_growth_pct"],
        values["net_margin_pct"],
        values["roe_pct"],
        values["debt_to_equity"],
        values["shares_outstanding"],
    ]
    values["fundamental_status"] = "success" if any(value is not None for value in usable) else "missing"
    return values


def _year_sort_key(value: str) -> tuple[int, str]:
    try:
        return int(value), value
    except ValueError:
        return -1, value


def extract_sec_cash_flow(payload: dict[str, Any], ticker: str = "") -> dict[str, Any]:
    facts = payload.get("facts")
    us_gaap = facts.get("us-gaap") if isinstance(facts, dict) else None
    if not isinstance(us_gaap, dict):
        return {
            "ticker": ticker.upper(),
            "status": "missing",
            "error": "SEC companyfacts response has no us-gaap facts.",
            "annual_periods": [],
        }

    operating = _annual_concept_values(us_gaap, OPERATING_CASH_FLOW_CONCEPTS)
    capex = _annual_concept_values(us_gaap, CAPEX_CONCEPTS)
    shared_years = sorted(set(operating) & set(capex), key=_year_sort_key, reverse=True)
    periods: list[dict[str, Any]] = []
    for fiscal_year in shared_years:
        operating_row = operating[fiscal_year]
        capex_row = capex[fiscal_year]
        operating_value = _finite_number(operating_row.get("val"))
        raw_capex = _finite_number(capex_row.get("val"))
        if operating_value is None or raw_capex is None:
            continue
        normalized_capex = abs(raw_capex)
        sign_adjusted = raw_capex < 0
        periods.append(
            {
                "fiscal_year": fiscal_year,
                "start": str(operating_row.get("start") or capex_row.get("start") or ""),
                "end": str(operating_row.get("end") or capex_row.get("end") or ""),
                "filed": max(
                    str(operating_row.get("filed") or ""),
                    str(capex_row.get("filed") or ""),
                ),
                "form": str(operating_row.get("form") or capex_row.get("form") or ""),
                "operating_cash_flow": operating_value,
                "operating_cash_flow_concept": operating_row["concept"],
                "capex_raw": raw_capex,
                "capex": normalized_capex,
                "capex_concept": capex_row["concept"],
                "capex_sign_adjusted": sign_adjusted,
                "capex_sign_note": (
                    "Negative SEC capex value normalized to a positive cash-outflow magnitude before subtraction."
                    if sign_adjusted
                    else "SEC capex treated as a positive cash-outflow magnitude and subtracted from operating cash flow."
                ),
                "free_cash_flow": operating_value - normalized_capex,
            }
        )
        if len(periods) >= 5:
            break

    fundamentals = extract_sec_fundamentals(payload)

    if not periods:
        return {
            "ticker": ticker.upper(),
            "status": "missing",
            "error": "No matching annual operating cash flow and capex periods were found.",
            "company_name": str(payload.get("entityName") or ticker.upper()),
            "cik": zero_pad_cik(payload.get("cik")) if payload.get("cik") else "",
            "operating_cash_flow_concepts_found": [
                concept for concept in OPERATING_CASH_FLOW_CONCEPTS if concept in us_gaap
            ],
            "capex_concepts_found": [
                concept for concept in CAPEX_CONCEPTS if concept in us_gaap
            ],
            "annual_periods": [],
            **fundamentals,
        }

    fcf_values = [period["free_cash_flow"] for period in periods]
    latest = periods[0]
    confidence = "High" if len(periods) >= 3 else "Medium" if len(periods) == 2 else "Low"
    return {
        "ticker": ticker.upper(),
        "status": "success",
        "company_name": str(payload.get("entityName") or ticker.upper()),
        "cik": zero_pad_cik(payload.get("cik")) if payload.get("cik") else "",
        "latest_fcf": latest["free_cash_flow"],
        "average_fcf_3y": sum(fcf_values[:3]) / 3 if len(fcf_values) >= 3 else None,
        "average_fcf_5y": sum(fcf_values[:5]) / 5 if len(fcf_values) >= 5 else None,
        "latest_operating_cash_flow": latest["operating_cash_flow"],
        "latest_capex": latest["capex"],
        "operating_cash_flow_concept": latest["operating_cash_flow_concept"],
        "capex_concept": latest["capex_concept"],
        "operating_cash_flow_concepts_found": [
            concept for concept in OPERATING_CASH_FLOW_CONCEPTS if concept in us_gaap
        ],
        "capex_concepts_found": [
            concept for concept in CAPEX_CONCEPTS if concept in us_gaap
        ],
        "fiscal_periods_used": [period["fiscal_year"] for period in periods],
        "annual_periods": periods,
        "confidence": confidence,
        "source": "SEC EDGAR XBRL",
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        **fundamentals,
    }


def _cache_file(name: str, cache_dir: Path) -> Path:
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / name


def _read_cache(path: Path, ttl: timedelta) -> Any | None:
    if not path.exists():
        return None
    modified = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    if datetime.now(timezone.utc) - modified > ttl:
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _write_cache(path: Path, payload: Any) -> None:
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    temporary.write_text(json.dumps(payload), encoding="utf-8")
    temporary.replace(path)


def _sec_get_json(url: str) -> Any:
    global _last_request_started
    with _request_lock:
        wait_seconds = SEC_MIN_REQUEST_INTERVAL_SECONDS - (time.monotonic() - _last_request_started)
        if wait_seconds > 0:
            time.sleep(wait_seconds)
        _last_request_started = time.monotonic()
        try:
            response = httpx.get(url, headers=SEC_HEADERS, timeout=30)
        except httpx.HTTPError as exc:
            raise SecEdgarError(f"SEC request failed before response: {exc}") from exc
    if response.status_code >= 400:
        body = response.text[:500].replace("\n", " ")
        raise SecEdgarError(f"SEC HTTP {response.status_code}: {body}")
    try:
        return response.json()
    except ValueError as exc:
        raise SecEdgarError("SEC response was not valid JSON.") from exc


def get_sec_ticker_map(
    *,
    cache_dir: Path = SEC_CACHE_DIR,
    force_refresh: bool = False,
) -> tuple[dict[str, dict[str, str]], bool, int]:
    path = _cache_file("company_tickers.json", cache_dir)
    cached = None if force_refresh else _read_cache(path, TICKER_MAP_CACHE_TTL)
    if cached is not None:
        return parse_sec_ticker_map(cached), True, 0
    payload = _sec_get_json(SEC_TICKER_MAP_URL)
    _write_cache(path, payload)
    return parse_sec_ticker_map(payload), False, 1


def fetch_sec_companyfacts(
    cik: str,
    *,
    cache_dir: Path = SEC_CACHE_DIR,
    force_refresh: bool = False,
) -> tuple[dict[str, Any], bool, int]:
    padded_cik = zero_pad_cik(cik)
    path = _cache_file(f"companyfacts-CIK{padded_cik}.json", cache_dir)
    cached = None if force_refresh else _read_cache(path, COMPANY_FACTS_CACHE_TTL)
    if isinstance(cached, dict):
        return cached, True, 0
    payload = _sec_get_json(SEC_COMPANY_FACTS_URL.format(cik=padded_cik))
    if not isinstance(payload, dict):
        raise SecEdgarError("SEC companyfacts response has an unsupported shape.")
    _write_cache(path, payload)
    return payload, False, 1


def fetch_sec_cash_flows(
    symbols: str | list[str],
    *,
    cache_dir: Path = SEC_CACHE_DIR,
    force_refresh: bool = False,
) -> dict[str, Any]:
    symbol_list = normalize_sec_symbols(symbols)
    if not symbol_list:
        return {
            "source": "SEC EDGAR XBRL",
            "requested_symbols": [],
            "results": [],
            "requests_made": 0,
            "cache_hits": 0,
            "successes": 0,
            "failures": 0,
        }

    ticker_map, ticker_map_cache_hit, requests_made = get_sec_ticker_map(
        cache_dir=cache_dir,
        force_refresh=force_refresh,
    )
    cache_hits = 1 if ticker_map_cache_hit else 0
    results: list[dict[str, Any]] = []

    for ticker in symbol_list:
        mapping = ticker_map.get(ticker)
        if not mapping:
            results.append(
                {
                    "ticker": ticker,
                    "status": "missing",
                    "error": "Ticker was not found in the SEC company ticker mapping.",
                    "annual_periods": [],
                }
            )
            continue
        try:
            payload, from_cache, request_count = fetch_sec_companyfacts(
                mapping["cik"],
                cache_dir=cache_dir,
                force_refresh=force_refresh,
            )
            requests_made += request_count
            if from_cache:
                cache_hits += 1
            extracted = extract_sec_cash_flow(payload, ticker)
            extracted.update(
                {
                    "ticker": ticker,
                    "cik": mapping["cik"],
                    "company_name": extracted.get("company_name") or mapping["company_name"],
                    "from_cache": from_cache,
                }
            )
            results.append(extracted)
        except SecEdgarError as exc:
            results.append(
                {
                    "ticker": ticker,
                    "cik": mapping["cik"],
                    "company_name": mapping["company_name"],
                    "status": "error",
                    "error": str(exc),
                    "annual_periods": [],
                }
            )

    successes = sum(result.get("status") == "success" for result in results)
    return {
        "source": "SEC EDGAR XBRL",
        "requested_symbols": symbol_list,
        "ticker_map_cache_hit": ticker_map_cache_hit,
        "results": results,
        "requests_made": requests_made,
        "cache_hits": cache_hits,
        "successes": successes,
        "failures": len(results) - successes,
        "rate_limit_seconds": SEC_MIN_REQUEST_INTERVAL_SECONDS,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
