import { registerPlugin } from "../../plugin";
import { createArchetypeConstraintPlugin, type ArchetypeConstraintOptions } from "../built-environment/archetype-constraint";
import { createCoBenefitsTrackerPlugin, type CoBenefitsTrackerOptions } from "../social/co-benefits-metrics";
import { createHeatNetworkEconomicsPlugin, type HeatNetworkEconomicsOptions } from "../geographic/heat-network-zoning";
import { createFlexibilityDemandAdjustmentPlugin, type FlexibilityDemandAdjustmentOptions } from "../timeseries/flexibility-demand-adjustment";

export type LaepBundleInstallOptions = {
  namePrefix?: string;
  archetypeConstraint?: ArchetypeConstraintOptions;
  coBenefitsTracker?: CoBenefitsTrackerOptions;
  heatNetworkEconomics?: HeatNetworkEconomicsOptions;
  flexibilityDemandAdjustment?: FlexibilityDemandAdjustmentOptions;
};

export type LaepBundleInstallResult = {
  archetypeConstraint: { name: string; exportRef: string };
  coBenefitsTracker: { name: string; exportRef: string };
  heatNetworkEconomics: { name: string; exportRefPrioritise: string; exportRefUpgrade: string };
  flexibilityDemandAdjustment: { name: string; exportRef: string };
};

/**
 * Registers LAEP-specific plugins under an optional name prefix.
 */
export function installLaepPlugins(options: LaepBundleInstallOptions = {}): LaepBundleInstallResult {
  const p = `${options.namePrefix ?? "laep"}-`;

  const archetype = createArchetypeConstraintPlugin({
    name: `${p}archetype-constraint`,
    ...options.archetypeConstraint,
  });
  const coBenefits = createCoBenefitsTrackerPlugin({
    name: `${p}co-benefits-tracker`,
    ...options.coBenefitsTracker,
  });
  const heat = createHeatNetworkEconomicsPlugin({
    name: `${p}heat-network-economics`,
    ...options.heatNetworkEconomics,
  });
  const flex = createFlexibilityDemandAdjustmentPlugin({
    name: `${p}flexibility-demand-adjustment`,
    ...options.flexibilityDemandAdjustment,
  });

  registerPlugin(archetype);
  registerPlugin(coBenefits);
  registerPlugin(heat);
  registerPlugin(flex);

  return {
    archetypeConstraint: {
      name: archetype.manifest.name,
      exportRef: `${archetype.manifest.name}:constraint`,
    },
    coBenefitsTracker: {
      name: coBenefits.manifest.name,
      exportRef: `${coBenefits.manifest.name}:upgrade`,
    },
    heatNetworkEconomics: {
      name: heat.manifest.name,
      exportRefPrioritise: `${heat.manifest.name}:prioritise`,
      exportRefUpgrade: `${heat.manifest.name}:upgrade`,
    },
    flexibilityDemandAdjustment: {
      name: flex.manifest.name,
      exportRef: `${flex.manifest.name}:constraint`,
    },
  };
}
