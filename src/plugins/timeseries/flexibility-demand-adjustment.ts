import type { PluginRegistration } from "../../plugin";
import type { Entity, SimulationContext } from "../../types";

export type FlexibilityDemandAdjustmentOptions = {
  name?: string;
  version?: string;
  /** Source kW field (e.g. projectedDemandIncreaseKw) */
  baseDemandField?: string;
  /** Written field for downstream constraints such as the substation gate */
  outputDemandField?: string;
  /** Per-entity flexibility fraction 0–1 reducing peak effective demand */
  flexibilityFractionField?: string;
  /** Optional: read default fraction from context.state[stateFlexibilityKey] */
  stateFlexibilityKey?: string;
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function clamp01(n: number) {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Side-effecting constraint that always returns true: copies a flexibility-adjusted
 * demand into `outputDemandField` so a substation gate using the same field name
 * can consume reduced effective kW. Compose with `combineConstraints` so this runs
 * before the capacity gate.
 */
export function createFlexibilityDemandAdjustmentPlugin(
  options: FlexibilityDemandAdjustmentOptions = {},
): PluginRegistration {
  const name = options.name ?? "laep-flexibility-demand-adjustment";
  const version = options.version ?? "1.0.0";
  const baseDemandField = options.baseDemandField ?? "projectedDemandIncreaseKw";
  const outputDemandField = options.outputDemandField ?? "effectiveProjectedDemandIncreaseKw";
  const flexibilityFractionField = options.flexibilityFractionField ?? "flexibilityPeakReductionFraction";
  const stateFlexibilityKey = options.stateFlexibilityKey ?? "defaultFlexibilityPeakReductionFraction";

  const constraint = (entity: Entity, context: SimulationContext) => {
    const base = Math.max(0, toNumber((entity as any)?.[baseDemandField], 0));
    const fromEntity = toNumber((entity as any)?.[flexibilityFractionField], Number.NaN);
    const fromState = toNumber((context.state as any)?.[stateFlexibilityKey], Number.NaN);
    const flex = clamp01(Number.isFinite(fromEntity) ? fromEntity : Number.isFinite(fromState) ? fromState : 0);
    (entity as any)[outputDemandField] = base * (1 - flex);
    return true;
  };

  return {
    manifest: {
      name,
      version,
      kind: ["constraint"],
      description:
        "Writes flexibility-adjusted demand on the entity for use by downstream grid constraints",
      entry: "internal:plugin",
      compat: { package: "interactive-scenario-modeller", minVersion: "0.1.0" },
      trusted: true,
      exports: { constraint: "constraint" },
    },
    constraint,
  };
}
