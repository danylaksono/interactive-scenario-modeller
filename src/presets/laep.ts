import { installAllPlugins, type AllBundleInstallOptions } from "../plugins/installers";
import { installScenarioModellerPresets, type ScenarioPresetInstallOptions } from "./scenario-modeller";
import { installLaepPlugins, type LaepBundleInstallOptions } from "../plugins/laep";

export type LaepPresetInstallOptions = {
  /** Prefix for bundled plugin manifest names (avoid collisions in long-lived apps). */
  namespace?: string;
  scenarioPreset?: ScenarioPresetInstallOptions;
  laepPlugins?: LaepBundleInstallOptions;
  /** Optional overrides for standard bundles (names, coefficients, etc.). */
  allPlugins?: AllBundleInstallOptions;
};

export type LaepPresetInstallResult = {
  namespace: string;
  plugins: ReturnType<typeof installAllPlugins>;
  scenario: ReturnType<typeof installScenarioModellerPresets>;
  laep: ReturnType<typeof installLaepPlugins>;
};

function withPluginNamePrefix(
  prefix: string,
  overrides: AllBundleInstallOptions = {},
): AllBundleInstallOptions {
  const p = `${prefix}-`;
  return {
    financial: {
      budgetSpendTracker: { name: `${p}budget-spend-tracker`, ...overrides.financial?.budgetSpendTracker },
      financingModel: { name: `${p}financing-model`, ...overrides.financial?.financingModel },
    },
    social: {
      fuelPovertyPriority: { name: `${p}fuel-poverty-priority`, ...overrides.social?.fuelPovertyPriority },
    },
    policy: {
      policyTimelineValidator: { name: `${p}policy-timeline-validator`, ...overrides.policy?.policyTimelineValidator },
    },
    grid: {
      substationCapacityGate: { name: `${p}substation-capacity-gate`, ...overrides.grid?.substationCapacityGate },
      sequentialEnablement: { name: `${p}sequential-enablement`, ...overrides.grid?.sequentialEnablement },
      generationHeadroomAllocation: {
        name: `${p}generation-headroom-allocation`,
        ...overrides.grid?.generationHeadroomAllocation,
      },
      gridEnergyBalanceReporting: {
        name: `${p}grid-energy-balance-reporting`,
        ...overrides.grid?.gridEnergyBalanceReporting,
      },
    },
    optimization: {
      costBenefitPrioritiser: { name: `${p}cost-benefit-prioritiser`, ...overrides.optimization?.costBenefitPrioritiser },
      carbonTargetConstraint: { name: `${p}carbon-target-constraint`, ...overrides.optimization?.carbonTargetConstraint },
      topPercentPotential: { name: `${p}top-percent-potential`, ...overrides.optimization?.topPercentPotential },
      multiCriteriaPrioritiser: {
        name: `${p}multi-criteria-prioritiser`,
        ...overrides.optimization?.multiCriteriaPrioritiser,
      },
    },
    geographic: {
      spatialClusterPrioritiser: {
        name: `${p}spatial-cluster-prioritiser`,
        ...overrides.geographic?.spatialClusterPrioritiser,
      },
      urbanRuralStrategy: { name: `${p}urban-rural-strategy`, ...overrides.geographic?.urbanRuralStrategy },
      regionBudgetSplit: { name: `${p}region-budget-split`, ...overrides.geographic?.regionBudgetSplit },
    },
    timeseries: {
      seasonalDemandGate: { name: `${p}seasonal-demand-gate`, ...overrides.timeseries?.seasonalDemandGate },
      loadProfileScoring: { name: `${p}load-profile-scoring`, ...overrides.timeseries?.loadProfileScoring },
      technologyCoupling: { name: `${p}technology-coupling`, ...overrides.timeseries?.technologyCoupling },
    },
    transport: {
      evLoadInteraction: { name: `${p}ev-load-interaction`, ...overrides.transport?.evLoadInteraction },
      transportCorridorConstraint: {
        name: `${p}transport-corridor-constraint`,
        ...overrides.transport?.transportCorridorConstraint,
      },
    },
    risk: {
      volatilityScenario: { name: `${p}volatility-scenario`, ...overrides.risk?.volatilityScenario },
    },
  };
}

/**
 * Registers LAEP-oriented plugins: standard bundles with a stable name prefix,
 * scenario-modeller MCDA/budget predicates, and LAEP-specific plugins
 * (archetype constraints, co-benefits, heat-network economics, flexibility demand prep).
 */
export function installLaepPresets(options: LaepPresetInstallOptions = {}): LaepPresetInstallResult {
  const namespace = options.namespace ?? "laep";
  const plugins = installAllPlugins(withPluginNamePrefix(namespace, options.allPlugins));
  const scenario = installScenarioModellerPresets({
    namespace: options.scenarioPreset?.namespace ?? `${namespace}-scenario`,
    ...options.scenarioPreset,
  });
  const laep = installLaepPlugins({
    namePrefix: namespace,
    ...options.laepPlugins,
  });

  return { namespace, plugins, scenario, laep };
}
