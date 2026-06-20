import pytest

from app.api.router import api_router
from app.services import investment_data
from app.services.investment_data import (
    YahooQuoteError,
    fetch_yahoo_quotes,
    normalize_quote_symbols,
    parse_yahoo_quote_response,
)
from app.services import sec_edgar
from app.services.sec_edgar import (
    extract_sec_cash_flow,
    fetch_sec_cash_flows,
    normalize_sec_symbols,
    parse_sec_ticker_map,
)


def test_normalize_quote_symbols_deduplicates_and_limits():
    symbols = normalize_quote_symbols([" aapl ", "MSFT", "aapl", "", "nvda"])

    assert symbols == ["AAPL", "MSFT", "NVDA"]


def test_parse_yahoo_quote_response_maps_stock_fields():
    rows = parse_yahoo_quote_response(
        {
            "quoteResponse": {
                "result": [
                    {
                        "symbol": "AAPL",
                        "shortName": "Apple Inc.",
                        "regularMarketPrice": 200,
                        "fiftyTwoWeekHigh": 250,
                        "marketCap": 3_000_000_000_000,
                        "trailingPE": 31.5,
                        "averageDailyVolume3Month": 55_000_000,
                        "sharesOutstanding": 15_000_000_000,
                    }
                ],
                "error": None,
            }
        }
    )

    assert rows[0]["ticker"] == "AAPL"
    assert rows[0]["company_name"] == "Apple Inc."
    assert rows[0]["current_price"] == 200
    assert rows[0]["market_cap"] == 3_000_000_000_000
    assert rows[0]["pe_ratio"] == 31.5
    assert rows[0]["drawdown_52w_pct"] == -20
    assert rows[0]["source"] == "Yahoo Finance"


def test_fetch_yahoo_quotes_surfaces_http_error_details(monkeypatch):
    class FakeResponse:
        status_code = 401
        text = "Unauthorized from Yahoo"

    monkeypatch.setattr(investment_data.httpx, "get", lambda *args, **kwargs: FakeResponse())

    with pytest.raises(YahooQuoteError, match="Yahoo HTTP 401: Unauthorized from Yahoo"):
        fetch_yahoo_quotes(["AAPL"])


def test_investment_yahoo_route_is_registered():
    paths = {route.path for route in api_router.routes}

    assert "/api/investment/yahoo-quotes" in paths


def sec_companyfacts_sample(*, negative_capex: bool = False):
    def annual_rows(values):
        return [
            {
                "start": f"{year - 1}-10-01",
                "end": f"{year}-09-30",
                "val": value,
                "accn": f"0000000000-{year}-000001",
                "fy": year,
                "fp": "FY",
                "form": "10-K",
                "filed": f"{year}-11-01",
            }
            for year, value in values
        ]

    capex_values = [(2024, 30), (2023, 25), (2022, 20), (2021, 18), (2020, 15)]
    if negative_capex:
        capex_values[0] = (2024, -30)
    return {
        "cik": 320193,
        "entityName": "Example Inc.",
        "facts": {
            "us-gaap": {
                "NetCashProvidedByUsedInOperatingActivities": {
                    "units": {
                        "USD": annual_rows(
                            [(2024, 130), (2023, 110), (2022, 90), (2021, 80), (2020, 70)]
                        )
                    }
                },
                "PaymentsToAcquirePropertyPlantAndEquipment": {
                    "units": {"USD": annual_rows(capex_values)}
                },
                "RevenueFromContractWithCustomerExcludingAssessedTax": {
                    "units": {"USD": annual_rows([(2024, 1000), (2023, 800)])}
                },
                "NetIncomeLoss": {
                    "units": {"USD": annual_rows([(2024, 100), (2023, 80)])}
                },
                "StockholdersEquity": {
                    "units": {"USD": annual_rows([(2024, 500), (2023, 400)])}
                },
                "DebtAndFinanceLeaseObligations": {
                    "units": {"USD": annual_rows([(2024, 250), (2023, 260)])}
                },
            },
            "dei": {
                "EntityCommonStockSharesOutstanding": {
                    "units": {"shares": annual_rows([(2024, 1000), (2023, 950)])}
                },
            }
        },
    }


def test_sec_symbol_and_ticker_mapping_normalization():
    assert normalize_sec_symbols(" aapl,MSFT,aapl,,brk-b ") == ["AAPL", "MSFT", "BRK-B"]
    mapping = parse_sec_ticker_map(
        {
            "0": {"cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc."},
            "1": {"cik_str": "789019", "ticker": "MSFT", "title": "Microsoft Corporation"},
        }
    )

    assert mapping["AAPL"]["cik"] == "0000320193"
    assert mapping["MSFT"]["cik"] == "0000789019"


def test_extract_sec_cash_flow_uses_annual_10k_periods_and_averages():
    result = extract_sec_cash_flow(sec_companyfacts_sample(), "AAPL")

    assert result["status"] == "success"
    assert result["cik"] == "0000320193"
    assert result["latest_operating_cash_flow"] == 130
    assert result["latest_capex"] == 30
    assert result["latest_fcf"] == 100
    assert result["average_fcf_3y"] == pytest.approx((100 + 85 + 70) / 3)
    assert result["average_fcf_5y"] == pytest.approx((100 + 85 + 70 + 62 + 55) / 5)
    assert result["fiscal_periods_used"] == ["2024", "2023", "2022", "2021", "2020"]
    assert result["confidence"] == "High"
    assert result["operating_cash_flow_concept"] == "NetCashProvidedByUsedInOperatingActivities"
    assert result["capex_concept"] == "PaymentsToAcquirePropertyPlantAndEquipment"
    assert result["revenue_growth_pct"] == pytest.approx(25)
    assert result["net_margin_pct"] == pytest.approx(10)
    assert result["roe_pct"] == pytest.approx(100 / 450 * 100)
    assert result["debt_to_equity"] == pytest.approx(0.5)
    assert result["shares_outstanding"] == 1000
    assert result["fundamental_status"] == "success"
    assert result["sec_fundamental_concepts"]["revenue"] == "RevenueFromContractWithCustomerExcludingAssessedTax"


def test_extract_sec_cash_flow_normalizes_negative_capex_sign():
    result = extract_sec_cash_flow(sec_companyfacts_sample(negative_capex=True), "AAPL")

    latest = result["annual_periods"][0]
    assert latest["capex_raw"] == -30
    assert latest["capex"] == 30
    assert latest["free_cash_flow"] == 100
    assert latest["capex_sign_adjusted"] is True


def test_sec_cash_flow_fetch_uses_disk_cache(monkeypatch, tmp_path):
    ticker_payload = {
        "0": {"cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc."},
    }
    companyfacts_payload = sec_companyfacts_sample()
    requested_urls = []

    def fake_sec_get(url):
        requested_urls.append(url)
        return ticker_payload if "company_tickers" in url else companyfacts_payload

    monkeypatch.setattr(sec_edgar, "_sec_get_json", fake_sec_get)

    first = fetch_sec_cash_flows(["AAPL"], cache_dir=tmp_path)
    second = fetch_sec_cash_flows(["AAPL"], cache_dir=tmp_path)

    assert first["requests_made"] == 2
    assert first["successes"] == 1
    assert second["requests_made"] == 0
    assert second["cache_hits"] == 2
    assert len(requested_urls) == 2


def test_investment_sec_route_is_registered():
    paths = {route.path for route in api_router.routes}

    assert "/api/investment/sec-cash-flow" in paths
