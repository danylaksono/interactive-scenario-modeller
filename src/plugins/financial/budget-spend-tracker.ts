import type { PluginRegistration } from "../../plugin";
import type { Entity, SimulationContext } from "../../types";

export type BudgetSpendTrackerOptions = {
  name?: string;
  version?: string;
  costField?: string;
  budgetSpentKey?: string;
  outputCostKey?: string;
  outputCumulativeCostKey?: string;
  outputYearKey?: string;
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function createBudgetSpendTrackerPlugin(
  options: BudgetSpendTrackerOptions = {},
): PluginRegistration {
  const name = options.name ?? "financial-budget-spend-tracker";
  const version = options.version ?? "1.0.0";
  const costField = options.costField ?? "estimatedPVCost";
  const budgetSpentKey = options.budgetSpentKey ?? "budgetSpent";
  const outputCostKey = options.outputCostKey ?? "cost";
  const outputCumulativeCostKey = options.outputCumulativeCostKey ?? "cumulativeCost";
  const outputYearKey = options.outputYearKey ?? "year";

  const upgrade = (entity: Entity, context: SimulationContext) => {
    const year = context.year;
    const cost = toNumber((entity as any)?.[costField], 0);

    const state = context.state as Record<string, any>;
    const budgetSpent =
      state[budgetSpentKey] && typeof state[budgetSpentKey] === "object"
        ? state[budgetSpentKey]
        : {};

    const previous = toNumber(budgetSpent[year], 0);
    const cumulativeCost = previous + cost;
    budgetSpent[year] = cumulativeCost;
    state[budgetSpentKey] = budgetSpent;

    return {
      [outputCostKey]: cost,
      [outputCumulativeCostKey]: cumulativeCost,
      [outputYearKey]: year,
    };
  };

  return {
    manifest: {
      name,
      version,
      kind: ["upgrade"],
      description: "Tracks and updates yearly budget spend during upgrades",
      entry: "internal:plugin",
      compat: {
        package: "interactive-scenario-modeller",
        minVersion: "0.1.0",
      },
      trusted: true,
      exports: {
        upgrade: "upgrade",
      },
    },
    upgrade,
  };
}
