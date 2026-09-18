import { useState, type FormEvent } from 'react';
import { createEmptyMinerInput } from '../config/demoFleet';
import type { MinerAsset, MinerAssetInput, PoolWorker } from '../domain/types';

interface MinerFormProps {
  asset?: MinerAsset;
  workers: PoolWorker[];
  onSave: (input: MinerAssetInput) => Promise<void>;
  onCancel: () => void;
}

function nullableNumber(value: string): number | null {
  return value.trim() === '' ? null : Number(value);
}

export function MinerForm({
  asset,
  workers,
  onSave,
  onCancel,
}: MinerFormProps) {
  const [form, setForm] = useState<MinerAssetInput>(
    asset ? { ...asset } : createEmptyMinerInput(),
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof MinerAssetInput>(
    key: K,
    value: MinerAssetInput[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="miner-form" onSubmit={submit}>
      <label>
        Model
        <input
          required
          value={form.model}
          onChange={(event) => set('model', event.target.value)}
        />
      </label>
      <label>
        Serial number
        <input
          required
          value={form.serialNumber}
          onChange={(event) => set('serialNumber', event.target.value)}
        />
      </label>
      <label>
        Quantity
        <input
          required
          min="1"
          type="number"
          value={form.quantity}
          onChange={(event) => set('quantity', Number(event.target.value))}
        />
      </label>
      <label>
        Nominal hashrate (TH/s each)
        <input
          required
          min="0"
          step="0.01"
          type="number"
          value={form.nominalHashrateTh}
          onChange={(event) =>
            set('nominalHashrateTh', Number(event.target.value))
          }
        />
      </label>
      <label>
        Power (watts each)
        <input
          required
          min="0"
          step="1"
          type="number"
          value={form.wattage}
          onChange={(event) => set('wattage', Number(event.target.value))}
        />
      </label>
      <label>
        Status
        <select
          value={form.status}
          onChange={(event) =>
            set('status', event.target.value as MinerAsset['status'])
          }
        >
          <option value="active">Active</option>
          <option value="maintenance">Maintenance</option>
          <option value="spare">Spare</option>
          <option value="retired">Retired</option>
        </select>
      </label>
      <label>
        Hosting provider
        <input
          value={form.hostingProvider}
          onChange={(event) => set('hostingProvider', event.target.value)}
        />
      </label>
      <label>
        Facility
        <input
          value={form.facility}
          onChange={(event) => set('facility', event.target.value)}
        />
      </label>
      <label>
        Electricity ($/kWh)
        <input
          min="0"
          step="0.001"
          type="number"
          value={form.electricityRatePerKwh ?? ''}
          onChange={(event) =>
            set('electricityRatePerKwh', nullableNumber(event.target.value))
          }
        />
      </label>
      <label>
        Monthly hosting fee (USD)
        <input
          min="0"
          step="0.01"
          type="number"
          value={form.monthlyHostingFeeUsd ?? ''}
          onChange={(event) =>
            set('monthlyHostingFeeUsd', nullableNumber(event.target.value))
          }
        />
      </label>
      <label>
        Acquisition date
        <input
          type="date"
          value={form.acquisitionDate ?? ''}
          onChange={(event) => set('acquisitionDate', event.target.value || null)}
        />
      </label>
      <label>
        Acquisition cost (USD)
        <input
          min="0"
          step="0.01"
          type="number"
          value={form.acquisitionCostUsd ?? ''}
          onChange={(event) =>
            set('acquisitionCostUsd', nullableNumber(event.target.value))
          }
        />
      </label>
      <label>
        Pool
        <input
          value={form.pool}
          onChange={(event) => set('pool', event.target.value)}
        />
      </label>
      <label>
        Braiins worker
        <input
          list="braiins-workers"
          value={form.braiinsWorkerName ?? ''}
          placeholder="account.worker"
          onChange={(event) =>
            set('braiinsWorkerName', event.target.value || null)
          }
        />
        <datalist id="braiins-workers">
          {workers.map((worker) => (
            <option key={worker.name} value={worker.name} />
          ))}
        </datalist>
      </label>
      <label>
        Warranty expiration
        <input
          type="date"
          value={form.warrantyExpiration ?? ''}
          onChange={(event) =>
            set('warrantyExpiration', event.target.value || null)
          }
        />
      </label>
      <label className="miner-form__wide">
        Notes
        <textarea
          rows={2}
          value={form.notes}
          onChange={(event) => set('notes', event.target.value)}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(event) => set('enabled', event.target.checked)}
        />
        Enabled for operations
      </label>
      <div className="form-actions">
        <button className="button button--primary" disabled={saving} type="submit">
          {saving ? 'Saving…' : asset ? 'Save Miner' : 'Add Miner'}
        </button>
        <button className="button" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
