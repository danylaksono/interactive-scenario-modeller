import type { PluginRegistration } from "../../plugin";
import type { Building, SimulationContext } from "../../types";

export type SubstationCapacityGatePluginOptions = {
  name?: string;
  version?: string;
  substationIdField?: string;
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

function resolveCapacity(
  capacities: unknown,
  year: number,
  substationId: string,
): number | null {
  if (!capacities || typeof capacities !== "object") return null;

  const capObj = capacities as Record<string, any>;
  const yearBucket = capObj[String(year)];

  if (yearBucket && typeof yearBucket === "object") {
    const yearlyCapacity = toNumber(yearBucket[substationId], Number.NaN);
    if (Number.isFinite(yearlyCapacity)) return yearlyCapacity;
  }

  const flatCapacity = toNumber(capObj[substationId], Number.NaN);
  if (Number.isFinite(flatCapacity)) return flatCapacity;

  return null;
}

export function createSubstationCapacityGatePlugin(
  options: SubstationCapacityGatePluginOptions = {},
): PluginRegistration {
  const name = options.name ?? "grid-substation-capacity-gate";
  const version = options.version ?? "1.0.0";
  const substationIdField = options.substationIdField ?? "substationId";
  const demandIncrementField = options.demandIncrementField ?? "projectedDemandIncreaseKw";
  const capacityStateKey = options.capacityStateKey ?? "substationCapacities";
  const loadStateKey = options.loadStateKey ?? "substationLoads";
  const strictMissingCapacity = options.strictMissingCapacity ?? true;

  const constraint = (building: Building, context: SimulationContext) => {
    const state = context.state as Record<string, any>;
    const year = context.year;

    const substationIdRaw = (building as any)?.[substationIdField];
    const substationId =
      substationIdRaw === undefined || substationIdRaw === null
        ? ""
        : String(substationIdRaw);

    if (!substationId) return false;

    const demandIncrement = toNumber((building as any)?.[demandIncrementField], 0);

    const capacities = state[capacityStateKey];
    const capacity = resolveCapacity(capacities, year, substationId);

    if (capacity === null) {
      return !strictMissingCapacity;
    }

    state[loadStateKey] = state[loadStateKey] ?? {};
    state[loadStateKey][year] = state[loadStateKey][year] ?? {};

    const currentLoad = toNumber(state[loadStateKey][year][substationId], 0);
    const projectedLoad = currentLoad + demandIncrement;

    if (projectedLoad <= capacity) {
      state[loadStateKey][year][substationId] = projectedLoad;
      return true;
    }

    return false;
  };

  return {
    manifest: {
      name,
      version,
      kind: ["constraint"],
      description: "Blocks upgrades when projected substation load exceeds configured capacity",
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
