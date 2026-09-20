import { describe, expect, it, afterEach } from 'vitest';
import { openTestDatabase, resetDbSingleton } from '../src/db/client.js';
import {
  createMiner,
  listMiners,
  updateMiner,
  createFacility,
  listFacilities,
} from '../src/db/repositories/assetRepo.js';
import {
  appendTreasuryTransaction,
  getTreasuryPosition,
  listTreasuryTransactions,
  reconstructBtcHoldingsFromLedger,
  refuseTreasuryDelete,
  saveTreasuryPosition,
} from '../src/db/repositories/treasuryRepo.js';
import {
  listLiabilities,
} from '../src/db/repositories/settingsRepo.js';
import { runReconciliation } from '../src/db/repositories/reconciliation.js';
import {
  insertMarketSnapshot,
  insertNetworkSnapshot,
  nearestMarketPrice,
  listMarketSnapshots,
} from '../src/db/repositories/snapshotRepo.js';
import { previewMinerCsv, parseCsv, sanitizeCsvCell } from '../src/domain/csvImport.js';
import { computeHistoricalNav } from '../src/domain/historicalNav.js';
import { evaluateFreshness } from '../src/domain/freshness.js';
import {
  exportOwnerBackup,
  importLegacyBrowserLedger,
  getMigrationStatus,
} from '../src/services/owner/backup.js';
import { listAuditEvents } from '../src/db/repositories/auditRepo.js';

describe('durable persistence', () => {
  afterEach(() => {
    resetDbSingleton();
  });

  it('migrates and supports miner CRUD with serial uniqueness', () => {
    const db = openTestDatabase();
    const applied = db.prepare('SELECT id FROM schema_migrations').all();
    expect(applied.length).toBeGreaterThan(0);

    const miner = createMiner(db, {
      manufacturer: 'Bitmain',
      model: 'S21',
      serialNumber: 'SN-001',
      quantity: 1,
      nominalHashrateTh: 200,
      wattage: 3500,
      efficiencyJTh: 17.5,
      acquisitionDate: '2025-01-01',
      acquisitionCostUsd: 5000,
      shippingCostUsd: 200,
      deploymentCostUsd: 100,
      deploymentDate: '2025-02-01',
      hostingProvider: 'HostCo',
      facility: 'Site A',
      facilityId: null,
      electricityRatePerKwh: 0.05,
      monthlyHostingFeeUsd: 100,
      pool: 'Braiins Pool',
      braiinsWorkerName: 'worker1',
      status: 'online',
      enabled: true,
      warrantyExpiration: null,
      notes: '',
    });
    expect(miner.id).toBeTruthy();
    expect(listMiners(db)).toHaveLength(1);

    expect(() =>
      createMiner(db, {
        ...miner,
        id: undefined,
        serialNumber: 'SN-001',
      }),
    ).toThrow(/Duplicate miner serial/);

    const updated = updateMiner(db, miner.id, { notes: 'rack 3' });
    expect(updated.notes).toBe('rack 3');
    expect(listAuditEvents(db).length).toBeGreaterThan(0);
  });

  it('keeps treasury append-only and reconstructs BTC balance', () => {
    const db = openTestDatabase();
    appendTreasuryTransaction(db, {
      id: 'tx-1',
      date: '2025-01-01',
      transactionType: 'BTC_MINED',
      asset: 'BTC',
      quantity: 0.1,
      unitPrice: 90000,
      grossAmount: 9000,
      fee: 0,
      counterparty: 'Braiins',
      account: 'pool',
      minerId: null,
      facilityId: null,
      memo: 'mined',
      source: 'manual',
      externalReference: null,
    });
    appendTreasuryTransaction(db, {
      id: 'tx-2',
      date: '2025-01-02',
      transactionType: 'BTC_PURCHASE',
      asset: 'BTC',
      quantity: 0.2,
      unitPrice: 85000,
      grossAmount: 17000,
      fee: 10,
      counterparty: 'Exchange',
      account: 'trading',
      minerId: null,
      facilityId: null,
      memo: 'bought',
      source: 'manual',
      externalReference: null,
    });
    appendTreasuryTransaction(db, {
      id: 'tx-3',
      date: '2025-01-03',
      transactionType: 'BTC_SALE',
      asset: 'BTC',
      quantity: 0.05,
      unitPrice: 95000,
      grossAmount: 4750,
      fee: 5,
      counterparty: 'Exchange',
      account: 'trading',
      minerId: null,
      facilityId: null,
      memo: 'sold',
      source: 'manual',
      externalReference: null,
    });

    expect(() => refuseTreasuryDelete()).toThrow(/append-only/);
    const reconstructed = reconstructBtcHoldingsFromLedger(
      listTreasuryTransactions(db),
    );
    expect(reconstructed.btcMined).toBeCloseTo(0.1);
    expect(reconstructed.btcPurchased).toBeCloseTo(0.2);
    expect(reconstructed.btcSold).toBeCloseTo(0.05);
    expect(reconstructed.btcHoldings).toBeCloseTo(0.25);
  });

  it('imports legacy localStorage payload once and blocks duplicates', () => {
    const db = openTestDatabase();
    const payload = {
      miners: [
        {
          manufacturer: 'MicroBT',
          model: 'M60',
          serialNumber: 'LEGACY-1',
          quantity: 1,
          nominalHashrateTh: 170,
          wattage: 3200,
          efficiencyJTh: null,
          acquisitionDate: null,
          acquisitionCostUsd: 4000,
          hostingProvider: '',
          facility: '',
          electricityRatePerKwh: null,
          monthlyHostingFeeUsd: null,
          pool: 'Braiins Pool',
          braiinsWorkerName: null,
          status: 'online' as const,
          enabled: true,
          warrantyExpiration: null,
          notes: '',
        },
      ],
      facilities: [],
      transactions: [],
      liabilities: [],
    };
    const first = importLegacyBrowserLedger(db, payload);
    expect(first.status.status).toBe('imported');
    expect(first.imported.miners).toBe(1);
    expect(getMigrationStatus(db).fingerprint).toBeTruthy();

    expect(() => importLegacyBrowserLedger(db, payload)).toThrow(/already imported/);
  });
});

