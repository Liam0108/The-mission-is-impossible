from fastapi import APIRouter, HTTPException, Query, status

from app.services.investment_data import YahooQuoteError, fetch_yahoo_quotes, normalize_quote_symbols
from app.services.sec_edgar import SecEdgarError, fetch_sec_cash_flows, normalize_sec_symbols

router = APIRouter()


@router.get("/yahoo-quotes")
def yahoo_quotes(symbols: str = Query(..., description="Comma-separated symbols, for example AAPL,MSFT,NVDA")) -> dict:
    symbol_list = normalize_quote_symbols(symbols)
    if not symbol_list:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one symbol is required.")

    try:
        quotes = fetch_yahoo_quotes(symbol_list)
    except YahooQuoteError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "message": "Backend Yahoo fetch failed.",
                "error": str(exc),
                "symbols": symbol_list,
            },
        ) from exc

    return {
        "source": "Yahoo Finance",
        "count": len(quotes),
        "requested_symbols": symbol_list,
        "quotes": quotes,
    }


@router.get("/sec-cash-flow")
def sec_cash_flow(
    symbols: str = Query(..., description="Comma-separated U.S. stock symbols, maximum 25"),
    force_refresh: bool = Query(False),
) -> dict:
    symbol_list = normalize_sec_symbols(symbols)
    if not symbol_list:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one symbol is required.")

    try:
        return fetch_sec_cash_flows(symbol_list, force_refresh=force_refresh)
    except SecEdgarError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "message": "Backend SEC EDGAR fetch failed.",
                "error": str(exc),
                "symbols": symbol_list,
            },
        ) from exc
