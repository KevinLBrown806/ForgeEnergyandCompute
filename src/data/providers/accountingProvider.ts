/**
 * Accounting provider — Found / bookkeeping actuals.
 *
 * Found is NOT CONNECTED. This contract is what Forge would use later
 * for balances, transactions, opex, contributions, mining income, and
 * hosting/power costs. Do not scrape Found or invent a live API.
 */

import type { DataSource } from '../../domain/dataSource';
import { DataSource as DS } from '../../domain/dataSource';

export interface AccountingBalance {
  account: string;
  asset: 'USD' | 'BTC';
  quantity: number;
}

export interface AccountingTransaction {
  id: string;
  date: string;
  type: string;
  amountUsd: number | null;
  amountBtc: number | null;
  memo: string;
}

export interface AccountingSnapshot {
  connected: boolean;
  provider: 'found';
  status: 'NOT_CONNECTED';
  cashReserveUsd: number | null;
  minerHardwareBookValueUsd: number | null;
  liabilitiesUsd: number | null;
  balances: AccountingBalance[];
  transactions: AccountingTransaction[];
  operatingExpensesUsd: number | null;
  ownerContributionsUsd: number | null;
  miningIncomeUsd: number | null;
  hostingPowerCostsUsd: number | null;
  source: DataSource;
  notes: string;
}

export interface AccountingProvider {
  getSnapshot(): Promise<AccountingSnapshot>;
  getBalances(): Promise<AccountingBalance[]>;
  getTransactions(): Promise<AccountingTransaction[]>;
  getOperatingExpenses(): Promise<number | null>;
  getOwnerContributions(): Promise<number | null>;
  getMiningIncome(): Promise<number | null>;
  getHostingPowerCosts(): Promise<number | null>;
}

const DISCONNECTED: AccountingSnapshot = {
  connected: false,
  provider: 'found',
  status: 'NOT_CONNECTED',
  cashReserveUsd: null,
  minerHardwareBookValueUsd: null,
  liabilitiesUsd: null,
  balances: [],
  transactions: [],
  operatingExpensesUsd: null,
  ownerContributionsUsd: null,
  miningIncomeUsd: null,
  hostingPowerCostsUsd: null,
  source: DS.MANUAL,
  notes:
    'Found Accounting is not connected. Enter cash, hardware, liabilities, and treasury transactions in Data Management.',
};

export function createStubAccountingProvider(): AccountingProvider {
  return {
    async getSnapshot() {
      return { ...DISCONNECTED };
    },
    async getBalances() {
      return [];
    },
    async getTransactions() {
      return [];
    },
    async getOperatingExpenses() {
      return null;
    },
    async getOwnerContributions() {
      return null;
    },
    async getMiningIncome() {
      return null;
    },
    async getHostingPowerCosts() {
      return null;
    },
  };
}
