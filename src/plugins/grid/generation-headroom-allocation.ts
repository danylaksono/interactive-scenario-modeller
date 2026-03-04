import type { PluginRegistration } from "../../plugin";
import type { Entity, SimulationContext } from "../../types";

export type GenerationHeadroomAllocationPluginOptions = {
  name?: string;
  version?: string;
  substationIdField?: string;
  generationExportField?: string;
  headroomStateKey?: string;
  allocatedStateKey?: string;
  strictMissingHeadroom?: boolean;
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function resolveHeadroom(
  source: unknown,
  year: number,
  substationId: string,
): number | null {
  if (!source || typeof source !== "object") return null;

  const map = source as Record<string, any>;
  const yearly = map[String(year)];

  if (yearly && typeof yearly === "object") {
    const yearlyValue = toNumber(yearly[substationId], Number.NaN);
    if (Number.isFinite(yearlyValue)) return yearlyValue;
  }

  const flatValue = toNumber(map[substationId], Number.NaN);
  if (Number.isFinite(flatValue)) return flatValue;

  return null;
}

export function createGenerationHeadroomAllocationPlugin(
  options: GenerationHeadroomAllocationPluginOptions = {},
): PluginRegistration {
  const name = options.name ?? "grid-generation-headroom-allocation";
  const version = options.version ?? "1.0.0";
  const substationIdField = options.substationIdField ?? "substationId";
  const generationExportField = options.generationExportField ?? "generationExportKw";
  const headroomStateKey = options.headroomStateKey ?? "substationGenerationHeadroom";
  const allocatedStateKey = options.allocatedStateKey ?? "substationGenerationAllocated";
  const strictMissingHeadroom = options.strictMissingHeadroom ?? true;

  const constraint = (entity: Entity, context: SimulationContext) => {
    const state = context.state as Record<string, any>;
    const year = context.year;

    const substationIdRaw = (entity as any)?.[substationIdField];
    const substationId =
      substationIdRaw === undefined || substationIdRaw === null
        ? ""
        : String(substationIdRaw);

    if (!substationId) return false;

    const requestedExport = Math.max(0, toNumber((entity as any)?.[generationExportField], 0));
    const headroom = resolveHeadroom(state[headroomStateKey], year, substationId);

    if (headroom === null) {
      return !strictMissingHeadroom;
    }

    state[allocatedStateKey] = state[allocatedStateKey] ?? {};
    state[allocatedStateKey][year] = state[allocatedStateKey][year] ?? {};

    const allocated = Math.max(0, toNumber(state[allocatedStateKey][year][substationId], 0));
    const projected = allocated + requestedExport;

    if (projected <= headroom) {
      state[allocatedStateKey][year][substationId] = projected;
      return true;
    }

    return false;
  };

  return {
    manifest: {
      name,
      version,
      kind: ["constraint"],
      description: "Allocates substation generation headroom for utility-scale renewable exports",
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