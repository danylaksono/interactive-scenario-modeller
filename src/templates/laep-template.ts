import type { PropertySpec, SimulationContext } from "../types";
import { createScenarioTemplate, type ScenarioTemplate, type ScenarioTemplateOptions } from "./scenario-template";

export type LaepTemplateStateDefaults = {
  /** Active DFES (or other) scenario name for `createSubstationCapacityGatePlugin` */
  dfesActiveScenario?: string;
  /** Nested `Record<scenarioName, capacities>` — same inner shapes as `substationCapacities` */
  substationCapacitiesByScenario?: Record<string, Record<string, unknown>>;
  coBenefitsCoefficients?: Record<string, number>;
  defaultFlexibilityPeakReductionFraction?: number;
};

export type LaepTemplateOptions = ScenarioTemplateOptions & {
  laepStateDefaults?: LaepTemplateStateDefaults;
};

/**
 * Suggested columns for LAEP-style dashboards and GeoJSON exports.
 */
export function laepPropertySpec(): PropertySpec {
  return {
    columns: [
      "uprn",
      "id",
      "focusZoneId",
      "interventionType",
      "buildingArchetype",
      "capexGbp",
      "carbonSavingPotential",
      "noxReductionKg",
      "pm25ReductionKg",
      "fuelPovertyHouseholdLifts",
      "coBenefitsGbpTotal",
      "coBenefitsJobsFteEstimate",
      "heatDensityKwhPerM2",
      "notionalHeatNetworkCapexGbp",
      "effectiveProjectedDemandIncreaseKw",
      "substationId",
    ],
    metrics: [
      "coBenefitsGbpTotal",
      "notionalHeatNetworkCapexGbp",
      "heatDensityKwhPerM2",
      "carbonSavingPotential",
    ],
  };
}

function mergeLaepState(target: Record<string, any>, defaults: LaepTemplateStateDefaults) {
  if (defaults.dfesActiveScenario !== undefined && target.dfesActiveScenario === undefined) {
    target.dfesActiveScenario = defaults.dfesActiveScenario;
  }
  if (defaults.substationCapacitiesByScenario !== undefined && target.substationCapacitiesByScenario === undefined) {
    target.substationCapacitiesByScenario = { ...defaults.substationCapacitiesByScenario };
  }
  if (defaults.coBenefitsCoefficients !== undefined && target.coBenefitsCoefficients === undefined) {
    target.coBenefitsCoefficients = { ...defaults.coBenefitsCoefficients };
  }
  if (
    defaults.defaultFlexibilityPeakReductionFraction !== undefined &&
    target.defaultFlexibilityPeakReductionFraction === undefined
  ) {
    target.defaultFlexibilityPeakReductionFraction = defaults.defaultFlexibilityPeakReductionFraction;
  }
}

/**
 * Scenario template with LAEP-oriented defaults on `context.state`.
 */
export function createLaepTemplate(options: LaepTemplateOptions = {}): ScenarioTemplate {
  const base = createScenarioTemplate(options);
  const laepDefaults = options.laepStateDefaults ?? {};

  const init = (context: SimulationContext) => {
    base.init(context);
    mergeLaepState(context.state as Record<string, any>, laepDefaults);
  };

  const withInit = (afterInit?: (context: SimulationContext) => void) => {
    return (context: SimulationContext) => {
      init(context);
      afterInit?.(context);
    };
  };

  return {
    ...base,
    init,
    withInit,
  };
}
