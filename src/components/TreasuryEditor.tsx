import { useState, type FormEvent } from 'react';
import type { TreasuryPosition } from '../domain/types';

type NumberKey = keyof Pick<
  TreasuryPosition,
  | 'btcHoldings'
  | 'avgAcquisitionPriceUsd'
  | 'btcMined'
  | 'btcPurchased'
  | 'btcSold'
  | 'btcTransferred'
  | 'cashReserveUsd'
  | 'minerHardwareBookValueUsd'
  | 'otherAssetsUsd'
  | 'liabilitiesUsd'
  | 'monthlyAccumulationBtc'
  | 'targetBtc'
>;

export function TreasuryEditor({
  position,
  onSave,
}: {
  position: TreasuryPosition;
  onSave: (position: TreasuryPosition) => Promise<void>;
}) {
  const [draft, setDraft] = useState(position);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  const numberField = (key: NumberKey, label: string, step: string) => (
    <label>
      {label}
      <input
        min="0"
        step={step}
        type="number"
        value={draft[key]}
        onChange={(event) =>
          setDraft((current) => ({
            ...current,
            [key]: Math.max(0, Number(event.target.value)),
          }))
        }
      />
    </label>
  );

  return (
    <form className="treasury-editor" onSubmit={submit}>
      <div className="panel__head">
        <div>
          <h3>Manual treasury position</h3>
          <span className="panel__meta">
            Operator-entered · MANUAL · saved only in this browser
          </span>
        </div>
        <span className="badge badge--manual">MANUAL</span>
      </div>
      <div className="treasury-editor__fields">
        {numberField('btcHoldings', 'BTC held', '0.00000001')}
        {numberField('btcMined', 'BTC mined (tracked)', '0.00000001')}
        {numberField('btcPurchased', 'BTC purchased', '0.00000001')}
        {numberField('btcSold', 'BTC sold', '0.00000001')}
        {numberField('btcTransferred', 'BTC transferred (net in)', '0.00000001')}
        {numberField(
          'avgAcquisitionPriceUsd',
          'Average cost basis ($/BTC)',
          '0.01',
        )}
        {numberField('cashReserveUsd', 'Cash reserve (USD)', '0.01')}
        {numberField(
          'minerHardwareBookValueUsd',
          'Miner hardware book value (USD)',
          '0.01',
        )}
        {numberField('otherAssetsUsd', 'Other assets (USD)', '0.01')}
        {numberField('liabilitiesUsd', 'Liabilities (USD)', '0.01')}
        {numberField(
          'monthlyAccumulationBtc',
          'Monthly accumulation plan (BTC)',
          '0.00000001',
        )}
        {numberField('targetBtc', 'Target (BTC)', '0.00000001')}
      </div>
      <p className="field-hint">
        Treasury cost basis is independent of mining production calculations.
        Leave zeros until real Forge figures are available.
      </p>
      <button className="button button--primary" disabled={saving} type="submit">
        {saving ? 'Saving…' : 'Save Treasury'}
      </button>
    </form>
  );
}
