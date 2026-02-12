import { registerPlugin } from "../plugin";
import {
  createBudgetSpendTrackerPlugin,
  createFinancingModelPlugin,
  type BudgetSpendTrackerOptions,
  type FinancingModelPluginOptions,
} from "./financial";
import {
  createFuelPovertyPriorityPlugin,
  type FuelPovertyPriorityPluginOptions,
} from "./social";
import {
  createPolicyTimelineValidatorPlugin,
  type PolicyTimelineValidatorPluginOptions,
} from "./policy";
import {
  createSubstationCapacityGatePlugin,
  createSequentialEnablementPlugin,
  type SubstationCapacityGatePluginOptions,
  type SequentialEnablementPluginOptions,
} from "./grid";
import {
  createCostBenefitPrioritiserPlugin,
  createCarbonTargetConstraintPlugin,
  createTopPercentPotentialPlugin,
  type CostBenefitPrioritiserOptions,
  type CarbonTargetConstraintOptions,
  type TopPercentPotentialOptions,
} from "./optimization";
import {
  createSpatialClusterPrioritiserPlugin,
  createUrbanRuralStrategyPlugin,
  createRegionBudgetSplitPlugin,
  type SpatialClusterPrioritiserOptions,
  type UrbanRuralStrategyOptions,
  type RegionBudgetSplitOptions,
} from "./geographic";
import {
  createSeasonalDemandGatePlugin,
  createLoadProfileScoringPlugin,
  createTechnologyCouplingPlugin,
  type SeasonalDemandGateOptions,
  type LoadProfileScoringOptions,
  type TechnologyCouplingOptions,
} from "./timeseries";
import {
  createEVLoadInteractionPlugin,
  createTransportCorridorConstraintPlugin,
  type EVLoadInteractionPluginOptions,
  type TransportCorridorConstraintOptions,
} from "./transport";
import {
  createVolatilityScenarioPlugin,
  type VolatilityScenarioPluginOptions,
} from "./risk";

export type InstalledPluginRef = {
  name: string;
  exportRef: string;
};

export type FinancialBundleInstallOptions = {
  budgetSpendTracker?: BudgetSpendTrackerOptions;
  financingModel?: FinancingModelPluginOptions;
};

export type SocialBundleInstallOptions = {
  fuelPovertyPriority?: FuelPovertyPriorityPluginOptions;
};

export type PolicyBundleInstallOptions = {
  policyTimelineValidator?: PolicyTimelineValidatorPluginOptions;
};

export type GridBundleInstallOptions = {
  substationCapacityGate?: SubstationCapacityGatePluginOptions;
  sequentialEnablement?: SequentialEnablementPluginOptions;
};

export type OptimizationBundleInstallOptions = {
  costBenefitPrioritiser?: CostBenefitPrioritiserOptions;
  carbonTargetConstraint?: CarbonTargetConstraintOptions;
  topPercentPotential?: TopPercentPotentialOptions;
};

export type AllBundleInstallOptions = {
  financial?: FinancialBundleInstallOptions;
  social?: SocialBundleInstallOptions;
  policy?: PolicyBundleInstallOptions;
  grid?: GridBundleInstallOptions;
  optimization?: OptimizationBundleInstallOptions;
  geographic?: GeographicBundleInstallOptions;
  timeseries?: TimeseriesBundleInstallOptions;
  transport?: TransportBundleInstallOptions;
  risk?: RiskBundleInstallOptions;
};

export type GeographicBundleInstallOptions = {
  spatialClusterPrioritiser?: SpatialClusterPrioritiserOptions;
  urbanRuralStrategy?: UrbanRuralStrategyOptions;
  regionBudgetSplit?: RegionBudgetSplitOptions;
};

export type TimeseriesBundleInstallOptions = {
  seasonalDemandGate?: SeasonalDemandGateOptions;
  loadProfileScoring?: LoadProfileScoringOptions;
  technologyCoupling?: TechnologyCouplingOptions;
};

export type TransportBundleInstallOptions = {
  evLoadInteraction?: EVLoadInteractionPluginOptions;
  transportCorridorConstraint?: TransportCorridorConstraintOptions;
};

export type RiskBundleInstallOptions = {
  volatilityScenario?: VolatilityScenarioPluginOptions;
};

