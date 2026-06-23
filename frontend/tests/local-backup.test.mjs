import assert from "node:assert/strict";
import test from "node:test";

import {
  createLocalBackup,
  parseLocalBackupJson,
  restoreLocalBackup,
  summarizeLocalBackup
} from "../lib/local-backup.ts";

function mockStorage(initial = {}) {
  const rows = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return rows.has(key) ? rows.get(key) : null;
    },
    setItem(key, value) {
      rows.set(key, value);
    },
    dump() {
      return Object.fromEntries(rows.entries());
    }
  };
}

test("local backup exports known project keys and marks sensitive entries", () => {
  const storage = mockStorage({
    "fabio-local-trades-v1": "[{\"id\":\"trade-1\"}]",
    "fabio-investment-allocation-v1": "{\"fmp_api_key\":\"secret\"}",
    "unknown-app-key": "ignore-me"
  });

  const backup = createLocalBackup(storage, new Date("2026-06-19T12:00:00.000Z"));
  const summary = summarizeLocalBackup(backup);

  assert.equal(backup.exported_at, "2026-06-19T12:00:00.000Z");
  assert.equal(Object.hasOwn(backup.keys, "fabio-local-trades-v1"), true);
  assert.equal(Object.hasOwn(backup.keys, "fabio-investment-allocation-v1"), true);
  assert.equal(Object.hasOwn(backup.keys, "unknown-app-key"), false);
  assert.equal(backup.keys["fabio-investment-allocation-v1"].sensitive, true);
  assert.equal(summary.includedKeys, 2);
  assert.equal(summary.sensitiveKeys, 1);
});

test("local backup restore writes only known project keys", () => {
  const storage = mockStorage();
  const backup = parseLocalBackupJson(JSON.stringify({
    backup_type: "fabio-edge-local-backup",
    version: 1,
    exported_at: "2026-06-19T12:00:00.000Z",
    keys: {
      "fabio-language": {
        label: "Language preference",
        group: "Preferences",
        sensitive: false,
        value: "zh"
      },
      "unknown-app-key": {
        label: "Unknown",
        group: "Preferences",
        sensitive: false,
        value: "do-not-restore"
      }
    }
  }));

  const result = restoreLocalBackup(backup, storage);

  assert.equal(result.restoredCount, 1);
  assert.deepEqual(result.skippedUnknownKeys, ["unknown-app-key"]);
  assert.equal(storage.getItem("fabio-language"), "zh");
  assert.equal(storage.getItem("unknown-app-key"), null);
});
