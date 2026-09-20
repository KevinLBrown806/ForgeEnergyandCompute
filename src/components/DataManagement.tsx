import { useState, type FormEvent } from 'react';
import type {
  CapitalAllocationTarget,
  Facility,
  FacilityInput,
  Liability,
  LiabilityInput,
  MinerAsset,
  MinerAssetInput,
  OwnerAssumptions,
  PoolWorker,
  TreasuryPosition,
  TreasuryTransaction,
  TreasuryTransactionInput,
  TreasuryTransactionType,
} from '../domain/types';
import { MinerForm } from './MinerForm';
import { TreasuryEditor } from './TreasuryEditor';
import { formatUsdCompact } from '../lib/format';

type Tab =
  | 'fleet'
  | 'facilities'
  | 'treasury'
  | 'liabilities'
  | 'assumptions'
  | 'allocation'
  | 'imports'
  | 'reconciliation'
  | 'connections'
  | 'backup';

const TABS: { id: Tab; label: string }[] = [
  { id: 'fleet', label: 'Fleet' },
  { id: 'facilities', label: 'Facilities' },
  { id: 'treasury', label: 'Treasury entries' },
  { id: 'liabilities', label: 'Liabilities' },
  { id: 'assumptions', label: 'Assumptions' },
  { id: 'allocation', label: 'Allocation targets' },
  { id: 'imports', label: 'Imports' },
  { id: 'reconciliation', label: 'Reconciliation' },
  { id: 'connections', label: 'Connections' },
  { id: 'backup', label: 'Backup / Export' },
];

const TX_TYPES: TreasuryTransactionType[] = [
  'BTC_MINED',
  'BTC_PURCHASE',
  'BTC_SALE',
  'BTC_TRANSFER_IN',
  'BTC_TRANSFER_OUT',
  'CASH_CONTRIBUTION',
  'CASH_WITHDRAWAL',
  'HARDWARE_PURCHASE',
  'HOSTING_PAYMENT',
  'ELECTRICITY_PAYMENT',
  'OTHER_EXPENSE',
  'OTHER_INCOME',
  'REVERSAL',
  'ADJUSTMENT',
];

function emptyTx(): TreasuryTransactionInput {
  return {
    id: `tx-${Date.now().toString(36)}`,
    date: new Date().toISOString().slice(0, 10),
    transactionType: 'BTC_MINED',
    asset: 'BTC',
    quantity: 0,
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
  };
}

function emptyFacility(): FacilityInput {
  return {
    provider: '',
    facilityName: '',
    location: '',
    contractedMW: 0,
    deployedMW: 0,
    electricityRate: null,
    hostingFee: null,
    agreementStart: null,
    agreementEnd: null,
    status: 'planned',
    notes: '',
  };
}

function emptyLiability(): LiabilityInput {
  return {
    kind: 'other',
    label: '',
    amountUsd: 0,
    counterparty: '',
    notes: '',
    asOf: new Date().toISOString().slice(0, 10),
  };
}

