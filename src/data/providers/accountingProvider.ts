/**
 * Accounting provider — Found / bookkeeping actuals.
 * Stub returns nulls so the UI shows "Not yet tracked" instead of inventing numbers.
 */

import type { DataSource } from '../../domain/dataSource';
import { DataSource as DS } from '../../domain/dataSource';

export interface AccountingSnapshot {
  connected: boolean;
  cashReserveUsd: number | null;
  minerHardwareBookValueUsd: number | null;
  liabilitiesUsd: number | null;
  source: DataSource;
  notes: string;
}

export interface AccountingProvider {
  getSnapshot(): Promise<AccountingSnapshot>;
}

export function createStubAccountingProvider(): AccountingProvider {
  return {
    async getSnapshot() {
      return {
        connected: false,
        cashReserveUsd: null,
        minerHardwareBookValueUsd: null,
        liabilitiesUsd: null,
        source: DS.MANUAL,
        notes:
          'Accounting actuals are not yet connected. Enter cash / hardware / liabilities in the treasury editor.',
      };
    },
  };
}