export function installFinancialPlugins(
  options: FinancialBundleInstallOptions = {},
): {
  budgetSpendTracker: InstalledPluginRef;
  financingModel: InstalledPluginRef;
} {
  const budgetSpendTracker = createBudgetSpendTrackerPlugin(options.budgetSpendTracker);
  const financingModel = createFinancingModelPlugin(options.financingModel);

  registerPlugin(budgetSpendTracker);
  registerPlugin(financingModel);

  return {
    budgetSpendTracker: {
      name: budgetSpendTracker.manifest.name,
      exportRef: `${budgetSpendTracker.manifest.name}:upgrade`,
    },
    financingModel: {
      name: financingModel.manifest.name,
      exportRef: `${financingModel.manifest.name}:upgrade`,
    },
  };
}

export function installSocialPlugins(
  options: SocialBundleInstallOptions = {},
): {
  fuelPovertyPriority: InstalledPluginRef;
} {
  const fuelPovertyPriority = createFuelPovertyPriorityPlugin(options.fuelPovertyPriority);

  registerPlugin(fuelPovertyPriority);

  return {
    fuelPovertyPriority: {
      name: fuelPovertyPriority.manifest.name,
      exportRef: `${fuelPovertyPriority.manifest.name}:constraint`,
    },
  };
}

export function installPolicyPlugins(
  options: PolicyBundleInstallOptions = {},
): {
  policyTimelineValidator: InstalledPluginRef;
} {
  const policyTimelineValidator = createPolicyTimelineValidatorPlugin(options.policyTimelineValidator);

  registerPlugin(policyTimelineValidator);

  return {
    policyTimelineValidator: {
      name: policyTimelineValidator.manifest.name,
      exportRef: `${policyTimelineValidator.manifest.name}:constraint`,
    },
  };
}

export function installGridPlugins(
  options: GridBundleInstallOptions = {},
): {
  substationCapacityGate: InstalledPluginRef;
  sequentialEnablement: InstalledPluginRef;
} {
  const substationCapacityGate = createSubstationCapacityGatePlugin(options.substationCapacityGate);
  const sequentialEnablement = createSequentialEnablementPlugin(options.sequentialEnablement);

  registerPlugin(substationCapacityGate);
  registerPlugin(sequentialEnablement);

  return {
    substationCapacityGate: {
      name: substationCapacityGate.manifest.name,
      exportRef: `${substationCapacityGate.manifest.name}:constraint`,
    },
    sequentialEnablement: {
      name: sequentialEnablement.manifest.name,
      exportRef: `${sequentialEnablement.manifest.name}:constraint`,
    },
  };
}

export function installOptimizationPlugins(
  options: OptimizationBundleInstallOptions = {},
): {
  costBenefitPrioritiser: InstalledPluginRef;
  carbonTargetConstraint: InstalledPluginRef;
  topPercentPotential: InstalledPluginRef;
} {
  const costBenefitPrioritiser = createCostBenefitPrioritiserPlugin(options.costBenefitPrioritiser);
  const carbonTargetConstraint = createCarbonTargetConstraintPlugin(options.carbonTargetConstraint);
  const topPercentPotential = createTopPercentPotentialPlugin(options.topPercentPotential);

  registerPlugin(costBenefitPrioritiser);
  registerPlugin(carbonTargetConstraint);
  registerPlugin(topPercentPotential);

  return {
    costBenefitPrioritiser: {
      name: costBenefitPrioritiser.manifest.name,
      exportRef: `${costBenefitPrioritiser.manifest.name}:prioritise`,
    },
    carbonTargetConstraint: {
      name: carbonTargetConstraint.manifest.name,
      exportRef: `${carbonTargetConstraint.manifest.name}:constraint`,
    },
    topPercentPotential: {
      name: topPercentPotential.manifest.name,
      exportRef: `${topPercentPotential.manifest.name}:constraint`,
    },
  };
}

