import type { PluginRegistration } from "../../plugin";
import type { Entity, SimulationContext } from "../../types";

export type LoadProfileScoringOptions = {
  name?: string;
  version?: string;
  peakReductionField?: string;
  loadShiftField?: string;
  flexibilityField?: string;
  stateWeightsKey?: string;
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function createLoadProfileScoringPlugin(
  options: LoadProfileScoringOptions = {},
): PluginRegistration {
  const name = options.name ?? "timeseries-load-profile-scoring";
  const version = options.version ?? "1.0.0";
  const peakReductionField = options.peakReductionField ?? "peakReductionPotential";
  const loadShiftField = options.loadShiftField ?? "loadShiftPotential";
  const flexibilityField = options.flexibilityField ?? "flexibilityScore";
  const stateWeightsKey = options.stateWeightsKey ?? "loadProfileWeights";

  const prioritise = (a: Entity, b: Entity, context: SimulationContext) => {
    const weights = ((context.state as any)?.[stateWeightsKey] ?? {}) as {
      peakReduction?: number;
      loadShift?: number;
      flexibility?: number;
    };

    const peakWeight = toNumber(weights.peakReduction, 0.5);
    const loadShiftWeight = toNumber(weights.loadShift, 0.3);
    const flexibilityWeight = toNumber(weights.flexibility, 0.2);

    const score = (entity: Entity) =>
      toNumber((entity as any)?.[peakReductionField], 0) * peakWeight +
      toNumber((entity as any)?.[loadShiftField], 0) * loadShiftWeight +
      toNumber((entity as any)?.[flexibilityField], 0) * flexibilityWeight;

    return score(b) - score(a);
  };

  return {
    manifest: {
      name,
      version,
      kind: ["prioritiser"],
      description: "Ranks candidates by weighted load-profile contribution to peak reduction",
      entry: "internal:plugin",
      compat: {
        package: "interactive-scenario-modeller",
        minVersion: "0.1.0",
      },
      trusted: true,
      exports: {
        prioritise: "prioritise",
      },
    },
    prioritise,
  };
}
