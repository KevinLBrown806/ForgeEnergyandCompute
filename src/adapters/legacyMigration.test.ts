import { describe, expect, it } from 'vitest';
import { detectLegacyLocalStorageLedger } from './legacyMigration';

describe('legacy localStorage detection', () => {
  it('reports absent when storage is empty', () => {
    const store = new Map<string, string>();
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    });
    try {
      expect(detectLegacyLocalStorageLedger().present).toBe(false);
      store.set('forge.fleet.v1', JSON.stringify([{ id: '1' }]));
      const detected = detectLegacyLocalStorageLedger();
      expect(detected.present).toBe(true);
      expect(detected.minerCount).toBe(1);
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: original,
      });
    }
  });
});
