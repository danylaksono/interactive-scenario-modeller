import type { PluginRegistration } from "../../plugin";
import type { Building, SimulationContext } from "../../types";

export type SpatialClusterPrioritiserOptions = {
  name?: string;
  version?: string;
  clusterDensityField?: string;
  infrastructureEfficiencyField?: string;
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

export function createSpatialClusterPrioritiserPlugin(
  options: SpatialClusterPrioritiserOptions = {},
): PluginRegistration {
  const name = options.name ?? "geographic-spatial-cluster-prioritiser";
  const version = options.version ?? "1.0.0";
  const clusterDensityField = options.clusterDensityField ?? "clusterDensity";
  const infrastructureEfficiencyField = options.infrastructureEfficiencyField ?? "infrastructureEfficiency";
  const stateWeightsKey = options.stateWeightsKey ?? "spatialClusterWeights";

  const prioritise = (a: Building, b: Building, context: SimulationContext) => {
    const weights = ((context.state as any)?.[stateWeightsKey] ?? {}) as {
      clusterDensity?: number;
      infrastructureEfficiency?: number;
    };

    const densityWeight = toNumber(weights.clusterDensity, 0.7);
    const efficiencyWeight = toNumber(weights.infrastructureEfficiency, 0.3);

    const aScore =
      toNumber((a as any)?.[clusterDensityField], 0) * densityWeight +
      toNumber((a as any)?.[infrastructureEfficiencyField], 0) * efficiencyWeight;
    const bScore =
      toNumber((b as any)?.[clusterDensityField], 0) * densityWeight +
      toNumber((b as any)?.[infrastructureEfficiencyField], 0) * efficiencyWeight;

    return bScore - aScore;
  };

  return {
    manifest: {
      name,
      version,
      kind: ["prioritiser"],
      description: "Prioritises buildings by spatial clustering and infrastructure efficiency",
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
