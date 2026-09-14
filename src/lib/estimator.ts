export interface EstimatorInputs {
  /** Number of GPUs in the cluster. */
  gpuCount: number;
  /** Average power draw per GPU, in watts. */
  wattsPerGpu: number;
  /** Hours per day the cluster runs under load. */
  hoursPerDay: number;
  /** Electricity price, in USD per kWh. */
  pricePerKwh: number;
  /**
   * Power Usage Effectiveness of the facility. 1.0 is a perfect data center;
   * clean, well-designed facilities land around 1.1–1.2.
   */
  pue: number;
  /** Grid carbon intensity, in kilograms of CO2 per kWh. */
  carbonKgPerKwh: number;
}

export interface EstimatorResult {
  /** Total facility energy per month, in kWh. */
  monthlyKwh: number;
  /** Total energy cost per month, in USD. */
  monthlyCost: number;
  /** Carbon emitted per month, in metric tonnes of CO2. */
  monthlyCo2Tonnes: number;
  /** Facility power draw while running, in kW. */
  facilityKw: number;
}

const DAYS_PER_MONTH = 30.437;

/**
 * Estimate the monthly energy, cost, and carbon footprint of a GPU cluster.
 *
 * Facility energy accounts for overhead (cooling, networking, losses) via PUE,
 * so real-world energy is the raw GPU draw multiplied by the PUE factor.
 */
export function estimate(inputs: EstimatorInputs): EstimatorResult {
  const {
    gpuCount,
    wattsPerGpu,
    hoursPerDay,
    pricePerKwh,
    pue,
    carbonKgPerKwh,
  } = inputs;

  const itKw = (gpuCount * wattsPerGpu) / 1000;
  const facilityKw = itKw * pue;
  const monthlyKwh = facilityKw * hoursPerDay * DAYS_PER_MONTH;
  const monthlyCost = monthlyKwh * pricePerKwh;
  const monthlyCo2Tonnes = (monthlyKwh * carbonKgPerKwh) / 1000;

  return { monthlyKwh, monthlyCost, monthlyCo2Tonnes, facilityKw };
}

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatUsd(value: number): string {
  return usd.format(value);
}

export function formatNumber(value: number): string {
  return number.format(value);
}

export function formatTonnes(value: number): string {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} t`;
}
