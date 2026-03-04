import type { PluginRegistration } from "../../plugin";
import type { Entity, SimulationContext } from "../../types";

export type UrbanRuralStrategyOptions = {
  name?: string;
  version?: string;
  areaTypeField?: string;
  stateConfigKey?: string;
  allowedAreaTypes?: string[];
  preferAreaType?: "urban" | "rural";
};

function normalizeAreaType(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function createUrbanRuralStrategyPlugin(
  options: UrbanRuralStrategyOptions = {},
): PluginRegistration {
  const name = options.name ?? "geographic-urban-rural-strategy";
  const version = options.version ?? "1.0.0";
  const areaTypeField = options.areaTypeField ?? "areaType";
  const stateConfigKey = options.stateConfigKey ?? "urbanRuralStrategy";
  const defaultAllowed = (options.allowedAreaTypes ?? ["urban", "rural"]).map((item) =>
    normalizeAreaType(item),
  );
  const defaultPreferred = options.preferAreaType ? normalizeAreaType(options.preferAreaType) : "";

  const constraint = (entity: Entity, context: SimulationContext) => {
    const stateConfig = ((context.state as any)?.[stateConfigKey] ?? {}) as {
      allowedAreaTypes?: string[];
    };

    const areaType = normalizeAreaType((entity as any)?.[areaTypeField]);
    if (!areaType) return false;

    const allowed = (stateConfig.allowedAreaTypes ?? defaultAllowed).map((item) => normalizeAreaType(item));
    return allowed.includes(areaType);
  };

  const prioritise = (a: Entity, b: Entity, context: SimulationContext) => {
    const stateConfig = ((context.state as any)?.[stateConfigKey] ?? {}) as {
      preferAreaType?: string;
    };

    const preferred = normalizeAreaType(stateConfig.preferAreaType ?? defaultPreferred);
    if (!preferred) return 0;

    const aPreferred = normalizeAreaType((a as any)?.[areaTypeField]) === preferred ? 1 : 0;
    const bPreferred = normalizeAreaType((b as any)?.[areaTypeField]) === preferred ? 1 : 0;

    return bPreferred - aPreferred;
  };

  return {
    manifest: {
      name,
      version,
      kind: ["constraint", "prioritiser"],
      description: "Applies urban/rural strategy as eligibility filter and preference ordering",
      entry: "internal:plugin",
      compat: {
        package: "interactive-scenario-modeller",
        minVersion: "0.1.0",
      },
      trusted: true,
      exports: {
        constraint: "constraint",
        prioritise: "prioritise",
      },
    },
    constraint,
    prioritise,
  };
}
