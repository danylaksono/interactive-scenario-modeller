import type { PluginRegistration } from "../../plugin";
import type { Building, SimulationContext } from "../../types";

export type TransportCorridorConstraintOptions = {
  name?: string;
  version?: string;
  corridorField?: string;
  deliveredUnitsField?: string;
  requirementsStateKey?: string;
  deliveredStateKey?: string;
  maxOverbuildFactor?: number;
  strictMissingRequirement?: boolean;
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function resolveByYearAndCorridor(
  source: unknown,
  year: number,
  corridor: string,
): number | null {
  if (!source || typeof source !== "object") return null;
  const map = source as Record<string, any>;
  const yearly = map[String(year)];

  if (yearly && typeof yearly === "object") {
    const yearlyValue = toNumber(yearly[corridor], Number.NaN);
    if (Number.isFinite(yearlyValue)) return yearlyValue;
  }

  const flatValue = toNumber(map[corridor], Number.NaN);
  if (Number.isFinite(flatValue)) return flatValue;

  return null;
}

export function createTransportCorridorConstraintPlugin(
  options: TransportCorridorConstraintOptions = {},
): PluginRegistration {
  const name = options.name ?? "transport-corridor-constraint";
  const version = options.version ?? "1.0.0";
  const corridorField = options.corridorField ?? "transportCorridorId";
  const deliveredUnitsField = options.deliveredUnitsField ?? "chargingPointsProvided";
  const requirementsStateKey = options.requirementsStateKey ?? "corridorChargingRequirements";
  const deliveredStateKey = options.deliveredStateKey ?? "corridorChargingDelivered";
  const maxOverbuildFactor = options.maxOverbuildFactor ?? 1;
  const strictMissingRequirement = options.strictMissingRequirement ?? false;

  const constraint = (building: Building, context: SimulationContext) => {
    const state = context.state as Record<string, any>;
    const year = context.year;

    const corridorRaw = (building as any)?.[corridorField];
    const corridor = corridorRaw === undefined || corridorRaw === null ? "" : String(corridorRaw);
    if (!corridor) return false;

    const requiredUnits = resolveByYearAndCorridor(state[requirementsStateKey], year, corridor);
    if (requiredUnits === null) return !strictMissingRequirement;

    const safeRequired = Math.max(0, requiredUnits);
    const maxAllowed = safeRequired * Math.max(0, maxOverbuildFactor);
    const deliveredIncrement = Math.max(0, toNumber((building as any)?.[deliveredUnitsField], 1));

    state[deliveredStateKey] = state[deliveredStateKey] ?? {};
    state[deliveredStateKey][year] = state[deliveredStateKey][year] ?? {};

    const currentDelivered = Math.max(0, toNumber(state[deliveredStateKey][year][corridor], 0));
    const projectedDelivered = currentDelivered + deliveredIncrement;

    if (projectedDelivered <= maxAllowed) {
      state[deliveredStateKey][year][corridor] = projectedDelivered;
      return true;
    }

    return false;
  };

  return {
    manifest: {
      name,
      version,
      kind: ["constraint"],
      description: "Constrains upgrades by transport-corridor charging delivery requirements",
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