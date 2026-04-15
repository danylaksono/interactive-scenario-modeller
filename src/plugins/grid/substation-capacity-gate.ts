import type { PluginRegistration } from "../../plugin";
import type { Entity, SimulationContext } from "../../types";

export type SubstationCapacityGatePluginOptions = {
  name?: string;
  version?: string;
  substationIdField?: string;
  demandIncrementField?: string;
  capacityStateKey?: string;
  loadStateKey?: string;
  strictMissingCapacity?: boolean;
  /**
   * When set with `capacityByScenarioKey`, resolves the capacity table from
   * `state[capacityByScenarioKey][String(state[activeScenarioKey])]` before
   * falling back to `capacityStateKey`. Supports DFES-style scenario tables.
   */
  activeScenarioKey?: string;
  /** Nested capacities keyed by scenario name, then the same shapes as `capacityStateKey`. */
  capacityByScenarioKey?: string;
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

function pickCapacityRoot(
  state: Record<string, any>,
  options: {
    capacityStateKey: string;
    activeScenarioKey?: string;
    capacityByScenarioKey?: string;
  },
): unknown {
  const scenarioKey = options.activeScenarioKey;
  const byScenarioKey = options.capacityByScenarioKey;
  if (scenarioKey && byScenarioKey) {
    const scenarioRaw = state[scenarioKey];
    const scenarioName = scenarioRaw === undefined || scenarioRaw === null ? "" : String(scenarioRaw);
    if (scenarioName) {
      const byScenario = state[byScenarioKey];
      if (byScenario && typeof byScenario === "object") {
        const table = (byScenario as Record<string, unknown>)[scenarioName];
        if (table !== undefined) return table;
      }
    }
  }
  return state[options.capacityStateKey];
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
  const activeScenarioKey = options.activeScenarioKey;
  const capacityByScenarioKey = options.capacityByScenarioKey;

  const constraint = (entity: Entity, context: SimulationContext) => {
    const state = context.state as Record<string, any>;
    const year = context.year;

    const substationIdRaw = (entity as any)?.[substationIdField];
    const substationId =
      substationIdRaw === undefined || substationIdRaw === null
        ? ""
        : String(substationIdRaw);

    if (!substationId) return false;

    const demandIncrement = toNumber((entity as any)?.[demandIncrementField], 0);

    const capacities = pickCapacityRoot(state, {
      capacityStateKey,
      activeScenarioKey,
      capacityByScenarioKey,
    });
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
