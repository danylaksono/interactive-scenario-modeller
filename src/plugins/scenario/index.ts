import { registerPlugin, type PluginRegistration } from "../../plugin";
import type { Building, SimulationContext } from "../../types";

export type ScenarioPluginObjectiveWeights = {
  carbonSavingPotential?: number;
  fuelPovertyScore?: number;
  gridCapacityEfficiency?: number;
  communityImpact?: number;
};

export type ScenarioPluginPolicy = {
  enabledBuildingTypes?: string[];
  minEfficiencyStandard?: number;
};

export type ScenarioPluginPackOptions = {
  namespace: string;
  defaultBudgetAllocation?: Record<number, number>;
  defaultPolicyTimeline?: Record<number, ScenarioPluginPolicy>;
  defaultMinScoreThreshold?: number;
  defaultObjectiveWeights?: ScenarioPluginObjectiveWeights;
};

export type ScenarioPluginPack = {
  plugins: PluginRegistration[];
  predicates: {
    budgetConstraint: (building: Building, context: SimulationContext) => boolean;
    planningConstraint: (building: Building, context: SimulationContext) => boolean;
    phasedRollout: (building: Building, context: SimulationContext) => boolean;
    multiObjectivePrioritization: (building: Building, context: SimulationContext) => boolean;
    multiObjectivePrioritiser: (a: Building, b: Building, context: SimulationContext) => number;
    policyEvolution: (building: Building, context: SimulationContext) => boolean;
  };
  register: (plugin: PluginRegistration) => void;
};

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

