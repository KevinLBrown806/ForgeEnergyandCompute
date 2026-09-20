import { useState, type FormEvent } from 'react';
import { createEmptyMinerInput } from '../config/demoFleet';
import { validateMappedMinerQuantity } from '../domain/fleet';
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
  const [error, setError] = useState<string | null>(null);

  const mapped = Boolean(form.braiinsWorkerName?.trim());

  const set = <K extends keyof MinerAssetInput>(
    key: K,
    value: MinerAssetInput[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      validateMappedMinerQuantity({
        quantity: form.quantity,
        braiinsWorkerName: form.braiinsWorkerName,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid miner mapping');
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save miner');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="miner-form" onSubmit={submit}>
      <label>
        Manufacturer
        <input
          value={form.manufacturer}
          placeholder="Bitmain / MicroBT / …"
          onChange={(event) => set('manufacturer', event.target.value)}
        />
      </label>
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
          min={1}
          max={mapped ? 1 : undefined}
          type="number"
          value={form.quantity}
          onChange={(event) => set('quantity', Number(event.target.value))}
        />
        <span className="field-hint">
          {mapped
            ? 'Mapped miners must use quantity 1 (one device ↔ one Braiins worker).'
            : 'Quantity > 1 is allowed only for unmapped inventory groups.'}
        </span>
      </label>
      <label>
        Nominal hashrate (TH/s each)
        <input
          required
          min={0}
          step={0.01}
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
          min={0}
          step={1}
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
          <option value="online">Online</option>
          <option value="active">Online (legacy)</option>
          <option value="offline">Offline</option>
          <option value="repair">Repair</option>
          <option value="maintenance">Repair (legacy)</option>
          <option value="ordered">Ordered</option>
          <option value="shipping">Shipping</option>
          <option value="deploying">Deploying</option>
          <option value="spare">Spare</option>
          <option value="retired">Retired</option>
          <option value="sold">Sold</option>
          <option value="decommissioned">Decommissioned</option>
        </select>
      </label>
      <label>
        Efficiency (J/TH)
        <input
          min={0}
          step={0.1}
          type="number"
          value={form.efficiencyJTh ?? ''}
          placeholder="Auto from W ÷ TH"
          onChange={(event) =>
            set('efficiencyJTh', nullableNumber(event.target.value))
          }
        />
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
          min={0}
          step={0.001}
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
          min={0}
          step={0.01}
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
          onChange={(event) =>
            set('acquisitionDate', event.target.value || null)
          }
        />
      </label>
      <label>
        Purchase price (USD)
        <input
          min={0}
          step={0.01}
          type="number"
          value={form.acquisitionCostUsd ?? ''}
          onChange={(event) =>
            set('acquisitionCostUsd', nullableNumber(event.target.value))
          }
        />
      </label>
      <label>
        Shipping cost (USD)
        <input
          min={0}
          step={0.01}
          type="number"
          value={form.shippingCostUsd ?? ''}
          onChange={(event) =>
            set('shippingCostUsd', nullableNumber(event.target.value))
          }
        />
      </label>
      <label>
        Deployment cost (USD)
        <input
          min={0}
          step={0.01}
          type="number"
          value={form.deploymentCostUsd ?? ''}
          onChange={(event) =>
            set('deploymentCostUsd', nullableNumber(event.target.value))
          }
        />
      </label>
      <label>
        Deployment date
        <input
          type="date"
          value={form.deploymentDate ?? ''}
          onChange={(event) =>
            set('deploymentDate', event.target.value || null)
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
          onChange={(event) => {
            const worker = event.target.value || null;
            set('braiinsWorkerName', worker);
            if (worker && form.quantity !== 1) {
              set('quantity', 1);
            }
          }}
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
      {error && <p className="form-error">{error}</p>}
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
