import { createScenarioPluginPack } from "../plugins/scenario";
import { registerPredicate } from "../registry";

export type ScenarioObjectiveWeights = {
  carbonSavingPotential?: number;
  fuelPovertyScore?: number;
  gridCapacityEfficiency?: number;
  communityImpact?: number;
};

export type ScenarioPolicy = {
  enabledEntityTypes?: string[];
  minEfficiencyStandard?: number;
};

export type ScenarioPresetInstallOptions = {
  namespace?: string;
  defaultBudgetAllocation?: Record<number, number>;
  defaultPolicyTimeline?: Record<number, ScenarioPolicy>;
  defaultMinScoreThreshold?: number;
  defaultObjectiveWeights?: ScenarioObjectiveWeights;
};

export type ScenarioPresetInstallResult = {
  namespace: string;
  predicates: {
    budgetConstraint: string;
    planningConstraint: string;
    phasedRollout: string;
    multiObjectivePrioritization: string;
    multiObjectivePrioritiser: string;
    policyEvolution: string;
  };
  pluginExports: {
    budgetConstraint: string;
    planningConstraint: string;
    phasedRollout: string;
    multiObjectivePrioritization: string;
    multiObjectivePrioritiser: string;
    policyEvolution: string;
  };
};

export function installScenarioModellerPresets(
  options: ScenarioPresetInstallOptions = {},
): ScenarioPresetInstallResult {
  const namespace = options.namespace ?? "scenario";

  const budgetConstraintName = `${namespace}:budgetConstraint`;
  const planningConstraintName = `${namespace}:planningConstraint`;
  const phasedRolloutName = `${namespace}:phasedRollout`;
  const multiObjectiveName = `${namespace}:multiObjectivePrioritization`;
  const multiObjectivePrioritiserName = `${namespace}:multiObjectivePrioritiser`;
  const policyEvolutionName = `${namespace}:policyEvolution`;

  const pluginPack = createScenarioPluginPack({
    namespace,
    defaultBudgetAllocation: options.defaultBudgetAllocation,
    defaultMinScoreThreshold: options.defaultMinScoreThreshold,
    defaultObjectiveWeights: options.defaultObjectiveWeights,
    defaultPolicyTimeline: options.defaultPolicyTimeline,
  });

  for (const plugin of pluginPack.plugins) {
    pluginPack.register(plugin);
  }

  registerPredicate(budgetConstraintName, pluginPack.predicates.budgetConstraint);

  registerPredicate(planningConstraintName, pluginPack.predicates.planningConstraint);

  registerPredicate(phasedRolloutName, pluginPack.predicates.phasedRollout);

  registerPredicate(multiObjectiveName, pluginPack.predicates.multiObjectivePrioritization);

  registerPredicate(multiObjectivePrioritiserName, pluginPack.predicates.multiObjectivePrioritiser);

  registerPredicate(policyEvolutionName, pluginPack.predicates.policyEvolution);

  return {
    namespace,
    predicates: {
      budgetConstraint: budgetConstraintName,
      planningConstraint: planningConstraintName,
      phasedRollout: phasedRolloutName,
      multiObjectivePrioritization: multiObjectiveName,
      multiObjectivePrioritiser: multiObjectivePrioritiserName,
      policyEvolution: policyEvolutionName,
    },
    pluginExports: {
      budgetConstraint: `${namespace}-budget-constraint:constraint`,
      planningConstraint: `${namespace}-planning-constraint:constraint`,
      phasedRollout: `${namespace}-phased-rollout:constraint`,
      multiObjectivePrioritization: `${namespace}-multi-objective:constraint`,
      multiObjectivePrioritiser: `${namespace}-multi-objective:prioritise`,
      policyEvolution: `${namespace}-policy-evolution:constraint`,
    },
  };
}
