import { useMemo, useState } from 'react';
import {
  estimate,
  formatNumber,
  formatTonnes,
  formatUsd,
  type EstimatorInputs,
} from '../lib/estimator';

interface Field {
  key: keyof EstimatorInputs;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

const FIELDS: Field[] = [
  { key: 'gpuCount', label: 'GPUs in cluster', min: 8, max: 4096, step: 8, unit: '' },
  { key: 'wattsPerGpu', label: 'Power per GPU', min: 200, max: 1200, step: 10, unit: 'W' },
  { key: 'hoursPerDay', label: 'Load hours / day', min: 1, max: 24, step: 1, unit: 'h' },
  { key: 'pricePerKwh', label: 'Energy price', min: 0.02, max: 0.4, step: 0.01, unit: '$/kWh' },
  { key: 'pue', label: 'Facility PUE', min: 1.0, max: 2.0, step: 0.01, unit: '' },
  { key: 'carbonKgPerKwh', label: 'Grid carbon', min: 0, max: 0.9, step: 0.01, unit: 'kg/kWh' },
];

const DEFAULTS: EstimatorInputs = {
  gpuCount: 512,
  wattsPerGpu: 700,
  hoursPerDay: 20,
  pricePerKwh: 0.06,
  pue: 1.12,
  carbonKgPerKwh: 0.05,
};

export function Estimator() {
  const [inputs, setInputs] = useState<EstimatorInputs>(DEFAULTS);

  const result = useMemo(() => estimate(inputs), [inputs]);

  const update = (key: keyof EstimatorInputs, value: number) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  return (
    <section className="estimator" id="estimator" aria-labelledby="estimator-title">
      <div className="estimator__intro">
        <p className="eyebrow">Interactive</p>
        <h2 id="estimator-title">Cluster cost &amp; carbon estimator</h2>
        <p className="lede">
          Model the monthly energy bill and carbon footprint of a GPU cluster.
          Adjust the cluster and watch the numbers update instantly.
        </p>
      </div>

      <div className="estimator__grid">
        <div className="estimator__controls">
          {FIELDS.map((field) => (
            <label key={field.key} className="control">
              <span className="control__label">
                {field.label}
                <output className="control__value">
                  {formatNumber(inputs[field.key])}
                  {field.unit ? ` ${field.unit}` : ''}
                </output>
              </span>
              <input
                type="range"
                min={field.min}
                max={field.max}
                step={field.step}
                value={inputs[field.key]}
                aria-label={field.label}
                onChange={(e) => update(field.key, Number(e.target.value))}
              />
            </label>
          ))}
        </div>

        <div className="estimator__results" role="status" aria-live="polite">
          <Metric
            label="Monthly energy"
            value={`${formatNumber(result.monthlyKwh)} kWh`}
            hint={`${formatNumber(result.facilityKw)} kW facility draw`}
          />
          <Metric
            label="Monthly cost"
            value={formatUsd(result.monthlyCost)}
            hint={`${formatUsd(result.monthlyCost * 12)} / year`}
            highlight
          />
          <Metric
            label="Monthly CO₂"
            value={formatTonnes(result.monthlyCo2Tonnes)}
            hint={`${formatTonnes(result.monthlyCo2Tonnes * 12)} / year`}
          />
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <div className={`metric${highlight ? ' metric--highlight' : ''}`}>
      <p className="metric__label">{label}</p>
      <p className="metric__value">{value}</p>
      <p className="metric__hint">{hint}</p>
    </div>
  );
}
