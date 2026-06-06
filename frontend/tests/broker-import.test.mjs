import assert from "node:assert/strict";
import test from "node:test";

import { parseBrokerCsv } from "../lib/broker-import.ts";

const header = "symbol,tickSize,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration";
const rows = [
  "MNQM6,0.25,2,30189,30228,$156.00,06/04/2026 20:08:41,06/04/2026 19:53:10,15min 30sec",
  "MNQM6,0.25,2,30149,30206.75,$231.00,06/04/2026 20:30:00,06/04/2026 20:10:00,20min",
  "MNQM6,0.25,2,30149,30181.75,$131.00,06/04/2026 21:00:00,06/04/2026 20:45:00,15min",
  "MNQM6,0.25,4,30138.25,30205.75,$540.00,06/04/2026 21:30:00,06/04/2026 21:10:00,20min"
];
const sampleCsv = [header, ...rows].join("\n");

test("parses Tradovate Closed Trades rows without creating NoTrade or zero R", () => {
  const preview = parseBrokerCsv(sampleCsv, [], "tradovate-closed-trades.csv");

  assert.equal(preview.source, "Tradovate Closed Trades");
  assert.equal(preview.summary.totalRows, 4);
  assert.equal(preview.summary.importableRows, 4);
  assert.equal(preview.summary.duplicateRows, 0);
  assert.equal(preview.summary.errorRows, 0);
  assert.deepEqual(
    preview.columnMapping.map(({ source, target }) => [source, target]),
    [
      ["symbol", "broker_symbol"],
      ["qty", "quantity"],
      ["buyPrice", "buy_price"],
      ["sellPrice", "sell_price"],
      ["pnl", "gross_pnl"],
      ["boughtTimestamp", "bought_time"],
      ["soldTimestamp", "sold_time"],
      ["duration", "holding_time_text"]
    ]
  );

  const expectedPnls = [156, 231, 131, 540];
  const expectedEntries = [30228, 30206.75, 30181.75, 30205.75];
  const expectedExits = [30189, 30149, 30149, 30138.25];
  preview.candidates.forEach((candidate, index) => {
    assert.equal(candidate.payload.instrument, "MNQ");
    assert.equal(candidate.payload.broker_symbol, "MNQM6");
    assert.equal(candidate.transactionOrder, "Sell first");
    assert.equal(candidate.inferredDirection, "Short");
    assert.equal(candidate.payload.direction, "Short");
    assert.equal(candidate.payload.entry_price, expectedEntries[index]);
    assert.equal(candidate.payload.exit_price, expectedExits[index]);
    assert.ok(new Date(candidate.payload.entry_time).getTime() < new Date(candidate.payload.exit_time).getTime());
    assert.equal(candidate.payload.result, "TP1");
    assert.equal(candidate.payload.gross_pnl, expectedPnls[index]);
    assert.equal(candidate.payload.net_pnl, expectedPnls[index]);
    assert.equal(candidate.payload.result_r, null);
    assert.equal(candidate.payload.imported, true);
    assert.equal(candidate.payload.review_status, "unreviewed");
    assert.equal(candidate.payload.trade_decision, "Taken");
    assert.equal(candidate.payload.data_quality, "incomplete");
    assert.notEqual(candidate.payload.result, "NoTrade");
    assert.match(candidate.payload.broker_trade_id, /^tradovate-[a-f0-9]{16}$/);
    assert.match(candidate.directionInference, /Short inferred from timestamp order/);
    assert.equal(candidate.pnlValidation, "Matched");
    assert.deepEqual(candidate.warnings, []);
  });

  assert.equal(preview.candidates[0].payload.holding_time_text, "15min 30sec");
  assert.equal(preview.candidates[0].payload.holding_time_minutes, 15.5);
});

test("keeps timestamp direction and warns when PnL validation mismatches", () => {
  const csv = [
    header,
    "MNQM6,0.25,2,30200,30190,$40.00,06/04/2026 20:20:00,06/04/2026 20:00:00,20min"
  ].join("\n");
  const candidate = parseBrokerCsv(csv, []).candidates[0];

  assert.equal(candidate.payload.direction, "Short");
  assert.equal(candidate.payload.entry_price, 30190);
  assert.equal(candidate.payload.exit_price, 30200);
  assert.equal(candidate.payload.result, "TP1");
  assert.equal(candidate.transactionOrder, "Sell first");
  assert.match(candidate.directionInference, /Short inferred from timestamp order/);
  assert.equal(candidate.pnlValidation, "Mismatch");
  assert.match(candidate.warnings[0], /Timestamp order implies Short/);
});

test("warns and blocks import when a transaction timestamp is missing", () => {
  const csv = [
    header,
    "MNQM6,0.25,2,30189,30228,$156.00,06/04/2026 20:08:41,,15min 30sec"
  ].join("\n");
  const candidate = parseBrokerCsv(csv, []).candidates[0];

  assert.equal(candidate.transactionOrder, "Unknown");
  assert.equal(candidate.inferredDirection, null);
  assert.equal(candidate.pnlValidation, "Unavailable");
  assert.match(candidate.warnings[0], /Missing boughtTimestamp or soldTimestamp/);
  assert.ok(candidate.errors.includes("missing direction"));
  assert.ok(candidate.errors.includes("invalid exit_time"));
});

test("normalizes supported futures roots and keeps the original broker symbol", () => {
  const symbols = [
    ["NQM6", "NQ"],
    ["MESM6", "MES"],
    ["ESM6", "ES"],
    ["MGCQ6", "GC"],
    ["GCM6", "GC"]
  ];

  for (const [symbol, expected] of symbols) {
    const csv = [
      header,
      `${symbol},0.25,1,100,101,$1.00,06/04/2026 10:00:00,06/04/2026 10:01:00,1min`
    ].join("\n");
    const candidate = parseBrokerCsv(csv, []).candidates[0];
    assert.equal(candidate.payload.instrument, expected);
    assert.equal(candidate.payload.broker_symbol, symbol);
  }
});

test("creates deterministic IDs and detects repeated Tradovate imports", () => {
  const first = parseBrokerCsv(sampleCsv, []);
  const existingTrades = first.candidates.map((candidate, index) => ({
    ...candidate.payload,
    id: `existing-${index}`,
    created_at: "2026-06-04T00:00:00.000Z",
    updated_at: "2026-06-04T00:00:00.000Z"
  }));
  const repeated = parseBrokerCsv(sampleCsv, existingTrades);

  assert.equal(repeated.summary.duplicateRows, 4);
  assert.equal(repeated.summary.importableRows, 0);
  assert.ok(repeated.candidates.every((candidate) => candidate.duplicateReason === "trade_id already imported"));
});
