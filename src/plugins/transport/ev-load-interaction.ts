import type { PluginRegistration } from "../../plugin";
import type { Entity, SimulationContext } from "../../types";

export type EVLoadInteractionPluginOptions = {
  name?: string;
  version?: string;
  segmentField?: string;
  demandIncrementField?: string;
  evDemandField?: string;
  capacityStateKey?: string;
  loadStateKey?: string;
  evBaselineStateKey?: string;
  evDemandWeight?: number;
  strictMissingCapacity?: boolean;
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function resolveByYearAndSegment(
  source: unknown,
  year: number,
  segment: string,
): number | null {
  if (!source || typeof source !== "object") return null;

  const map = source as Record<string, any>;
  const yearly = map[String(year)];

  if (yearly && typeof yearly === "object") {
    const value = toNumber(yearly[segment], Number.NaN);
    if (Number.isFinite(value)) return value;
  }

  const flat = toNumber(map[segment], Number.NaN);
  if (Number.isFinite(flat)) return flat;

  return null;
}

export function createEVLoadInteractionPlugin(
  options: EVLoadInteractionPluginOptions = {},
): PluginRegistration {
  const name = options.name ?? "transport-ev-load-interaction";
  const version = options.version ?? "1.0.0";
  const segmentField = options.segmentField ?? "substationId";
  const demandIncrementField = options.demandIncrementField ?? "projectedDemandIncreaseKw";
  const evDemandField = options.evDemandField ?? "evChargingDemandKw";
  const capacityStateKey = options.capacityStateKey ?? "substationCapacities";
  const loadStateKey = options.loadStateKey ?? "substationLoads";
  const evBaselineStateKey = options.evBaselineStateKey ?? "evBaselineLoad";
  const evDemandWeight = options.evDemandWeight ?? 1;
  const strictMissingCapacity = options.strictMissingCapacity ?? true;

  const constraint = (entity: Entity, context: SimulationContext) => {
    const state = context.state as Record<string, any>;
    const year = context.year;

    const segmentRaw = (entity as any)?.[segmentField];
    const segment = segmentRaw === undefined || segmentRaw === null ? "" : String(segmentRaw);
    if (!segment) return false;

    const capacity = resolveByYearAndSegment(state[capacityStateKey], year, segment);
    if (capacity === null) {
      return !strictMissingCapacity;
    }

    const baseIncrement = toNumber((entity as any)?.[demandIncrementField], 0);
    const evDemand = toNumber((entity as any)?.[evDemandField], 0);
    const baselineEVLoad = toNumber(
      resolveByYearAndSegment(state[evBaselineStateKey], year, segment),
      0,
    );

    state[loadStateKey] = state[loadStateKey] ?? {};
    state[loadStateKey][year] = state[loadStateKey][year] ?? {};
    const currentLoad = toNumber(state[loadStateKey][year][segment], 0);

    const incrementalLoad = baseIncrement + evDemand * evDemandWeight;
    const projectedTotalLoad = currentLoad + incrementalLoad + baselineEVLoad;

    if (projectedTotalLoad <= capacity) {
      state[loadStateKey][year][segment] = currentLoad + incrementalLoad;
      return true;
    }

    return false;
  };

  return {
    manifest: {
      name,
      version,
      kind: ["constraint"],
      description: "Gates upgrades by combining baseline EV load and per-entity EV charging demand in capacity checks",
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