export type LocalBackupGroup =
  | "Trading"
  | "Investment"
  | "Market Lab"
  | "Freedom"
  | "Checklist"
  | "Preferences";

export type LocalBackupKey = {
  key: string;
  label: string;
  group: LocalBackupGroup;
  sensitive?: boolean;
};

export type LocalDataBackup = {
  backup_type: "fabio-edge-local-backup";
  version: 1;
  exported_at: string;
  keys: Record<string, {
    label: string;
    group: LocalBackupGroup;
    sensitive: boolean;
    value: string;
  }>;
};

export type LocalBackupSummary = {
  totalKnownKeys: number;
  includedKeys: number;
  sensitiveKeys: number;
  groups: Record<string, number>;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const LOCAL_BACKUP_KEYS: LocalBackupKey[] = [
  { key: "fabio-local-trades-v1", label: "Trade records", group: "Trading" },
  { key: "fabio-trade-draft", label: "Trade draft", group: "Trading" },
  { key: "fabio-last-fast-fields", label: "Trade logger remembered fields", group: "Trading" },
  { key: "fabio-investment-stocks-v1", label: "Investment stocks", group: "Investment" },
  { key: "fabio-investment-holdings-v1", label: "Portfolio holdings", group: "Investment" },
  { key: "fabio-investment-watchlist-v1", label: "Watchlist", group: "Investment" },
  { key: "fabio-investment-allocation-v1", label: "Allocation settings and FMP key", group: "Investment", sensitive: true },
  { key: "fabio-investment-data-cache-v1", label: "Investment data cache", group: "Investment" },
  { key: "fabio-investment-dcf-assumptions-v1", label: "DCF assumptions", group: "Investment" },
  { key: "fabio-investment-scenario-probabilities-v1", label: "Scenario probabilities", group: "Investment" },
  { key: "fabio-investment-fmp-mapping-comparison-v1", label: "FMP mapping comparison", group: "Investment" },
  { key: "fabio-investment-scan-priority-v1", label: "Scan priority settings", group: "Investment" },
  { key: "fabio-investment-scan-roi-v1", label: "Scan ROI history", group: "Investment" },
  { key: "fabio-investment-active-tab-v1", label: "Investment active tab", group: "Investment" },
  { key: "fabio-market-candles-v1", label: "Market Lab candles", group: "Market Lab" },
  { key: "fabio-market-validation-feedback-v1", label: "Market Lab validation feedback", group: "Market Lab" },
  { key: "fabio-freedom-goals-v1", label: "Freedom goals", group: "Freedom" },
  { key: "fabio-tomorrow-checklist-v1", label: "Tomorrow checklist", group: "Checklist" },
  { key: "fabio-theme", label: "Theme preference", group: "Preferences" },
  { key: "fabio-language", label: "Language preference", group: "Preferences" }
];

export function createLocalBackup(storage: StorageLike, now = new Date()): LocalDataBackup {
  const keys: LocalDataBackup["keys"] = {};
  for (const definition of LOCAL_BACKUP_KEYS) {
    const value = storage.getItem(definition.key);
    if (value === null) continue;
    keys[definition.key] = {
      label: definition.label,
      group: definition.group,
      sensitive: Boolean(definition.sensitive),
      value
    };
  }

  return {
    backup_type: "fabio-edge-local-backup",
    version: 1,
    exported_at: now.toISOString(),
    keys
  };
}

export function summarizeLocalBackup(backup: LocalDataBackup): LocalBackupSummary {
  const entries = Object.values(backup.keys);
  return {
    totalKnownKeys: LOCAL_BACKUP_KEYS.length,
    includedKeys: entries.length,
    sensitiveKeys: entries.filter((entry) => entry.sensitive).length,
    groups: entries.reduce<Record<string, number>>((summary, entry) => {
      summary[entry.group] = (summary[entry.group] ?? 0) + 1;
      return summary;
    }, {})
  };
}

export function parseLocalBackupJson(text: string): LocalDataBackup {
  const parsed = JSON.parse(text) as Partial<LocalDataBackup>;
  if (parsed.backup_type !== "fabio-edge-local-backup" || parsed.version !== 1 || !parsed.keys || typeof parsed.keys !== "object") {
    throw new Error("This file is not a Fabio Edge local backup.");
  }
  return parsed as LocalDataBackup;
}

export function restoreLocalBackup(backup: LocalDataBackup, storage: StorageLike) {
  const allowedKeys = new Set(LOCAL_BACKUP_KEYS.map((definition) => definition.key));
  const restoredKeys: string[] = [];
  const skippedUnknownKeys: string[] = [];

  for (const [key, entry] of Object.entries(backup.keys)) {
    if (!allowedKeys.has(key)) {
      skippedUnknownKeys.push(key);
      continue;
    }
    storage.setItem(key, entry.value);
    restoredKeys.push(key);
  }

  return {
    restoredKeys,
    skippedUnknownKeys,
    restoredCount: restoredKeys.length
  };
}

export function backupToJson(backup: LocalDataBackup) {
  return JSON.stringify(backup, null, 2);
}

export function downloadLocalBackup(backup: LocalDataBackup) {
  if (typeof document === "undefined") return;
  const blob = new Blob([backupToJson(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `fabio-edge-local-backup-${backup.exported_at.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
