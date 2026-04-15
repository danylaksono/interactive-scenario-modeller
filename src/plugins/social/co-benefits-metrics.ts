import type { PluginRegistration } from "../../plugin";
import type { Entity, SimulationContext } from "../../types";

export type CoBenefitsCoefficients = {
  gbpPerFuelPovertyHouseholdLift?: number;
  gbpPerKgNoxReduced?: number;
  gbpPerKgPm25Reduced?: number;
  jobsFtePerMillionGbpCapex?: number;
};

export type CoBenefitsTrackerOptions = {
  name?: string;
  version?: string;
  coefficientsStateKey?: string;
  fuelPovertyLiftsField?: string;
  noxReductionKgField?: string;
  pm25ReductionKgField?: string;
  capexGbpField?: string;
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readCoefficients(state: Record<string, any>, key: string): CoBenefitsCoefficients {
  const raw = state[key];
  return raw && typeof raw === "object" ? (raw as CoBenefitsCoefficients) : {};
}

/**
 * Emits monetised co-benefit estimates from entity deltas and coefficients in `context.state`.
 * Coefficients are user-supplied (e.g. Green Book style shadow prices); none are hard-coded.
 */
export function createCoBenefitsTrackerPlugin(options: CoBenefitsTrackerOptions = {}): PluginRegistration {
  const name = options.name ?? "laep-co-benefits-tracker";
  const version = options.version ?? "1.0.0";
  const coefficientsStateKey = options.coefficientsStateKey ?? "coBenefitsCoefficients";
  const fuelPovertyLiftsField = options.fuelPovertyLiftsField ?? "fuelPovertyHouseholdLifts";
  const noxReductionKgField = options.noxReductionKgField ?? "noxReductionKg";
  const pm25ReductionKgField = options.pm25ReductionKgField ?? "pm25ReductionKg";
  const capexGbpField = options.capexGbpField ?? "capexGbp";

  const upgrade = (entity: Entity, context: SimulationContext) => {
    const coef = readCoefficients(context.state as Record<string, any>, coefficientsStateKey);
    const lifts = Math.max(0, toNumber((entity as any)?.[fuelPovertyLiftsField], 0));
    const nox = Math.max(0, toNumber((entity as any)?.[noxReductionKgField], 0));
    const pm25 = Math.max(0, toNumber((entity as any)?.[pm25ReductionKgField], 0));
    const capex = Math.max(0, toNumber((entity as any)?.[capexGbpField], 0));

    const gbpFuelPoverty = lifts * toNumber(coef.gbpPerFuelPovertyHouseholdLift, 0);
    const gbpNox = nox * toNumber(coef.gbpPerKgNoxReduced, 0);
    const gbpPm25 = pm25 * toNumber(coef.gbpPerKgPm25Reduced, 0);
    const gbpAirQuality = gbpNox + gbpPm25;
    const jobsFte = (capex / 1_000_000) * toNumber(coef.jobsFtePerMillionGbpCapex, 0);
    const gbpCoBenefitsTotal = gbpFuelPoverty + gbpAirQuality;

    return {
      coBenefitsGbpFuelPoverty: gbpFuelPoverty,
      coBenefitsGbpAirQuality: gbpAirQuality,
      coBenefitsGbpNoxComponent: gbpNox,
      coBenefitsGbpPm25Component: gbpPm25,
      coBenefitsGbpTotal: gbpCoBenefitsTotal,
      coBenefitsJobsFteEstimate: jobsFte,
      year: context.year,
    };
  };

  return {
    manifest: {
      name,
      version,
      kind: ["upgrade"],
      description: "Adds socio-economic co-benefit metrics from configurable coefficients and entity fields",
      entry: "internal:plugin",
      compat: { package: "interactive-scenario-modeller", minVersion: "0.1.0" },
      trusted: true,
      exports: { upgrade: "upgrade" },
    },
    upgrade,
  };
}
