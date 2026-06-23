export const STAGE1_FMP_SYMBOL_LIMIT = 100;

export function stage1FmpTickers(tickers: string[], limit = STAGE1_FMP_SYMBOL_LIMIT) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const ticker of tickers) {
    const normalized = ticker.trim().toUpperCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
    if (output.length >= limit) break;
  }
  return output;
}

export function fmpSingleSymbolEndpoint(path: string, ticker: string) {
  return {
    path,
    params: { symbol: ticker.trim().toUpperCase() }
  };
}