export function createScenarioPluginPack(
  options: ScenarioPluginPackOptions,
): ScenarioPluginPack {
  const {
    namespace,
    defaultBudgetAllocation,
    defaultPolicyTimeline,
    defaultMinScoreThreshold,
    defaultObjectiveWeights,
  } = options;

  const planningConstraint = (building: Building, context: SimulationContext) => {
    const listedStatus = (building as any)?.listedStatus;
    const conservationArea = Boolean((building as any)?.conservationArea);
    if (conservationArea && listedStatus === "Grade II*") return false;
    if (conservationArea && context.year < 2025) return false;
    return true;
  };

  const budgetConstraint = (building: Building, context: SimulationContext) => {
    const allocation = context.state.budgetAllocation ?? defaultBudgetAllocation ?? {};
    const spent = context.state.budgetSpent ?? {};
    const yearlyBudget = toNumber(allocation[context.year], 0);
    const spentBudget = toNumber(spent[context.year], 0);
    const buildingCost = toNumber((building as any)?.estimatedPVCost, 0);
    return spentBudget + buildingCost <= yearlyBudget;
  };

  const phasedRollout = (building: Building, context: SimulationContext) => {
    const phaseByYear = context.state.phaseByYear ?? {};
    const startYear =
      typeof context.state.phaseStartYear === "number"
        ? context.state.phaseStartYear
        : context.year;

    const currentPhase =
      typeof phaseByYear[context.year] === "number"
        ? phaseByYear[context.year]
        : Math.max(1, context.year - startYear + 1);

    const priorityZone = toNumber((building as any)?.priorityZone, Number.MAX_SAFE_INTEGER);
    return priorityZone <= currentPhase;
  };

  const multiObjectivePrioritiser = (a: Building, b: Building, context: SimulationContext) => {
    const defaults: Required<ScenarioPluginObjectiveWeights> = {
      carbonSavingPotential: 0.4,
      fuelPovertyScore: 0.3,
      gridCapacityEfficiency: 0.2,
      communityImpact: 0.1,
    };

    const weights: Required<ScenarioPluginObjectiveWeights> = {
      ...defaults,
      ...(defaultObjectiveWeights ?? {}),
      ...(context.state.objectiveWeights ?? {}),
    };

    const getScore = (building: Building) =>
      toNumber((building as any)?.carbonSavingPotential) * weights.carbonSavingPotential +
      toNumber((building as any)?.fuelPovertyScore) * weights.fuelPovertyScore +
      toNumber((building as any)?.gridCapacityEfficiency) * weights.gridCapacityEfficiency +
      toNumber((building as any)?.communityImpact) * weights.communityImpact;

    return getScore(b) - getScore(a);
  };

  const multiObjectivePrioritization = (building: Building, context: SimulationContext) => {
    const defaults: Required<ScenarioPluginObjectiveWeights> = {
      carbonSavingPotential: 0.4,
      fuelPovertyScore: 0.3,
      gridCapacityEfficiency: 0.2,
      communityImpact: 0.1,
    };

    const weights: Required<ScenarioPluginObjectiveWeights> = {
      ...defaults,
      ...(defaultObjectiveWeights ?? {}),
      ...(context.state.objectiveWeights ?? {}),
    };

    const score =
      toNumber((building as any)?.carbonSavingPotential) * weights.carbonSavingPotential +
      toNumber((building as any)?.fuelPovertyScore) * weights.fuelPovertyScore +
      toNumber((building as any)?.gridCapacityEfficiency) * weights.gridCapacityEfficiency +
      toNumber((building as any)?.communityImpact) * weights.communityImpact;

    const minScoreThreshold = toNumber(
      context.state.minScoreThreshold,
      defaultMinScoreThreshold ?? 0,
    );

    return score >= minScoreThreshold;
  };

  const policyEvolution = (building: Building, context: SimulationContext) => {
    const activePolicies = context.state.activePolicies ?? defaultPolicyTimeline ?? {};
    const policies = activePolicies[context.year];

    if (!policies) return true;

    if (
      Array.isArray(policies.enabledBuildingTypes) &&
      !policies.enabledBuildingTypes.includes((building as any)?.type)
    ) {
      return false;
    }

    if (typeof policies.minEfficiencyStandard === "number") {
      return toNumber((building as any)?.efficiencyRating, -Infinity) >= policies.minEfficiencyStandard;
    }

    return true;
  };

  const plugins: PluginRegistration[] = [
    {
      manifest: {
        name: `${namespace}-budget-constraint`,
        version: "1.0.0",
        kind: ["constraint"],
        description: "Built-in budget constraint plugin",
        entry: "internal:preset",
        compat: { package: "interactive-scenario-modeller", minVersion: "0.1.0" },
        trusted: true,
      },
      constraint: budgetConstraint,
    },
    {
      manifest: {
        name: `${namespace}-planning-constraint`,
        version: "1.0.0",
        kind: ["constraint"],
        description: "Built-in planning constraint plugin",
        entry: "internal:preset",
        compat: { package: "interactive-scenario-modeller", minVersion: "0.1.0" },
        trusted: true,
      },
      constraint: planningConstraint,
    },
    {
      manifest: {
        name: `${namespace}-phased-rollout`,
        version: "1.0.0",
        kind: ["constraint"],
        description: "Built-in phased rollout plugin",
        entry: "internal:preset",
        compat: { package: "interactive-scenario-modeller", minVersion: "0.1.0" },
        trusted: true,
      },
      constraint: phasedRollout,
    },
    {
      manifest: {
        name: `${namespace}-multi-objective`,
        version: "1.0.0",
        kind: ["constraint", "prioritiser"],
        description: "Built-in multi-objective prioritization and filtering plugin",
        entry: "internal:preset",
        compat: { package: "interactive-scenario-modeller", minVersion: "0.1.0" },
        trusted: true,
        exports: {
          constraint: "constraint",
          prioritise: "prioritise",
        },
      },
      constraint: multiObjectivePrioritization,
      prioritise: multiObjectivePrioritiser,
    },
    {
      manifest: {
        name: `${namespace}-policy-evolution`,
        version: "1.0.0",
        kind: ["constraint"],
        description: "Built-in policy evolution plugin",
        entry: "internal:preset",
        compat: { package: "interactive-scenario-modeller", minVersion: "0.1.0" },
        trusted: true,
      },
      constraint: policyEvolution,
    },
  ];

  return {
    plugins,
    predicates: {
      budgetConstraint,
      planningConstraint,
      phasedRollout,
      multiObjectivePrioritization,
      multiObjectivePrioritiser,
      policyEvolution,
    },
    register: registerPlugin,
  };
}
