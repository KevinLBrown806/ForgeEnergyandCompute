/**
 * PLACEHOLDER / EXAMPLE fleet records — NOT Forge operating inventory.
 *
 * OPERATOR: replace these demo assets by registering real miners in the
 * Fleet Registry UI (or import into the FleetRepository). Demo mode never
 * writes these rows into the operating registry.
 *
 * Where to enter real miner information:
 *   1. Dashboard → Fleet registry → "+ Add Miner"  (preferred)
 *   2. Or persist via FleetRepository (`forge.fleet.v1` localStorage key)
 *
 * Fields to fill for each real unit:
 *   manufacturer, model, serialNumber, quantity, nominalHashrateTh (TH/s),
 *   wattage, efficiencyJTh (optional), acquisitionDate, acquisitionCostUsd,
 *   hostingProvider, facility, electricityRatePerKwh, monthlyHostingFeeUsd,
 *   pool, braiinsWorkerName (1:1 mapping), status, notes
 */

import type { MinerAsset, MinerAssetInput } from '../domain/types';

/** Small illustrative sample — clearly labeled demo, not operating inventory. */
export const DEMO_FLEET: MinerAsset[] = [
  {
    id: 'demo-s21-001',
    manufacturer: 'Bitmain',
    model: 'Antminer S21',
    serialNumber: 'DEMO-S21-001',
    serialNumbers: ['DEMO-S21-001'],
    quantity: 1,
    nominalHashrateTh: 200,
    wattage: 3500,
    efficiencyJTh: 17.5,
    acquisitionDate: '2025-06-01',
    acquisitionCostUsd: 4500,
    hostingProvider: 'Demo Host',
    facility: 'Demo Facility A',
    electricityRatePerKwh: 0.045,
    monthlyHostingFeeUsd: 0,
    pool: 'Braiins Pool',
    braiinsWorkerName: 'forge.demo1',
    status: 'active',
    enabled: true,
    warrantyExpiration: '2027-06-01',
    notes: 'EXAMPLE PLACEHOLDER — replace with real Forge miner data.',
    createdAt: '2025-06-01T00:00:00.000Z',
    updatedAt: '2025-06-01T00:00:00.000Z',
  },
  {
    id: 'demo-s21pro-001',
    manufacturer: 'Bitmain',
    model: 'Antminer S21 Pro',
    serialNumber: 'DEMO-S21P-001',
    quantity: 1,
    nominalHashrateTh: 234,
    wattage: 3510,
    efficiencyJTh: 15.0,
    acquisitionDate: '2025-08-15',
    acquisitionCostUsd: 5200,
    hostingProvider: 'Demo Host',
    facility: 'Demo Facility A',
    electricityRatePerKwh: 0.045,
    monthlyHostingFeeUsd: 0,
    pool: 'Braiins Pool',
    braiinsWorkerName: 'forge.demo2',
    status: 'active',
    enabled: true,
    warrantyExpiration: '2027-08-15',
    notes: 'EXAMPLE PLACEHOLDER — replace with real Forge miner data.',
    createdAt: '2025-08-15T00:00:00.000Z',
    updatedAt: '2025-08-15T00:00:00.000Z',
  },
  {
    id: 'demo-m60s-001',
    manufacturer: 'MicroBT',
    model: 'WhatsMiner M60S',
    serialNumber: 'DEMO-M60-001',
    quantity: 1,
    nominalHashrateTh: 186,
    wattage: 3441,
    efficiencyJTh: 18.5,
    acquisitionDate: '2025-09-01',
    acquisitionCostUsd: 3800,
    hostingProvider: 'Demo Host',
    facility: 'Demo Facility B',
    electricityRatePerKwh: 0.05,
    monthlyHostingFeeUsd: 75,
    pool: 'Braiins Pool',
    braiinsWorkerName: null,
    status: 'maintenance',
    enabled: false,
    warrantyExpiration: null,
    notes: 'EXAMPLE PLACEHOLDER — repair / unmapped demo asset.',
    createdAt: '2025-09-01T00:00:00.000Z',
    updatedAt: '2025-09-01T00:00:00.000Z',
  },
  {
    id: 'demo-ordered-001',
    manufacturer: 'Bitmain',
    model: 'Antminer S21 XP',
    serialNumber: 'DEMO-ORDER-001',
    quantity: 2,
    nominalHashrateTh: 270,
    wattage: 3645,
    efficiencyJTh: 13.5,
    acquisitionDate: null,
    acquisitionCostUsd: 6000,
    hostingProvider: 'Pending',
    facility: 'Pending',
    electricityRatePerKwh: null,
    monthlyHostingFeeUsd: null,
    pool: 'Braiins Pool',
    braiinsWorkerName: null,
    status: 'ordered',
    enabled: false,
    warrantyExpiration: null,
    notes: 'EXAMPLE PLACEHOLDER — ORDERED units excluded from production.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export function createEmptyMinerInput(): MinerAssetInput {
  return {
    manufacturer: '',
    model: '',
    serialNumber: '',
    quantity: 1,
    nominalHashrateTh: 200,
    wattage: 3500,
    efficiencyJTh: null,
    acquisitionDate: null,
    acquisitionCostUsd: null,
    shippingCostUsd: null,
    deploymentCostUsd: null,
    deploymentDate: null,
    hostingProvider: '',
    facility: '',
    facilityId: null,
    electricityRatePerKwh: null,
    monthlyHostingFeeUsd: null,
    pool: 'Braiins Pool',
    braiinsWorkerName: null,
    status: 'active',
    enabled: true,
    warrantyExpiration: null,
    notes: '',
  };
}
