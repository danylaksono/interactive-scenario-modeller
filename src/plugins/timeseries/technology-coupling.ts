import type { PluginRegistration } from "../../plugin";
import type { Entity, SimulationContext } from "../../types";

export type TechnologyCouplingOptions = {
  name?: string;
  version?: string;
  demandField?: string;
  carbonField?: string;
  batteryField?: string;
  heatPumpField?: string;
  couplingStateKey?: string;
  outputAdjustedDemandKey?: string;
  outputAdjustedCarbonKey?: string;
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function createTechnologyCouplingPlugin(
  options: TechnologyCouplingOptions = {},
): PluginRegistration {
  const name = options.name ?? "timeseries-technology-coupling";
  const version = options.version ?? "1.0.0";

  const demandField = options.demandField ?? "projectedDemandIncreaseKw";
  const carbonField = options.carbonField ?? "carbonSavingPotential";
  const batteryField = options.batteryField ?? "batteryAdoptionRate";
  const heatPumpField = options.heatPumpField ?? "heatPumpAdoptionRate";

  const couplingStateKey = options.couplingStateKey ?? "technologyCoupling";
  const outputAdjustedDemandKey = options.outputAdjustedDemandKey ?? "adjustedDemandIncreaseKw";
  const outputAdjustedCarbonKey = options.outputAdjustedCarbonKey ?? "adjustedCarbonSavingPotential";

  const upgrade = (entity: Entity, context: SimulationContext) => {
    const baseDemand = toNumber((entity as any)?.[demandField], 0);
    const baseCarbon = toNumber((entity as any)?.[carbonField], 0);

    const couplingState = ((context.state as any)?.[couplingStateKey] ?? {}) as {
      batteryDemandReductionFactor?: number;
      heatPumpDemandIncreaseFactor?: number;
      batteryCarbonBoostFactor?: number;
      heatPumpCarbonPenaltyFactor?: number;
      batteryAdoptionRate?: number;
      heatPumpAdoptionRate?: number;
    };

    const batteryAdoption = Math.min(
      1,
      Math.max(
        0,
        toNumber((entity as any)?.[batteryField], toNumber(couplingState.batteryAdoptionRate, 0)),
      ),
    );

    const heatPumpAdoption = Math.min(
      1,
      Math.max(
        0,
        toNumber((entity as any)?.[heatPumpField], toNumber(couplingState.heatPumpAdoptionRate, 0)),
      ),
    );

    const batteryDemandReductionFactor = toNumber(couplingState.batteryDemandReductionFactor, 0.25);
    const heatPumpDemandIncreaseFactor = toNumber(couplingState.heatPumpDemandIncreaseFactor, 0.35);
    const batteryCarbonBoostFactor = toNumber(couplingState.batteryCarbonBoostFactor, 0.1);
    const heatPumpCarbonPenaltyFactor = toNumber(couplingState.heatPumpCarbonPenaltyFactor, 0.05);

    const adjustedDemand =
      baseDemand * (1 - batteryAdoption * batteryDemandReductionFactor + heatPumpAdoption * heatPumpDemandIncreaseFactor);

    const adjustedCarbon =
      baseCarbon * (1 + batteryAdoption * batteryCarbonBoostFactor - heatPumpAdoption * heatPumpCarbonPenaltyFactor);

    return {
      [outputAdjustedDemandKey]: adjustedDemand,
      [outputAdjustedCarbonKey]: adjustedCarbon,
      batteryAdoption,
      heatPumpAdoption,
      year: context.year,
    };
  };

  return {
    manifest: {
      name,
      version,
      kind: ["upgrade"],
      description: "Adjusts demand and carbon effects based on battery and heat-pump coupling assumptions",
      entry: "internal:plugin",
      compat: {
        package: "interactive-scenario-modeller",
        minVersion: "0.1.0",
      },
      trusted: true,
      exports: {
        upgrade: "upgrade",
      },
    },
    upgrade,
  };
}
