import type { PluginRegistration } from "../../plugin";
import type { Building, SimulationContext } from "../../types";

export type RegionBudgetSplitOptions = {
  name?: string;
  version?: string;
  regionField?: string;
  costField?: string;
  allocationStateKey?: string;
  spentStateKey?: string;
  strictMissingBudget?: boolean;
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function resolveRegionBudget(
  allocation: unknown,
  year: number,
  region: string,
): number | null {
  if (!allocation || typeof allocation !== "object") return null;

  const bucket = allocation as Record<string, any>;
  const yearBucket = bucket[String(year)];

  if (yearBucket && typeof yearBucket === "object") {
    const yearBudget = toNumber(yearBucket[region], Number.NaN);
    if (Number.isFinite(yearBudget)) return yearBudget;
  }

  const flatBudget = toNumber(bucket[region], Number.NaN);
  if (Number.isFinite(flatBudget)) return flatBudget;

  return null;
}

export function createRegionBudgetSplitPlugin(
  options: RegionBudgetSplitOptions = {},
): PluginRegistration {
  const name = options.name ?? "geographic-region-budget-split";
  const version = options.version ?? "1.0.0";
  const regionField = options.regionField ?? "regionCode";
  const costField = options.costField ?? "estimatedPVCost";
  const allocationStateKey = options.allocationStateKey ?? "regionBudgetAllocation";
  const spentStateKey = options.spentStateKey ?? "regionBudgetSpent";
  const strictMissingBudget = options.strictMissingBudget ?? true;

  const constraint = (building: Building, context: SimulationContext) => {
    const state = context.state as Record<string, any>;
    const year = context.year;
    const reservedKey = `__reservedRegionBudget_${name}`;

    const regionRaw = (building as any)?.[regionField];
    const region = regionRaw === undefined || regionRaw === null ? "" : String(regionRaw);
    if (!region) return false;

    const allocation = state[allocationStateKey];
    const budget = resolveRegionBudget(allocation, year, region);
    if (budget === null) return !strictMissingBudget;

    const cost = Math.max(0, toNumber((building as any)?.[costField], 0));

    const spentBucket = (state[spentStateKey] ?? {}) as Record<string, any>;
    const spent = toNumber(spentBucket?.[year]?.[region], 0);

    state[reservedKey] = state[reservedKey] ?? {};
    state[reservedKey][year] = state[reservedKey][year] ?? {};
    const reserved = toNumber(state[reservedKey][year][region], 0);

    const projected = spent + reserved + cost;
    if (projected > budget) return false;

    state[reservedKey][year][region] = reserved + cost;
    return true;
  };

  return {
    manifest: {
      name,
      version,
      kind: ["constraint"],
      description: "Enforces per-region budget envelopes with yearly and flat allocation support",
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
