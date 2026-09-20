import type { ForgeDb } from '../client.js';
import type {
  Facility,
  Liability,
  MinerAsset,
  ReconciliationIssue,
  TreasuryPosition,
  TreasuryTransaction,
} from '../../domain/owner.js';
import { reconstructBtcHoldingsFromLedger } from './treasuryRepo.js';

const EPS = 1e-8;

export function runReconciliation(input: {
  miners: MinerAsset[];
  facilities: Facility[];
  transactions: TreasuryTransaction[];
  treasury: TreasuryPosition;
  liabilities: Liability[];
  braiinsWorkers?: Array<{ name: string }>;
}): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = [];
  const facilityIds = new Set(input.facilities.map((f) => f.id));

  // Duplicate serials
  const serialCounts = new Map<string, string[]>();
  for (const m of input.miners) {
    if (!m.serialNumber) continue;
    if (m.status === 'sold' || m.status === 'decommissioned') continue;
    const list = serialCounts.get(m.serialNumber) ?? [];
    list.push(m.id);
    serialCounts.set(m.serialNumber, list);
  }
  for (const [serial, ids] of serialCounts) {
    if (ids.length > 1) {
      issues.push({
        id: `dup-serial-${serial}`,
        code: 'DUPLICATE_MINER_SERIAL',
        severity: 'CRITICAL',
        title: 'Duplicate miner serial number',
        detail: `Serial ${serial} is assigned to ${ids.length} active miners.`,
        recordType: 'miner',
        recordId: ids[0],
      });
    }
  }

  // Missing facility
  for (const m of input.miners) {
    if (m.facilityId && !facilityIds.has(m.facilityId)) {
      issues.push({
        id: `missing-fac-${m.id}`,
        code: 'MINER_MISSING_FACILITY',
        severity: 'WARNING',
        title: 'Miner assigned to missing facility',
        detail: `Miner ${m.model} (${m.serialNumber || m.id}) references facility ${m.facilityId} which does not exist.`,
        recordType: 'miner',
        recordId: m.id,
      });
    }
  }

  // Braiins worker mapping conflicts
  const workerToMiners = new Map<string, string[]>();
  for (const m of input.miners) {
    const w = m.braiinsWorkerName?.trim();
    if (!w) continue;
    const list = workerToMiners.get(w.toLowerCase()) ?? [];
    list.push(m.id);
    workerToMiners.set(w.toLowerCase(), list);
  }
  for (const [worker, ids] of workerToMiners) {
    if (ids.length > 1) {
      issues.push({
        id: `multi-worker-${worker}`,
        code: 'MINER_MULTI_WORKER',
        severity: 'CRITICAL',
        title: 'Braiins worker assigned to multiple miners',
        detail: `Worker "${worker}" is mapped to ${ids.length} miners.`,
        recordType: 'miner',
        recordId: ids[0],
      });
    }
  }

  if (input.braiinsWorkers) {
    const mapped = new Set(
      [...workerToMiners.keys()],
    );
    for (const w of input.braiinsWorkers) {
      const key = w.name.trim().toLowerCase();
      if (!mapped.has(key) && !mapped.has(w.name.split('.').pop()?.toLowerCase() ?? '')) {
        // Check suffix match
        const suffix = w.name.includes('.')
          ? w.name.slice(w.name.lastIndexOf('.') + 1).toLowerCase()
          : key;
        let found = mapped.has(key);
        if (!found) {
          for (const m of workerToMiners.keys()) {
            if (m === suffix || m.endsWith(`.${suffix}`) || suffix.endsWith(m)) {
              found = true;
              break;
            }
          }
        }
        if (!found) {
          issues.push({
            id: `unmatched-worker-${w.name}`,
            code: 'UNMATCHED_BRAIINS_WORKER',
            severity: 'WARNING',
            title: 'Braiins worker with no known miner',
            detail: `Pool worker "${w.name}" is not mapped to a Forge miner asset.`,
            recordType: 'braiins_worker',
            recordId: w.name,
          });
        }
      }
    }
  }

  // Treasury balance vs ledger
  if (input.transactions.length > 0) {
    const reconstructed = reconstructBtcHoldingsFromLedger(input.transactions);
    const delta = Math.abs(reconstructed.btcHoldings - input.treasury.btcHoldings);
    if (delta > EPS) {
      issues.push({
        id: 'treasury-btc-mismatch',
        code: 'TREASURY_BTC_MISMATCH',
        severity: 'CRITICAL',
        title: 'Treasury BTC balance does not reconcile to transaction history',
        detail: `Position overlay holds ${input.treasury.btcHoldings} BTC; ledger reconstructs ${reconstructed.btcHoldings} BTC (Δ ${delta}).`,
        recordType: 'treasury',
        recordId: 'default',
      });
    }
  }

  // Impossible / missing quantity
  for (const tx of input.transactions) {
    if (!Number.isFinite(tx.quantity) || tx.quantity === 0) {
      issues.push({
        id: `tx-qty-${tx.id}`,
        code: 'TX_INVALID_QUANTITY',
        severity: 'WARNING',
        title: 'Transaction with impossible or missing quantity',
        detail: `Transaction ${tx.id} (${tx.transactionType}) has quantity ${tx.quantity}.`,
        recordType: 'treasury_transaction',
        recordId: tx.id,
      });
    }
    if (
      tx.transactionType === 'BTC_MINED' &&
      !tx.productionRef &&
      tx.source === 'live'
    ) {
      issues.push({
        id: `tx-mined-ref-${tx.id}`,
        code: 'MINED_BTC_MISSING_PRODUCTION_REF',
        severity: 'INFO',
        title: 'Mined BTC without production reference',
        detail: `LIVE mined BTC transaction ${tx.id} has no production/source reference.`,
        recordType: 'treasury_transaction',
        recordId: tx.id,
      });
    }
  }

  // Negative liability principal
  for (const l of input.liabilities) {
    const outstanding = l.outstandingPrincipalUsd ?? l.amountUsd;
    if (outstanding < 0 || l.amountUsd < 0) {
      issues.push({
        id: `liab-neg-${l.id}`,
        code: 'LIABILITY_NEGATIVE_PRINCIPAL',
        severity: 'CRITICAL',
        title: 'Liability with negative principal',
        detail: `Liability "${l.label}" has negative principal.`,
        recordType: 'liability',
        recordId: l.id,
      });
    }
  }

  // Facility overcommit
  for (const f of input.facilities) {
    if (f.contractedMW > 0 && f.deployedMW > f.contractedMW + 1e-9) {
      issues.push({
        id: `fac-over-${f.id}`,
        code: 'FACILITY_OVERCOMMITTED',
        severity: 'WARNING',
        title: 'Facility deployed MW greater than contracted MW',
        detail: `${f.facilityName}: deployed ${f.deployedMW} MW > contracted ${f.contractedMW} MW.`,
        recordType: 'facility',
        recordId: f.id,
      });
    }
  }

  return issues;
}

export function reconcileFromDb(
  db: ForgeDb,
  deps: {
    listMiners: (db: ForgeDb) => MinerAsset[];
    listFacilities: (db: ForgeDb) => Facility[];
    listTreasuryTransactions: (db: ForgeDb) => TreasuryTransaction[];
    getTreasuryPosition: (db: ForgeDb) => TreasuryPosition;
    listLiabilities: (db: ForgeDb) => Liability[];
    braiinsWorkers?: Array<{ name: string }>;
  },
): ReconciliationIssue[] {
  return runReconciliation({
    miners: deps.listMiners(db),
    facilities: deps.listFacilities(db),
    transactions: deps.listTreasuryTransactions(db),
    treasury: deps.getTreasuryPosition(db),
    liabilities: deps.listLiabilities(db),
    braiinsWorkers: deps.braiinsWorkers,
  });
}
