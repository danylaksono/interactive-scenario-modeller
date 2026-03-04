import type { PluginRegistration } from "../../plugin";
import type { Entity, SimulationContext } from "../../types";

export type CostBenefitPrioritiserOptions = {
  name?: string;
  version?: string;
  benefitField?: string;
  costField?: string;
  stateWeightsKey?: string;
  fallbackCost?: number;
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function createCostBenefitPrioritiserPlugin(
  options: CostBenefitPrioritiserOptions = {},
): PluginRegistration {
  const name = options.name ?? "optimization-cost-benefit-prioritiser";
  const version = options.version ?? "1.0.0";
  const benefitField = options.benefitField ?? "carbonSavingPotential";
  const costField = options.costField ?? "estimatedPVCost";
  const stateWeightsKey = options.stateWeightsKey ?? "costBenefitWeights";
  const fallbackCost = options.fallbackCost ?? 1;

  const prioritise = (a: Entity, b: Entity, context: SimulationContext) => {
    const weights = ((context.state as any)?.[stateWeightsKey] ?? {}) as {
      benefit?: number;
      cost?: number;
    };

    const benefitWeight = toNumber(weights.benefit, 1);
    const costWeight = toNumber(weights.cost, 1);

    const aBenefit = toNumber((a as any)?.[benefitField], 0) * benefitWeight;
    const bBenefit = toNumber((b as any)?.[benefitField], 0) * benefitWeight;

    const aCost = Math.max(toNumber((a as any)?.[costField], fallbackCost), fallbackCost) * costWeight;
    const bCost = Math.max(toNumber((b as any)?.[costField], fallbackCost), fallbackCost) * costWeight;

    const aScore = aBenefit / aCost;
    const bScore = bBenefit / bCost;

    return bScore - aScore;
  };

  return {
    manifest: {
      name,
      version,
      kind: ["prioritiser"],
      description: "Ranks entities by weighted benefit-per-cost score",
      entry: "internal:plugin",
      compat: {
        package: "interactive-scenario-modeller",
        minVersion: "0.1.0",
      },
      trusted: true,
      exports: {
        prioritise: "prioritise",
      },
    },
    prioritise,
  };
}
