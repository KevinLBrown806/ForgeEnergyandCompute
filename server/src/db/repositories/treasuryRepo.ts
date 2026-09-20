import type { ForgeDb } from '../client.js';
import { nowIso } from '../client.js';
import {
  DEFAULT_TREASURY,
  type TreasuryPosition,
  type TreasuryTransaction,
  type TreasuryTransactionInput,
} from '../../domain/owner.js';
import { writeAudit } from './auditRepo.js';

type TxRow = {
  id: string;
  date: string;
  transaction_type: string;
  asset: string;
  quantity: number;
  unit_price: number | null;
  gross_amount: number;
  fee: number;
  counterparty: string;
  account: string;
  miner_id: string | null;
  facility_id: string | null;
  memo: string;
  source: string;
  external_reference: string | null;
  production_ref: string | null;
  created_at: string;
};

function rowToTx(row: TxRow): TreasuryTransaction {
  return {
    id: row.id,
    date: row.date,
    transactionType: row.transaction_type as TreasuryTransaction['transactionType'],
    asset: row.asset as TreasuryTransaction['asset'],
    quantity: row.quantity,
    unitPrice: row.unit_price,
    grossAmount: row.gross_amount,
    fee: row.fee,
    counterparty: row.counterparty,
    account: row.account,
    minerId: row.miner_id,
    facilityId: row.facility_id,
    memo: row.memo,
    source: row.source as TreasuryTransaction['source'],
    externalReference: row.external_reference,
    productionRef: row.production_ref,
    createdAt: row.created_at,
  };
}

export function listTreasuryTransactions(db: ForgeDb): TreasuryTransaction[] {
  const rows = db
    .prepare('SELECT * FROM treasury_transactions ORDER BY date ASC, created_at ASC')
    .all() as TxRow[];
  return rows.map(rowToTx);
}

export function appendTreasuryTransaction(
  db: ForgeDb,
  input: TreasuryTransactionInput,
): TreasuryTransaction {
  if (!input.id?.trim()) throw new Error('Transaction id is required');
  if (!Number.isFinite(input.quantity)) {
    throw new Error('Transaction quantity must be a finite number');
  }
  const existing = db
    .prepare('SELECT id FROM treasury_transactions WHERE id = ?')
    .get(input.id) as { id: string } | undefined;
  if (existing) throw new Error(`Duplicate treasury transaction id: ${input.id}`);

  const tx: TreasuryTransaction = {
    ...input,
    createdAt: input.createdAt ?? nowIso(),
  };

  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO treasury_transactions (
        id, date, transaction_type, asset, quantity, unit_price, gross_amount, fee,
        counterparty, account, miner_id, facility_id, memo, source,
        external_reference, production_ref, created_at
      ) VALUES (
        @id, @date, @transactionType, @asset, @quantity, @unitPrice, @grossAmount, @fee,
        @counterparty, @account, @minerId, @facilityId, @memo, @source,
        @externalReference, @productionRef, @createdAt
      )`,
    ).run({
      id: tx.id,
      date: tx.date,
      transactionType: tx.transactionType,
      asset: tx.asset,
      quantity: tx.quantity,
      unitPrice: tx.unitPrice,
      grossAmount: tx.grossAmount,
      fee: tx.fee,
      counterparty: tx.counterparty,
      account: tx.account,
      minerId: tx.minerId,
      facilityId: tx.facilityId,
      memo: tx.memo,
      source: tx.source,
      externalReference: tx.externalReference,
      productionRef: tx.productionRef ?? null,
      createdAt: tx.createdAt,
    });
    writeAudit(db, {
      recordType: 'treasury_transaction',
      recordId: tx.id,
      action: 'append',
      priorValue: null,
      newValue: tx,
      source: 'api',
    });
  });
  run();
  return tx;
}

/**
 * Treasury is append-only. Destructive delete is refused.
 * Use REVERSAL / ADJUSTMENT transactions instead.
 */
export function refuseTreasuryDelete(): never {
  throw new Error(
    'Treasury ledger is append-only. Record a REVERSAL or ADJUSTMENT transaction instead of deleting history.',
  );
}

export function getTreasuryPosition(db: ForgeDb): TreasuryPosition {
  const row = db
    .prepare('SELECT payload_json, updated_at FROM treasury_positions WHERE id = ?')
    .get('default') as { payload_json: string; updated_at: string } | undefined;
  if (!row) return { ...DEFAULT_TREASURY };
  try {
    const parsed = JSON.parse(row.payload_json) as Partial<TreasuryPosition>;
    return {
      ...DEFAULT_TREASURY,
      ...parsed,
      source: 'manual',
      updatedAt: row.updated_at,
    };
  } catch {
    return { ...DEFAULT_TREASURY };
  }
}

export function saveTreasuryPosition(
  db: ForgeDb,
  position: TreasuryPosition,
): TreasuryPosition {
  const prior = getTreasuryPosition(db);
  const next: TreasuryPosition = {
    ...DEFAULT_TREASURY,
    ...position,
    source: 'manual',
    updatedAt: nowIso(),
  };
  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO treasury_positions (id, payload_json, updated_at)
       VALUES ('default', ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at`,
    ).run(JSON.stringify(next), next.updatedAt);
    writeAudit(db, {
      recordType: 'treasury_position',
      recordId: 'default',
      action: 'save',
      priorValue: prior,
      newValue: next,
      source: 'api',
    });
  });
  run();
  return next;
}

/** Reconstruct BTC holdings from append-only transaction history. */
export function reconstructBtcHoldingsFromLedger(
  txs: TreasuryTransaction[],
): {
  btcHoldings: number;
  btcMined: number;
  btcPurchased: number;
  btcSold: number;
} {
  let btcHoldings = 0;
  let btcMined = 0;
  let btcPurchased = 0;
  let btcSold = 0;
  for (const tx of txs) {
    if (tx.asset !== 'BTC') continue;
    const q = tx.quantity;
    switch (tx.transactionType) {
      case 'BTC_MINED':
        btcMined += q;
        btcHoldings += q;
        break;
      case 'BTC_PURCHASE':
      case 'BTC_TRANSFER_IN':
        if (tx.transactionType === 'BTC_PURCHASE') btcPurchased += q;
        btcHoldings += q;
        break;
      case 'BTC_SALE':
        btcSold += q;
        btcHoldings -= q;
        break;
      case 'BTC_TRANSFER_OUT':
        btcHoldings -= q;
        break;
      case 'REVERSAL':
      case 'ADJUSTMENT':
        btcHoldings += q;
        break;
      default:
        break;
    }
  }
  return { btcHoldings, btcMined, btcPurchased, btcSold };
}
