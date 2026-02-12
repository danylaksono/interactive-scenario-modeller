import type { PluginRegistration } from "../../plugin";
import type { Building, SimulationContext } from "../../types";

export type FuelPovertyPriorityWeights = {
  fuelPovertyScore?: number;
  carbonSavingPotential?: number;
};

export type FuelPovertyPriorityPluginOptions = {
  name?: string;
  version?: string;
  weights?: FuelPovertyPriorityWeights;
  threshold?: number;
  fuelPovertyField?: string;
  carbonField?: string;
  stateConfigKey?: string;
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function createFuelPovertyPriorityPlugin(
  options: FuelPovertyPriorityPluginOptions = {},
): PluginRegistration {
  const name = options.name ?? "social-fuel-poverty-priority";
  const version = options.version ?? "1.0.0";
  const fuelPovertyField = options.fuelPovertyField ?? "fuelPovertyScore";
  const carbonField = options.carbonField ?? "carbonSavingPotential";
  const stateConfigKey = options.stateConfigKey ?? "fuelPovertyPriority";

  const defaultWeights: Required<FuelPovertyPriorityWeights> = {
    fuelPovertyScore: 0.6,
    carbonSavingPotential: 0.4,
    ...(options.weights ?? {}),
  };

  const defaultThreshold = toNumber(options.threshold, 0.5);

  const constraint = (building: Building, context: SimulationContext) => {
    const stateConfig = ((context.state as any)?.[stateConfigKey] ?? {}) as {
      weights?: FuelPovertyPriorityWeights;
      threshold?: number;
    };

    const weights: Required<FuelPovertyPriorityWeights> = {
      ...defaultWeights,
      ...(stateConfig.weights ?? {}),
    };

    const threshold = toNumber(stateConfig.threshold, defaultThreshold);

    const fuelPovertyScore = toNumber((building as any)?.[fuelPovertyField], 0);
    const carbonSavingPotential = toNumber((building as any)?.[carbonField], 0);

    const score =
      fuelPovertyScore * weights.fuelPovertyScore +
      carbonSavingPotential * weights.carbonSavingPotential;

    return score >= threshold;
  };

  return {
    manifest: {
      name,
      version,
      kind: ["constraint"],
      description:
        "Prioritizes buildings using a weighted fuel-poverty and carbon-savings score",
      entry: "internal:plugin",
      compat: {
        package: "interactive-scenario-modeller",
        minVersion: "0.1.0",
      },
      trusted: true,
      exports: {
        constraint: "constraint",
      },
    },
    constraint,
  };
}
