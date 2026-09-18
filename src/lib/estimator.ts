export interface EstimatorInputs {
  /** Number of machines in the cluster. */
  deviceCount: number;
  /** Average power draw per machine, in watts. */
  wattsPerDevice: number;
  /** Hours per day the machines run under load. */
  hoursPerDay: number;
  /** Electricity price, in USD per kWh. */
  pricePerKwh: number;
  /**
   * Power Usage Effectiveness of the facility. 1.0 is a perfect data center;
   * clean, well-designed facilities land around 1.05–1.2.
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

/** Average days in a month, shared across the calculation modules. */
export const DAYS_PER_MONTH = 30.437;

/**
 * Estimate the monthly energy, cost, and carbon footprint of a fleet of
 * power-consuming machines (miners or GPUs).
 *
 * Facility energy accounts for overhead (cooling, networking, losses) via PUE,
 * so real-world energy is the raw device draw multiplied by the PUE factor.
 */
export function estimate(inputs: EstimatorInputs): EstimatorResult {
  const {
    deviceCount,
    wattsPerDevice,
    hoursPerDay,
    pricePerKwh,
    pue,
    carbonKgPerKwh,
  } = inputs;

  const itKw = (deviceCount * wattsPerDevice) / 1000;
  const facilityKw = itKw * pue;
  const monthlyKwh = facilityKw * hoursPerDay * DAYS_PER_MONTH;
  const monthlyCost = monthlyKwh * pricePerKwh;
  const monthlyCo2Tonnes = (monthlyKwh * carbonKgPerKwh) / 1000;

  return { monthlyKwh, monthlyCost, monthlyCo2Tonnes, facilityKw };
}