describe('CSV miner import', () => {
  it('previews valid, malformed, and duplicate serials', () => {
    const csv = [
      'manufacturer,model,serial_number,hashrate_th,watts,purchase_cost,shipping_cost,deployment_cost,acquisition_date,deployment_date,host,facility,electricity_rate,hosting_fee,braiins_worker,status,notes',
      'Bitmain,S21,SN-A,200,3500,5000,100,50,2025-01-01,2025-02-01,Host,Site,0.05,100,w1,online,ok',
      'Bitmain,,SN-B,200,3500,,,,,,,,,',
      'Bitmain,S21,SN-A,200,3500,,,,,,,,,,,,',
      '=CMD,S21,SN-C,100,2000,,,,,,,,,,,,',
    ].join('\n');

    const preview = previewMinerCsv(csv, []);
    expect(preview.inserts).toBe(2);
    expect(preview.rejected).toBe(2);
    expect(preview.rows.some((r) => r.errors.includes('model is required'))).toBe(
      true,
    );
    expect(
      preview.rows.some((r) =>
        r.errors.includes('duplicate serial_number within import file'),
      ),
    ).toBe(true);
  });

  it('neutralizes CSV injection on export cells', () => {
    expect(sanitizeCsvCell('=1+1')).toMatch(/^"/);
    expect(parseCsv('a,b\n1,2\n').rows[0]).toEqual({ a: '1', b: '2' });
  });
});

describe('snapshots and historical NAV', () => {
  afterEach(() => resetDbSingleton());

  it('persists market/network snapshots and looks up nearest price', () => {
    const db = openTestDatabase();
    insertMarketSnapshot(db, {
      btcUsd: 100_000,
      change24hPct: 1.2,
      provider: 'coingecko',
      sourceTimestamp: '2025-06-01T12:00:00.000Z',
      success: true,
      error: null,
    });
    insertNetworkSnapshot(db, {
      networkHashrateEhs: 600,
      difficulty: 1e14,
      blockHeight: 900_000,
      blockSubsidyBtc: 3.125,
      estimatedNextAdjustment: null,
      daysUntilAdjustment: 5,
      provider: 'mempool.space',
      sourceTimestamp: '2025-06-01T12:00:00.000Z',
      success: true,
      error: null,
    });
    expect(listMarketSnapshots(db)).toHaveLength(1);
    const price = nearestMarketPrice(db, '2025-06-01T12:30:00.000Z');
    expect(price.source).toBe('LIVE');
    expect(price.btcUsd).toBe(100_000);
  });

  it('reports insufficient data for historical NAV without prices', () => {
    const db = openTestDatabase();
    saveTreasuryPosition(db, {
      ...getTreasuryPosition(db),
      btcHoldings: 1,
      cashReserveUsd: 10_000,
    });
    const nav = computeHistoricalNav(db, '2025-01-01T00:00:00.000Z');
    expect(nav.insufficientData).toBe(true);
    expect(nav.netAssetValueUsd).toBeNull();
    expect(nav.btcPriceSource).toBe('UNAVAILABLE');
  });

  it('marks stale provider data via freshness model', () => {
    const old = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const fresh = evaluateFreshness(old, 20 * 60);
    expect(fresh.state).toBe('STALE');
    const live = evaluateFreshness(new Date().toISOString(), 20 * 60);
    expect(live.state).toBe('LIVE');
  });
});

describe('reconciliation', () => {
  it('flags duplicate serial, missing facility, unmatched worker, balance mismatch, invalid liability, overcommit', () => {
    const issues = runReconciliation({
      miners: [
        {
          id: 'm1',
          manufacturer: 'A',
          model: 'S21',
          serialNumber: 'DUP',
          quantity: 1,
          nominalHashrateTh: 1,
          wattage: 1,
          efficiencyJTh: null,
          acquisitionDate: null,
          acquisitionCostUsd: null,
          hostingProvider: '',
          facility: '',
          facilityId: 'missing-fac',
          electricityRatePerKwh: null,
          monthlyHostingFeeUsd: null,
          pool: '',
          braiinsWorkerName: 'w1',
          status: 'online',
          enabled: true,
          warrantyExpiration: null,
          notes: '',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'm2',
          manufacturer: 'A',
          model: 'S21',
          serialNumber: 'DUP',
          quantity: 1,
          nominalHashrateTh: 1,
          wattage: 1,
          efficiencyJTh: null,
          acquisitionDate: null,
          acquisitionCostUsd: null,
          hostingProvider: '',
          facility: '',
          facilityId: null,
          electricityRatePerKwh: null,
          monthlyHostingFeeUsd: null,
          pool: '',
          braiinsWorkerName: 'w1',
          status: 'online',
          enabled: true,
          warrantyExpiration: null,
          notes: '',
          createdAt: '',
          updatedAt: '',
        },
      ],
      facilities: [
        {
          id: 'f1',
          provider: 'P',
          facilityName: 'Site',
          location: '',
          contractedMW: 1,
          deployedMW: 2,
          electricityRate: null,
          hostingFee: null,
          agreementStart: null,
          agreementEnd: null,
          status: 'active',
          notes: '',
          createdAt: '',
          updatedAt: '',
        },
      ],
      transactions: [
        {
          id: 't1',
          date: '2025-01-01',
          transactionType: 'BTC_MINED',
          asset: 'BTC',
          quantity: 1,
          unitPrice: null,
          grossAmount: 0,
          fee: 0,
          counterparty: '',
          account: '',
          minerId: null,
          facilityId: null,
          memo: '',
          source: 'manual',
          externalReference: null,
          createdAt: '',
        },
      ],
      treasury: {
        btcHoldings: 0,
        avgAcquisitionPriceUsd: 0,
        btcMined: 0,
        btcPurchased: 0,
        btcSold: 0,
        btcTransferred: 0,
        btcCostBasisUsd: null,
        cashReserveUsd: 0,
        minerHardwareBookValueUsd: 0,
        otherAssetsUsd: 0,
        liabilitiesUsd: 0,
        monthlyAccumulationBtc: 0,
        targetBtc: 0,
        source: 'manual',
        updatedAt: '',
      },
      liabilities: [
        {
          id: 'l1',
          kind: 'other',
          label: 'bad',
          amountUsd: -5,
          counterparty: '',
          notes: '',
          asOf: '2025-01-01',
          createdAt: '',
          updatedAt: '',
        },
      ],
      braiinsWorkers: [{ name: 'orphan.worker' }],
    });

    const codes = new Set(issues.map((i) => i.code));
    expect(codes.has('DUPLICATE_MINER_SERIAL')).toBe(true);
    expect(codes.has('MINER_MISSING_FACILITY')).toBe(true);
    expect(codes.has('MINER_MULTI_WORKER')).toBe(true);
    expect(codes.has('UNMATCHED_BRAIINS_WORKER')).toBe(true);
    expect(codes.has('TREASURY_BTC_MISMATCH')).toBe(true);
    expect(codes.has('LIABILITY_NEGATIVE_PRINCIPAL')).toBe(true);
    expect(codes.has('FACILITY_OVERCOMMITTED')).toBe(true);
  });
});

describe('backup export', () => {
  it('exports a portable owner ledger JSON', () => {
    const db = openTestDatabase();
    createFacility(db, {
      provider: 'P',
      facilityName: 'Alpha',
      location: 'TX',
      contractedMW: 5,
      deployedMW: 2,
      electricityRate: 0.04,
      hostingFee: null,
      agreementStart: null,
      agreementEnd: null,
      status: 'active',
      notes: '',
    });
    const backup = exportOwnerBackup(db);
    expect(backup.version).toBe(1);
    expect(backup.facilities).toHaveLength(1);
    expect(listFacilities(db)).toHaveLength(1);
    expect(listLiabilities(db)).toHaveLength(0);
  });
});