export function installGeographicPlugins(
  options: GeographicBundleInstallOptions = {},
): {
  spatialClusterPrioritiser: InstalledPluginRef;
  urbanRuralStrategyConstraint: InstalledPluginRef;
  urbanRuralStrategyPrioritiser: InstalledPluginRef;
  regionBudgetSplit: InstalledPluginRef;
} {
  const spatialClusterPrioritiser = createSpatialClusterPrioritiserPlugin(options.spatialClusterPrioritiser);
  const urbanRuralStrategy = createUrbanRuralStrategyPlugin(options.urbanRuralStrategy);
  const regionBudgetSplit = createRegionBudgetSplitPlugin(options.regionBudgetSplit);

  registerPlugin(spatialClusterPrioritiser);
  registerPlugin(urbanRuralStrategy);
  registerPlugin(regionBudgetSplit);

  return {
    spatialClusterPrioritiser: {
      name: spatialClusterPrioritiser.manifest.name,
      exportRef: `${spatialClusterPrioritiser.manifest.name}:prioritise`,
    },
    urbanRuralStrategyConstraint: {
      name: urbanRuralStrategy.manifest.name,
      exportRef: `${urbanRuralStrategy.manifest.name}:constraint`,
    },
    urbanRuralStrategyPrioritiser: {
      name: urbanRuralStrategy.manifest.name,
      exportRef: `${urbanRuralStrategy.manifest.name}:prioritise`,
    },
    regionBudgetSplit: {
      name: regionBudgetSplit.manifest.name,
      exportRef: `${regionBudgetSplit.manifest.name}:constraint`,
    },
  };
}

export function installTimeseriesPlugins(
  options: TimeseriesBundleInstallOptions = {},
): {
  seasonalDemandGate: InstalledPluginRef;
  loadProfileScoring: InstalledPluginRef;
  technologyCoupling: InstalledPluginRef;
} {
  const seasonalDemandGate = createSeasonalDemandGatePlugin(options.seasonalDemandGate);
  const loadProfileScoring = createLoadProfileScoringPlugin(options.loadProfileScoring);
  const technologyCoupling = createTechnologyCouplingPlugin(options.technologyCoupling);
  registerPlugin(seasonalDemandGate);
  registerPlugin(loadProfileScoring);
  registerPlugin(technologyCoupling);

  return {
    seasonalDemandGate: {
      name: seasonalDemandGate.manifest.name,
      exportRef: `${seasonalDemandGate.manifest.name}:constraint`,
    },
    loadProfileScoring: {
      name: loadProfileScoring.manifest.name,
      exportRef: `${loadProfileScoring.manifest.name}:prioritise`,
    },
    technologyCoupling: {
      name: technologyCoupling.manifest.name,
      exportRef: `${technologyCoupling.manifest.name}:upgrade`,
    },
  };
}

export function installTransportPlugins(
  options: TransportBundleInstallOptions = {},
): {
  evLoadInteraction: InstalledPluginRef;
  transportCorridorConstraint: InstalledPluginRef;
} {
  const evLoadInteraction = createEVLoadInteractionPlugin(options.evLoadInteraction);
  const transportCorridorConstraint = createTransportCorridorConstraintPlugin(options.transportCorridorConstraint);

  registerPlugin(evLoadInteraction);
  registerPlugin(transportCorridorConstraint);

  return {
    evLoadInteraction: {
      name: evLoadInteraction.manifest.name,
      exportRef: `${evLoadInteraction.manifest.name}:constraint`,
    },
    transportCorridorConstraint: {
      name: transportCorridorConstraint.manifest.name,
      exportRef: `${transportCorridorConstraint.manifest.name}:constraint`,
    },
  };
}

export function installRiskPlugins(
  options: RiskBundleInstallOptions = {},
): {
  volatilityScenario: InstalledPluginRef;
} {
  const volatilityScenario = createVolatilityScenarioPlugin(options.volatilityScenario);
  registerPlugin(volatilityScenario);

  return {
    volatilityScenario: {
      name: volatilityScenario.manifest.name,
      exportRef: `${volatilityScenario.manifest.name}:upgrade`,
    },
  };
}

export function installAllPlugins(options: AllBundleInstallOptions = {}) {
  return {
    financial: installFinancialPlugins(options.financial),
    social: installSocialPlugins(options.social),
    policy: installPolicyPlugins(options.policy),
    grid: installGridPlugins(options.grid),
    optimization: installOptimizationPlugins(options.optimization),
    geographic: installGeographicPlugins(options.geographic),
    timeseries: installTimeseriesPlugins(options.timeseries),
    transport: installTransportPlugins(options.transport),
    risk: installRiskPlugins(options.risk),
  };
}
