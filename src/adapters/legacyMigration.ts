/**
 * Detect and package legacy v1.2 browser localStorage owner ledger for
 * explicit migration into the durable Forge API store.
 */

const KEYS = {
  fleet: 'forge.fleet.v1',
  treasury: 'forge.treasury.v1',
  transactions: 'forge.treasury.tx.v1',
  facilities: 'forge.facilities.v1',
  liabilities: 'forge.liabilities.v1',
  assumptions: 'forge.assumptions.v1',
  allocation: 'forge.allocation.targets.v1',
} as const;

function readKey(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export interface LegacyLedgerDetection {
  present: boolean;
  minerCount: number;
  facilityCount: number;
  transactionCount: number;
  liabilityCount: number;
  hasTreasury: boolean;
  payload: {
    miners: unknown;
    facilities: unknown;
    treasury: unknown;
    transactions: unknown;
    liabilities: unknown;
    assumptions: unknown;
    allocationTargets: unknown;
  };
}

export function detectLegacyLocalStorageLedger(): LegacyLedgerDetection {
  const miners = readKey(KEYS.fleet);
  const facilities = readKey(KEYS.facilities);
  const treasury = readKey(KEYS.treasury);
  const transactions = readKey(KEYS.transactions);
  const liabilities = readKey(KEYS.liabilities);
  const assumptions = readKey(KEYS.assumptions);
  const allocationTargets = readKey(KEYS.allocation);

  const minerCount = Array.isArray(miners) ? miners.length : 0;
  const facilityCount = Array.isArray(facilities) ? facilities.length : 0;
  const transactionCount = Array.isArray(transactions) ? transactions.length : 0;
  const liabilityCount = Array.isArray(liabilities) ? liabilities.length : 0;
  const hasTreasury = treasury != null && typeof treasury === 'object';

  return {
    present:
      minerCount > 0 ||
      facilityCount > 0 ||
      transactionCount > 0 ||
      liabilityCount > 0 ||
      hasTreasury,
    minerCount,
    facilityCount,
    transactionCount,
    liabilityCount,
    hasTreasury,
    payload: {
      miners: miners ?? [],
      facilities: facilities ?? [],
      treasury,
      transactions: transactions ?? [],
      liabilities: liabilities ?? [],
      assumptions,
      allocationTargets,
    },
  };
}

/** Download a JSON backup of the browser ledger before/after migration. */
export function downloadLegacyBackup(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function clearLegacyLedgerKeys(): void {
  for (const key of Object.values(KEYS)) {
    localStorage.removeItem(key);
  }
}
