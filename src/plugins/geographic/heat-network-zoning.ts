import type { PluginRegistration } from "../../plugin";
import type { Entity, SimulationContext } from "../../types";

export type HeatNetworkEconomicsOptions = {
  name?: string;
  version?: string;
  annualHeatDemandKwhField?: string;
  floorAreaM2Field?: string;
  clusterFootprintM2Field?: string;
  /** When set, overrides heuristic pipe length (km) */
  linearNetworkKmField?: string;
  trenchingCostGbpPerKm?: number;
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Prioritises by heat density (kWh/m²) and upgrades with notional network length / capex
 * for comparing district heat clusters to distributed options (approximation only).
 */
export function createHeatNetworkEconomicsPlugin(options: HeatNetworkEconomicsOptions = {}): PluginRegistration {
  const name = options.name ?? "laep-heat-network-economics";
  const version = options.version ?? "1.0.0";
  const annualHeatDemandKwhField = options.annualHeatDemandKwhField ?? "annualHeatDemandKwh";
  const floorAreaM2Field = options.floorAreaM2Field ?? "floorAreaM2";
  const clusterFootprintM2Field = options.clusterFootprintM2Field ?? "clusterFootprintM2";
  const linearNetworkKmField = options.linearNetworkKmField ?? "clusterLinearNetworkKm";
  const trenchingCostGbpPerKm = options.trenchingCostGbpPerKm ?? 750_000;

  const heatDensity = (entity: Entity) => {
    const demand = Math.max(0, toNumber((entity as any)?.[annualHeatDemandKwhField], 0));
    const area = Math.max(1, toNumber((entity as any)?.[floorAreaM2Field], 1));
    return demand / area;
  };

  const prioritise = (a: Entity, b: Entity, _context: SimulationContext) => heatDensity(b) - heatDensity(a);

  const upgrade = (entity: Entity, context: SimulationContext) => {
    const density = heatDensity(entity);
    const footprint = Math.max(0, toNumber((entity as any)?.[clusterFootprintM2Field], 0));
    const explicitKm = toNumber((entity as any)?.[linearNetworkKmField], Number.NaN);
    const heuristicKm =
      footprint > 0 ? (2 * Math.sqrt(footprint)) / 1000 : density > 0 ? Math.sqrt(density) / 50 : 0;
    const notionalPipeKm = Number.isFinite(explicitKm) ? explicitKm : heuristicKm;
    const notionalHeatNetworkCapexGbp = Math.max(0, notionalPipeKm * trenchingCostGbpPerKm);

    return {
      heatDensityKwhPerM2: density,
      notionalPipeKm,
      notionalHeatNetworkCapexGbp,
      year: context.year,
    };
  };

  return {
    manifest: {
      name,
      version,
      kind: ["prioritiser", "upgrade"],
      description: "Ranks entities by heat density and estimates notional heat network pipe capex",
      entry: "internal:plugin",
      compat: { package: "interactive-scenario-modeller", minVersion: "0.1.0" },
      trusted: true,
      exports: { prioritise: "prioritise", upgrade: "upgrade" },
    },
    prioritise,
    upgrade,
  };
}
