import assert from "node:assert/strict";
import test from "node:test";

import {
  STAGE1_FMP_SYMBOL_LIMIT,
  fmpSingleSymbolEndpoint,
  stage1FmpTickers
} from "../lib/investment-scanner.ts";

test("stage1 FMP scan normalizes, deduplicates, and limits tickers", () => {
  const input = [" aapl ", "MSFT", "aapl", "", "nvda", ...Array.from({ length: 120 }, (_, index) => `T${index}`)];
  const result = stage1FmpTickers(input);

  assert.equal(result[0], "AAPL");
  assert.equal(result[1], "MSFT");
  assert.equal(result[2], "NVDA");
  assert.equal(result.length, STAGE1_FMP_SYMBOL_LIMIT);
  assert.equal(new Set(result).size, result.length);
});

test("FMP stable endpoint helper uses one symbol per request", () => {
  const tickers = stage1FmpTickers(["AAPL", "MSFT"]);
  const endpoints = tickers.map((ticker) => fmpSingleSymbolEndpoint("profile", ticker));

  assert.deepEqual(endpoints.map((endpoint) => endpoint.params.symbol), ["AAPL", "MSFT"]);
  assert.equal(endpoints.every((endpoint) => !endpoint.params.symbol.includes(",")), true);
});
