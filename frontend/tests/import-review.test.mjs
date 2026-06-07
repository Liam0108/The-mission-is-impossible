import assert from "node:assert/strict";
import test from "node:test";

import { parseBrokerCsv } from "../lib/broker-import.ts";
import {
  calculateImportedResultR,
  edgeLabEligibility,
  importedTradeCompleteness,
  prioritizeImportedReviews,
  summarizeImportedTrades
} from "../lib/import-review.ts";

const header = "symbol,tickSize,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration";
const rows = [
  "MNQM6,0.25,2,30189,30228,$156.00,06/04/2026 20:08:41,06/04/2026 19:53:10,15min 30sec",
  "MNQM6,0.25,2,30149,30206.75,$231.00,06/04/2026 20:30:00,06/04/2026 20:10:00,20min",
  "MNQM6,0.25,2,30149,30181.75,$131.00,06/04/2026 21:00:00,06/04/2026 20:45:00,15min",
  "MNQM6,0.25,4,30138.25,30205.75,$540.00,06/04/2026 21:30:00,06/04/2026 21:10:00,20min"
];
const sampleCsv = [header, ...rows].join("\n");

function importedTrades() {
  return parseBrokerCsv(sampleCsv, [], "tradovate-closed-trades.csv").candidates.map((candidate, index) => ({
    ...candidate.payload,
    id: `trade-${index + 1}`,
    created_at: `2026-06-04T2${index}:40:00.000Z`,
    updated_at: `2026-06-04T2${index}:40:00.000Z`
  }));
}

test("summarizes imported completeness and keeps R blank before stop loss", () => {
  const trades = importedTrades();
  trades[3].review_status = "reviewed";
  const summary = summarizeImportedTrades(trades);

  assert.equal(summary.totalImported, 4);
  assert.equal(summary.unreviewed, 3);
  assert.equal(summary.reviewed, 1);
  assert.equal(summary.missingStopLoss, 4);
  assert.equal(summary.missingSetupType, 4);
  assert.equal(summary.missingSession, 0);
  assert.equal(summary.missingRegimeLabel, 4);
  assert.equal(summary.missingManualQuality, 4);
  assert.equal(summary.missingNotes, 4);
  assert.equal(summary.withResultR, 0);
  assert.equal(summary.withoutResultR, 4);
  assert.equal(summary.rCompletionRate, 0);
  assert.deepEqual(summary.missingRReasons, [{ reason: "Missing stop loss", count: 4 }]);
});

test("calculates R after stop loss and applies the Edge Lab eligibility rule", () => {
  for (const trade of importedTrades()) {
    const rewardDistance = trade.entry_price - trade.exit_price;
    const stopLoss = trade.entry_price + rewardDistance / 2;
    const resultR = calculateImportedResultR(trade, stopLoss);
    const reviewed = {
      ...trade,
      stop_loss: stopLoss,
      result_r: resultR,
      setup_type: "Fabio Short",
      manual_quality: "A"
    };

    assert.equal(trade.direction, "Short");
    assert.equal(trade.result, "TP1");
    assert.equal(trade.result_r, null);
    assert.equal(resultR, 2);
    assert.equal(edgeLabEligibility(reviewed).eligible, true);
    assert.equal(importedTradeCompleteness(reviewed).missing.includes("Regime Label"), true);
    assert.equal(importedTradeCompleteness(reviewed).missing.includes("Notes"), true);
  }
});

test("prioritizes missing review fields before absolute PnL and newest time", () => {
  const trades = importedTrades();
  const prepared = trades.map((trade) => ({
    ...trade,
    stop_loss: trade.entry_price + 10,
    result_r: 1,
    setup_type: "Fabio Short",
    manual_quality: "A"
  }));
  prepared[0].stop_loss = null;
  prepared[0].result_r = null;
  prepared[1].setup_type = null;
  prepared[2].manual_quality = null;
  prepared[3].net_pnl = 1000;

  assert.deepEqual(
    prioritizeImportedReviews(prepared).map((trade) => trade.id),
    ["trade-1", "trade-2", "trade-3", "trade-4"]
  );

  const complete = importedTrades().map((trade) => ({
    ...trade,
    stop_loss: trade.entry_price + 10,
    result_r: 1,
    setup_type: "Fabio Short",
    manual_quality: "A"
  }));
  assert.equal(prioritizeImportedReviews(complete)[0].id, "trade-4");
});
