import { useState, type FormEvent } from 'react';
import type { TreasuryPosition } from '../domain/types';

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

  const numberField = (
    key: keyof Pick<
      TreasuryPosition,
      | 'btcHoldings'
      | 'avgAcquisitionPriceUsd'
      | 'monthlyAccumulationBtc'
      | 'targetBtc'
    >,
    label: string,
    step: string,
  ) => (
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
            Operator-entered · saved only in this browser
          </span>
        </div>
        <span className="badge badge--manual">Manual</span>
      </div>
      <div className="treasury-editor__fields">
        {numberField('btcHoldings', 'BTC holdings', '0.00000001')}
        {numberField(
          'avgAcquisitionPriceUsd',
          'Average acquisition price (USD)',
          '0.01',
        )}
        {numberField(
          'monthlyAccumulationBtc',
          'Monthly accumulation (BTC)',
          '0.00000001',
        )}
        {numberField('targetBtc', 'Target (BTC)', '0.00000001')}
      </div>
      <button className="button button--primary" disabled={saving} type="submit">
        {saving ? 'Saving…' : 'Save Treasury'}
      </button>
    </form>
  );
}
