import { describe, expect, it } from 'vitest';
import {
  maskDestination,
  normalizePayouts,
  normalizeProfile,
  normalizeRewards,
  normalizeWorkers,
  toTh,
} from '../src/braiins/normalize.js';

describe('Braiins normalization', () => {
  it('converts reported hashrate units to TH/s', () => {
    expect(toTh(15_000, 'Gh/s')).toBe(15);
    expect(toTh(2.5, 'Ph/s')).toBe(2_500);
    expect(toTh(180, 'TH/s')).toBe(180);
  });

  it('normalizes profile, worker, and reward DTO fields', () => {
    const profile = normalizeProfile({
      username: 'forge',
      btc: {
        hash_rate_unit: 'Gh/s',
        hash_rate_5m: 200_000,
        hash_rate_60m: 190_000,
        hash_rate_24h: 180_000,
        hash_rate_yesterday: 175_000,
        ok_workers: 1,
        low_workers: 2,
        off_workers: 3,
        dis_workers: 4,
        current_balance: '0.25',
        today_reward: '0.01',
        estimated_reward: '0.02',
        all_time_reward: '1.5',
      },
    });
    const workers = normalizeWorkers({
      btc: {
        workers: {
          'forge.worker-1': {
            state: 'OK',
            last_share: 1_726_692_000,
            hash_rate_unit: 'Gh/s',
            hash_rate_5m: 200_000,
            hash_rate_60m: 190_000,
            hash_rate_24h: 180_000,
            hash_rate_scoring: 195_000,
            shares_5m: 10,
            shares_60m: 100,
            shares_24h: 2_400,
          },
        },
      },
    });
    const rewards = normalizeRewards({
      btc: {
        daily_rewards: [
          {
            date: 1_726_675_200,
            total_reward: '0.01',
            mining_reward: '0.009',
            bos_plus_reward: '0.001',
            referral_bonus: '0',
            referral_reward: '0',
          },
        ],
      },
    });

    expect(profile.hashRate5mTh).toBe(200);
    expect(profile.currentBalanceBtc).toBe(0.25);
    expect(workers[0]).toMatchObject({
      name: 'forge.worker-1',
      state: 'ok',
      hashRate5mTh: 200,
      hashRate24hTh: 180,
      hashRateUnit: 'TH/s',
    });
    expect(rewards[0].totalRewardBtc).toBe(0.01);
  });

  it('masks payout destinations before returning them', () => {
    const address = 'bc1qexampledestination1234567890';
    const payouts = normalizePayouts({
      onchain: [
        {
          tx_id: 'tx-1',
          status: 'confirmed',
          amount_sats: 100_000_000,
          fee_sats: 500,
          destination: address,
          requested_at_ts: 1_726_675_200,
          resolved_at_ts: 1_726_675_300,
          trigger_type: 'triggered',
        },
      ],
      lightning: [
        {
          status: 'confirmed',
          amount_sats: 50_000,
          destination: 'forge@example.com',
          requested_at_ts: 1_726_675_400,
        },
      ],
    });

    expect(payouts[0].destinationMasked).not.toContain(
      'forge@example.com',
    );
    expect(payouts[1].destinationMasked).toBe(maskDestination(address));
    expect(JSON.stringify(payouts)).not.toContain(address);
  });
});
