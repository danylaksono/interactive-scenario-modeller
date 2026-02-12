import type { PluginRegistration } from "../../plugin";
import type { Building, SimulationContext } from "../../types";

export type SeasonalDemandGateOptions = {
  name?: string;
  version?: string;
  seasonField?: string;
  seasonStateKey?: string;
  segmentField?: string;
  demandIncrementField?: string;
  capacityStateKey?: string;
  loadStateKey?: string;
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

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolveSeason(
  building: Building,
  context: SimulationContext,
  seasonField: string,
  seasonStateKey: string,
): string {
  const stateSeason = (context.state as any)?.[seasonStateKey]?.[context.year];
  const buildingSeason = (building as any)?.[seasonField];

  return normalizeText(stateSeason) || normalizeText(buildingSeason) || "all";
}

function resolveCapacity(
  capacities: unknown,
  year: number,
  season: string,
  segment: string,
): number | null {
  if (!capacities || typeof capacities !== "object") return null;

  const root = capacities as Record<string, any>;

  const yearSeasonSegment = toNumber(root?.[String(year)]?.[season]?.[segment], Number.NaN);
  if (Number.isFinite(yearSeasonSegment)) return yearSeasonSegment;

  const seasonSegment = toNumber(root?.[season]?.[segment], Number.NaN);
  if (Number.isFinite(seasonSegment)) return seasonSegment;

  const segmentOnly = toNumber(root?.[segment], Number.NaN);
  if (Number.isFinite(segmentOnly)) return segmentOnly;

  return null;
}

export function createSeasonalDemandGatePlugin(
  options: SeasonalDemandGateOptions = {},
): PluginRegistration {
  const name = options.name ?? "timeseries-seasonal-demand-gate";
  const version = options.version ?? "1.0.0";
  const seasonField = options.seasonField ?? "season";
  const seasonStateKey = options.seasonStateKey ?? "seasonByYear";
  const segmentField = options.segmentField ?? "substationId";
  const demandIncrementField = options.demandIncrementField ?? "projectedDemandIncreaseKw";
  const capacityStateKey = options.capacityStateKey ?? "seasonalDemandCapacity";
  const loadStateKey = options.loadStateKey ?? "seasonalDemandLoad";
  const strictMissingCapacity = options.strictMissingCapacity ?? true;

  const constraint = (building: Building, context: SimulationContext) => {
    const state = context.state as Record<string, any>;
    const year = context.year;

    const season = resolveSeason(building, context, seasonField, seasonStateKey);
    const segmentRaw = (building as any)?.[segmentField];
    const segment =
      segmentRaw === undefined || segmentRaw === null ? "" : String(segmentRaw);
    if (!segment) return false;

    const demandIncrement = Math.max(0, toNumber((building as any)?.[demandIncrementField], 0));
    const capacity = resolveCapacity(state[capacityStateKey], year, season, segment);

    if (capacity === null) {
      return !strictMissingCapacity;
    }

    state[loadStateKey] = state[loadStateKey] ?? {};
    state[loadStateKey][year] = state[loadStateKey][year] ?? {};
    state[loadStateKey][year][season] = state[loadStateKey][year][season] ?? {};

    const currentLoad = toNumber(state[loadStateKey][year][season][segment], 0);
    const projectedLoad = currentLoad + demandIncrement;

    if (projectedLoad <= capacity) {
      state[loadStateKey][year][season][segment] = projectedLoad;
      return true;
    }

    return false;
  };

  return {
    manifest: {
      name,
      version,
      kind: ["constraint"],
      description: "Applies seasonal demand/capacity gate with year-season-segment tracking",
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