export function DataManagement(props: {
  demoMode: boolean;
  assets: MinerAsset[];
  workers: PoolWorker[];
  transactions: TreasuryTransaction[];
  facilities: Facility[];
  liabilities: Liability[];
  assumptions: OwnerAssumptions;
  allocationTargets: CapitalAllocationTarget[];
  treasury: TreasuryPosition;
  reconciliationIssues?: Array<{
    id: string;
    severity: string;
    title: string;
    detail: string;
    code: string;
  }>;
  braiinsConnection?: {
    configured: boolean;
    authenticated: boolean | null;
    lastSuccessfulSync: string | null;
    workerCount: number | null;
    matchedWorkers: number | null;
    unmatchedWorkers: number | null;
    staleWorkers: number | null;
    lastError: string | null;
  } | null;
  legacyMigration?: {
    present: boolean;
    minerCount: number;
    facilityCount: number;
    transactionCount: number;
    status: string | null;
  } | null;
  onCreateAsset: (input: MinerAssetInput) => Promise<void>;
  onUpdateAsset: (id: string, input: MinerAssetInput) => Promise<void>;
  onRemoveAsset: (id: string) => Promise<void>;
  onAppendTx: (input: TreasuryTransactionInput) => Promise<void>;
  onRemoveTx: (id: string) => Promise<void>;
  onCreateFacility: (input: FacilityInput) => Promise<void>;
  onUpdateFacility: (id: string, input: FacilityInput) => Promise<void>;
  onRemoveFacility: (id: string) => Promise<void>;
  onCreateLiability: (input: LiabilityInput) => Promise<void>;
  onRemoveLiability: (id: string) => Promise<void>;
  onSaveAssumptions: (next: OwnerAssumptions) => Promise<void>;
  onSaveAllocation: (targets: CapitalAllocationTarget[]) => Promise<void>;
  onSaveTreasury: (position: TreasuryPosition) => Promise<void>;
  onRefreshReconciliation?: () => Promise<void>;
  onExportBackup?: () => Promise<void>;
  onMigrateLegacy?: () => Promise<void>;
  onDownloadLegacyBackup?: () => void;
  onPreviewMinerCsv?: (csv: string) => Promise<{
    inserts: number;
    updates: number;
    rejected: number;
    summary: string;
  }>;
  onCommitMinerCsv?: (csv: string) => Promise<string>;
  onImportAccountingCsv?: (csv: string) => Promise<string>;
}) {
  const [tab, setTab] = useState<Tab>('fleet');
  const [editing, setEditing] = useState<MinerAsset | 'new' | null>(null);
  const [txDraft, setTxDraft] = useState<TreasuryTransactionInput>(emptyTx);
  const [facDraft, setFacDraft] = useState<FacilityInput>(emptyFacility);
  const [liabDraft, setLiabDraft] = useState<LiabilityInput>(emptyLiability);
  const [assumptions, setAssumptions] = useState(props.assumptions);
  const [targets, setTargets] = useState(props.allocationTargets);
  const [error, setError] = useState<string | null>(null);
  const [importCsv, setImportCsv] = useState('');
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const saveAsset = async (input: MinerAssetInput) => {
    if (editing === 'new') await props.onCreateAsset(input);
    else if (editing) await props.onUpdateAsset(editing.id, input);
    setEditing(null);
  };

  const submitTx = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await props.onAppendTx(txDraft);
      setTxDraft(emptyTx());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save transaction');
    }
  };

  const submitFacility = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await props.onCreateFacility(facDraft);
      setFacDraft(emptyFacility());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save facility');
    }
  };

  const submitLiability = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await props.onCreateLiability(liabDraft);
      setLiabDraft(emptyLiability());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save liability');
    }
  };

  return (
    <div className="data-admin">
      <div className="panel registry-toolbar">
        <div>
          <h3>Data management</h3>
          <p className="panel__meta">
            Owner records · MANUAL · durable Forge ledger · not the executive view
          </p>
        </div>
      </div>
      <div className="data-tabs">
        {TABS.map((item) => (
          <button
            key={item.id}
            className={`data-tab${tab === item.id ? ' data-tab--active' : ''}`}
            type="button"
            onClick={() => {
              setTab(item.id);
              setError(null);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}

      {tab === 'fleet' && (
        <div className="panel">
          {props.demoMode && (
            <p className="notice">
              Demo mode is on. Operating fleet edits are disabled so demo
              machines cannot be written as Forge-owned assets.
            </p>
          )}
          <div className="form-actions">
            <button
              className="button button--primary"
              type="button"
              disabled={props.demoMode}
              onClick={() => setEditing('new')}
            >
              + Add miner
            </button>
          </div>
          {editing && !props.demoMode && (
            <MinerForm
              key={editing === 'new' ? 'new' : editing.id}
              asset={editing === 'new' ? undefined : editing}
              workers={props.workers}
              onSave={saveAsset}
              onCancel={() => setEditing(null)}
            />
          )}
          <ul className="admin-list">
            {props.assets.map((asset) => (
              <li key={asset.id}>
                <span>
                  {asset.model} · {asset.serialNumber}
                </span>
                <span className="row-actions">
                  <button
                    type="button"
                    disabled={props.demoMode}
                    onClick={() => setEditing(asset)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={props.demoMode}
                    onClick={() => void props.onRemoveAsset(asset.id)}
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
            {props.assets.length === 0 && (
              <li className="empty-state">No operating miners registered.</li>
            )}
          </ul>
        </div>
      )}

      {tab === 'facilities' && (
        <div className="panel">
          <form className="miner-form" onSubmit={submitFacility}>
            <label>
              Provider
              <input
                value={facDraft.provider}
                onChange={(e) =>
                  setFacDraft((c) => ({ ...c, provider: e.target.value }))
                }
              />
            </label>
            <label>
              Facility name
              <input
                required
                value={facDraft.facilityName}
                onChange={(e) =>
                  setFacDraft((c) => ({ ...c, facilityName: e.target.value }))
                }
              />
            </label>
            <label>
              Location
              <input
                value={facDraft.location}
                onChange={(e) =>
                  setFacDraft((c) => ({ ...c, location: e.target.value }))
                }
              />
            </label>
            <label>
              Contracted MW
              <input
                min={0}
                step={0.01}
                type="number"
                value={facDraft.contractedMW}
                onChange={(e) =>
                  setFacDraft((c) => ({
                    ...c,
                    contractedMW: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label>
              Deployed MW
              <input
                min={0}
                step={0.01}
                type="number"
                value={facDraft.deployedMW}
                onChange={(e) =>
                  setFacDraft((c) => ({
                    ...c,
                    deployedMW: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label>
              Electricity ($/kWh)
              <input
                min={0}
                step={0.001}
                type="number"
                value={facDraft.electricityRate ?? ''}
                onChange={(e) =>
                  setFacDraft((c) => ({
                    ...c,
                    electricityRate:
                      e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
              />
            </label>
            <label>
              Hosting fee
              <input
                min={0}
                step={0.01}
                type="number"
                value={facDraft.hostingFee ?? ''}
                onChange={(e) =>
                  setFacDraft((c) => ({
                    ...c,
                    hostingFee:
                      e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
              />
            </label>
            <label>
              Agreement start
              <input
                type="date"
                value={facDraft.agreementStart ?? ''}
                onChange={(e) =>
                  setFacDraft((c) => ({
                    ...c,
                    agreementStart: e.target.value || null,
                  }))
                }
              />
            </label>
            <label>
              Agreement end
              <input
                type="date"
                value={facDraft.agreementEnd ?? ''}
                onChange={(e) =>
                  setFacDraft((c) => ({
                    ...c,
                    agreementEnd: e.target.value || null,
                  }))
                }
              />
            </label>
            <label>
              Status
              <select
                value={facDraft.status}
                onChange={(e) =>
                  setFacDraft((c) => ({
                    ...c,
                    status: e.target.value as Facility['status'],
                  }))
                }
              >
                <option value="planned">Planned</option>
                <option value="contracted">Contracted</option>
                <option value="active">Active</option>
                <option value="ended">Ended</option>
              </select>
            </label>
            <div className="form-actions">
              <button className="button button--primary" type="submit">
                Add facility
              </button>
            </div>
          </form>
          <ul className="admin-list">
            {props.facilities.map((facility) => (
              <li key={facility.id}>
                <span>
                  {facility.facilityName} · {facility.location || '—'} ·{' '}
                  {facility.contractedMW} MW
                </span>
                <button
                  type="button"
                  onClick={() => void props.onRemoveFacility(facility.id)}
                >
                  Remove
                </button>
              </li>
            ))}
            {props.facilities.length === 0 && (
              <li className="empty-state">No facilities recorded.</li>
            )}
          </ul>
        </div>
      )}

      {tab === 'treasury' && (
        <div className="split">
          <div className="panel">
            <form className="miner-form" onSubmit={submitTx}>
              <label>
                Id
                <input
                  required
                  value={txDraft.id}
                  onChange={(e) =>
                    setTxDraft((c) => ({ ...c, id: e.target.value }))
                  }
                />
              </label>
              <label>
                Date
                <input
                  required
                  type="date"
                  value={txDraft.date}
                  onChange={(e) =>
                    setTxDraft((c) => ({ ...c, date: e.target.value }))
                  }
                />
              </label>
              <label>
                Type
                <select
                  value={txDraft.transactionType}
                  onChange={(e) => {
                    const transactionType = e.target
                      .value as TreasuryTransactionType;
                    const asset = transactionType.startsWith('BTC')
                      ? 'BTC'
                      : 'USD';
                    setTxDraft((c) => ({ ...c, transactionType, asset }));
                  }}
                >
                  {TX_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Quantity
                <input
                  min={0}
                  step="any"
                  type="number"
                  value={txDraft.quantity}
                  onChange={(e) =>
                    setTxDraft((c) => ({
                      ...c,
                      quantity: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label>
                Unit price
                <input
                  min={0}
                  step="any"
                  type="number"
                  value={txDraft.unitPrice ?? ''}
                  onChange={(e) =>
                    setTxDraft((c) => ({
                      ...c,
                      unitPrice:
                        e.target.value === '' ? null : Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label>
                Gross amount
                <input
                  step="any"
                  type="number"
                  value={txDraft.grossAmount}
                  onChange={(e) =>
                    setTxDraft((c) => ({
                      ...c,
                      grossAmount: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label>
                Fee
                <input
                  min={0}
                  step="any"
                  type="number"
                  value={txDraft.fee}
                  onChange={(e) =>
                    setTxDraft((c) => ({ ...c, fee: Number(e.target.value) }))
                  }
                />
              </label>
              <label>
                Counterparty
                <input
                  value={txDraft.counterparty}
                  onChange={(e) =>
                    setTxDraft((c) => ({ ...c, counterparty: e.target.value }))
                  }
                />
              </label>
              <label>
                Account
                <input
                  value={txDraft.account}
                  onChange={(e) =>
                    setTxDraft((c) => ({ ...c, account: e.target.value }))
                  }
                />
              </label>
              <label>
                Miner id
                <input
                  value={txDraft.minerId ?? ''}
                  onChange={(e) =>
                    setTxDraft((c) => ({
                      ...c,
                      minerId: e.target.value || null,
                    }))
                  }
                />
              </label>
              <label className="miner-form__wide">
                Memo
                <input
                  value={txDraft.memo}
                  onChange={(e) =>
                    setTxDraft((c) => ({ ...c, memo: e.target.value }))
                  }
                />
              </label>
              <div className="form-actions">
                <button className="button button--primary" type="submit">
                  Append entry
                </button>
              </div>
            </form>
            <ul className="admin-list">
              {props.transactions.map((tx) => (
                <li key={tx.id}>
                  <span>
                    {tx.date} · {tx.transactionType} · {tx.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => void props.onRemoveTx(tx.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
              {props.transactions.length === 0 && (
                <li className="empty-state">No ledger entries yet.</li>
              )}
            </ul>
          </div>
          <div className="panel">
            <TreasuryEditor
              key={props.treasury.updatedAt}
              position={props.treasury}
              onSave={props.onSaveTreasury}
            />
          </div>
        </div>
      )}

      {tab === 'liabilities' && (
        <div className="panel">
          <form className="miner-form" onSubmit={submitLiability}>
            <label>
              Kind
              <select
                value={liabDraft.kind}
                onChange={(e) =>
                  setLiabDraft((c) => ({
                    ...c,
                    kind: e.target.value as Liability['kind'],
                  }))
                }
              >
                <option value="equipment_financing">Equipment financing</option>
                <option value="hosting_payable">Hosting payable</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Label
              <input
                required
                value={liabDraft.label}
                onChange={(e) =>
                  setLiabDraft((c) => ({ ...c, label: e.target.value }))
                }
              />
            </label>
            <label>
              Amount (USD)
              <input
                min={0}
                step={0.01}
                type="number"
                value={liabDraft.amountUsd}
                onChange={(e) =>
                  setLiabDraft((c) => ({
                    ...c,
                    amountUsd: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label>
              Counterparty
              <input
                value={liabDraft.counterparty}
                onChange={(e) =>
                  setLiabDraft((c) => ({
                    ...c,
                    counterparty: e.target.value,
                  }))
                }
              />
            </label>
            <div className="form-actions">
              <button className="button button--primary" type="submit">
                Add liability
              </button>
            </div>
          </form>
          <ul className="admin-list">
            {props.liabilities.map((row) => (
              <li key={row.id}>
                <span>
                  {row.label} · {formatUsdCompact(row.amountUsd)}
                </span>
                <button
                  type="button"
                  onClick={() => void props.onRemoveLiability(row.id)}
                >
                  Remove
                </button>
              </li>
            ))}
            {props.liabilities.length === 0 && (
              <li className="empty-state">No liabilities recorded.</li>
            )}
          </ul>
        </div>
      )}

      {tab === 'assumptions' && (
        <form
          className="panel miner-form"
          onSubmit={(event) => {
            event.preventDefault();
            void props.onSaveAssumptions(assumptions);
          }}
        >
          <label>
            Pool fee
            <input
              min={0}
              max={1}
              step={0.001}
              type="number"
              value={assumptions.poolFeePct}
              onChange={(e) =>
                setAssumptions((c) => ({
                  ...c,
                  poolFeePct: Number(e.target.value),
                }))
              }
            />
          </label>
          <label>
            Uptime
            <input
              min={0}
              max={1}
              step={0.01}
              type="number"
              value={assumptions.uptimePct}
              onChange={(e) =>
                setAssumptions((c) => ({
                  ...c,
                  uptimePct: Number(e.target.value),
                }))
              }
            />
          </label>
          <label>
            Default electricity ($/kWh)
            <input
              min={0}
              step={0.001}
              type="number"
              value={assumptions.defaultElectricityRatePerKwh}
              onChange={(e) =>
                setAssumptions((c) => ({
                  ...c,
                  defaultElectricityRatePerKwh: Number(e.target.value),
                }))
              }
            />
          </label>
          <label>
            Efficiency target (J/TH)
            <input
              min={0}
              step={0.1}
              type="number"
              value={assumptions.efficiencyTargetJTh ?? ''}
              onChange={(e) =>
                setAssumptions((c) => ({
                  ...c,
                  efficiencyTargetJTh:
                    e.target.value === '' ? null : Number(e.target.value),
                }))
              }
            />
          </label>
          <label>
            Other assets (USD)
            <input
              min={0}
              step={0.01}
              type="number"
              value={assumptions.otherAssetsUsd}
              onChange={(e) =>
                setAssumptions((c) => ({
                  ...c,
                  otherAssetsUsd: Number(e.target.value),
                }))
              }
            />
          </label>
          <label>
            Target BTC
            <input
              min={0}
              step="any"
              type="number"
              value={assumptions.targetBtc}
              onChange={(e) =>
                setAssumptions((c) => ({
                  ...c,
                  targetBtc: Number(e.target.value),
                }))
              }
            />
          </label>
          <div className="form-actions">
            <button className="button button--primary" type="submit">
              Save assumptions
            </button>
          </div>
        </form>
      )}

      {tab === 'allocation' && (
        <form
          className="panel miner-form"
          onSubmit={(event) => {
            event.preventDefault();
            void props.onSaveAllocation(targets);
          }}
        >
          {targets.map((target, index) => (
            <label key={target.bucket}>
              {target.label} target
              <input
                min={0}
                max={1}
                step={0.01}
                type="number"
                value={target.targetPct}
                onChange={(e) => {
                  const targetPct = Number(e.target.value);
                  setTargets((current) =>
                    current.map((row, i) =>
                      i === index ? { ...row, targetPct } : row,
                    ),
                  );
                }}
              />
            </label>
          ))}
          <div className="form-actions">
            <button className="button button--primary" type="submit">
              Save targets
            </button>
          </div>
        </form>
      )}

      {tab === 'imports' && (
        <div className="panel">
          <h4>Bulk miner CSV import</h4>
          <p className="panel__meta">
            Parse → validate → preview → confirm. Demo inventory never becomes
            owner inventory through this path.
          </p>
          <p>
            <a href="/api/owner/import/templates/miners.csv">
              Download miner CSV template
            </a>
            {' · '}
            <a href="/api/owner/import/templates/facilities.csv">
              Facility template
            </a>
            {' · '}
            <a href="/api/owner/import/templates/accounting.csv">
              Accounting template
            </a>
          </p>
          <textarea
            rows={8}
            value={importCsv}
            onChange={(e) => setImportCsv(e.target.value)}
            placeholder="Paste CSV contents here"
          />
          <div className="form-actions">
            <button
              className="button"
              type="button"
              onClick={() => {
                setError(null);
                setImportMessage(null);
                void props.onPreviewMinerCsv?.(importCsv).then(
                  (r) =>
                    setImportMessage(
                      r.summary ??
                        `Preview: ${r.inserts} insert, ${r.updates} update, ${r.rejected} rejected`,
                    ),
                  (err) =>
                    setError(err instanceof Error ? err.message : 'Preview failed'),
                );
              }}
            >
              Preview miners
            </button>
            <button
              className="button button--primary"
              type="button"
              onClick={() => {
                setError(null);
                setImportMessage(null);
                void props.onCommitMinerCsv?.(importCsv).then(
                  (msg) => setImportMessage(msg),
                  (err) =>
                    setError(err instanceof Error ? err.message : 'Commit failed'),
                );
              }}
            >
              Confirm commit
            </button>
            <button
              className="button"
              type="button"
              onClick={() => {
                setError(null);
                setImportMessage(null);
                void props.onImportAccountingCsv?.(importCsv).then(
                  (msg) => setImportMessage(msg),
                  (err) =>
                    setError(err instanceof Error ? err.message : 'Import failed'),
                );
              }}
            >
              Import accounting CSV
            </button>
          </div>
          {importMessage && <p className="notice">{importMessage}</p>}
          <p className="panel__meta">
            Accounting imports are MANUAL / IMPORTED provenance — never LIVE.
            Found Accounting remains NOT CONNECTED.
          </p>
        </div>
      )}

      {tab === 'reconciliation' && (
        <div className="panel">
          <div className="form-actions">
            <button
              className="button button--primary"
              type="button"
              onClick={() => void props.onRefreshReconciliation?.()}
            >
              Run reconciliation
            </button>
          </div>
          <ul className="admin-list">
            {(props.reconciliationIssues ?? []).length === 0 && (
              <li>
                <span>No issues reported. Run reconciliation to refresh.</span>
              </li>
            )}
            {(props.reconciliationIssues ?? []).map((issue) => (
              <li key={issue.id}>
                <span>
                  <strong>{issue.severity}</strong> · {issue.code} — {issue.title}
                  <br />
                  <span className="panel__meta">{issue.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'connections' && (
        <div className="panel">
          <h4>Braiins Pool</h4>
          <ul className="admin-list">
            <li>
              <span>
                Configured:{' '}
                {props.braiinsConnection?.configured ? 'yes' : 'no'}
              </span>
            </li>
            <li>
              <span>
                Authenticated:{' '}
                {props.braiinsConnection?.authenticated == null
                  ? 'n/a'
                  : props.braiinsConnection.authenticated
                    ? 'yes'
                    : 'failed / required'}
              </span>
            </li>
            <li>
              <span>
                Last successful sync:{' '}
                {props.braiinsConnection?.lastSuccessfulSync ?? '—'}
              </span>
            </li>
            <li>
              <span>
                Workers: {props.braiinsConnection?.workerCount ?? '—'} · matched{' '}
                {props.braiinsConnection?.matchedWorkers ?? '—'} · unmatched{' '}
                {props.braiinsConnection?.unmatchedWorkers ?? '—'} · stale{' '}
                {props.braiinsConnection?.staleWorkers ?? '—'}
              </span>
            </li>
            {props.braiinsConnection?.lastError && (
              <li>
                <span>Provider error: {props.braiinsConnection.lastError}</span>
              </li>
            )}
          </ul>
          <h4>Found Accounting</h4>
          <p>
            <strong>Found Accounting — NOT CONNECTED</strong>
          </p>
          <p className="panel__meta">
            No API scrape. Use Imports → accounting CSV (MANUAL / IMPORTED).
          </p>
        </div>
      )}

      {tab === 'backup' && (
        <div className="panel">
          <h4>Durable ledger backup</h4>
          <p className="panel__meta">
            JSON backup of miners, facilities, treasury, liabilities, settings.
            Portable for disaster recovery.
          </p>
          <div className="form-actions">
            <button
              className="button button--primary"
              type="button"
              onClick={() => void props.onExportBackup?.()}
            >
              Export JSON backup
            </button>
            <a className="button" href="/api/owner/export/miners.csv">
              Export miners CSV
            </a>
          </div>
          {props.legacyMigration?.present && (
            <>
              <h4>Legacy browser ledger migration</h4>
              <p className="panel__meta">
                Detected localStorage data: {props.legacyMigration.minerCount}{' '}
                miners, {props.legacyMigration.facilityCount} facilities,{' '}
                {props.legacyMigration.transactionCount} txs. Server status:{' '}
                {props.legacyMigration.status ?? 'unknown'}. Explicit import
                only — never silent overwrite.
              </p>
              <div className="form-actions">
                <button
                  className="button"
                  type="button"
                  onClick={() => props.onDownloadLegacyBackup?.()}
                >
                  Download browser backup
                </button>
                <button
                  className="button button--primary"
                  type="button"
                  onClick={() => void props.onMigrateLegacy?.()}
                >
                  Import into durable ledger
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
