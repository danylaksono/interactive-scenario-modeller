# interactive-scenario-modeller

A small, extensible scenario modeller library for decarbonisation scenarios.

## Quickstart

```bash
npm install
npm run build
npm test
```

## API Overview

- `new Intervention(name, opts)` — core modelling primitive
- `registerPredicate(name, fn)` — register predefined predicate functions
- `installScenarioModellerPresets(opts)` — register built-in scenario predicates/plugins
- `arrayAdapter(arr)` — simple facet adapter

## Built-in Scenario Presets

Use prebuilt predicates/plugins for common scenario-modeller flows:

```ts
import {
	Intervention,
	arrayAdapter,
	installScenarioModellerPresets,
} from 'interactive-scenario-modeller';

const { predicates, pluginExports } = installScenarioModellerPresets({
	namespace: 'scenario',
	defaultMinScoreThreshold: 0.6,
});

const facet = arrayAdapter([{ uprn: '1', estimatedPVCost: 5000 }]);

const intervention = new Intervention('PV rollout', {
	facet,
	startYear: 2024,
	endYear: 2030,
	filter: predicates.budgetConstraint,
	// or use plugin export syntax: filter: pluginExports.planningConstraint,
	upgrade: (building, context) => {
		const year = context.year;
		const cost = building.estimatedPVCost ?? 0;
		context.state.budgetSpent = context.state.budgetSpent ?? {};
		context.state.budgetSpent[year] = (context.state.budgetSpent[year] ?? 0) + cost;
		return { installed: true, cost };
	},
});

const result = intervention.simulate();
```

Preset predicates included:

- `budgetConstraint`
- `planningConstraint`
- `phasedRollout`
- `multiObjectivePrioritization`
- `policyEvolution`

Plugin export references included:

- `pluginExports.budgetConstraint`
- `pluginExports.planningConstraint`
- `pluginExports.phasedRollout`
- `pluginExports.multiObjectivePrioritization`
- `pluginExports.policyEvolution`

## Financial Plugins

- `createBudgetSpendTrackerPlugin(opts)` — reusable `upgrade` plugin for yearly budget spend tracking
- `createFinancingModelPlugin(opts)` — reusable `upgrade` plugin for cash/lease/PPA outputs (`annualPayment`, `npvCost`, `modelType`)

## Social Plugins

- `createFuelPovertyPriorityPlugin(opts)` — reusable `constraint` plugin using weighted fuel-poverty/carbon priority scoring

## Policy Plugins

- `createPolicyTimelineValidatorPlugin(opts)` — reusable `constraint` plugin for timeline schema validation and optional strict year coverage

## Grid Plugins

- `createSubstationCapacityGatePlugin(opts)` — reusable `constraint` plugin to gate upgrades by per-substation capacity
- `createSequentialEnablementPlugin(opts)` — reusable `constraint` plugin for prerequisite intervention gating

## Optimization Plugins

- `createCostBenefitPrioritiserPlugin(opts)` — reusable `prioritiser` plugin for benefit-per-cost ordering
- `createCarbonTargetConstraintPlugin(opts)` — reusable `constraint` plugin to stop selection once target is reached
- `createTopPercentPotentialPlugin(opts)` — reusable `constraint` plugin for pre-ranked top-percent targeting

## Geographic Plugins

- `createSpatialClusterPrioritiserPlugin(opts)` — reusable `prioritiser` plugin for cluster-density strategy
- `createUrbanRuralStrategyPlugin(opts)` — reusable combined `constraint` + `prioritiser` plugin for area strategy
- `createRegionBudgetSplitPlugin(opts)` — reusable `constraint` plugin for per-region budget envelopes

## Timeseries Plugins

- `createSeasonalDemandGatePlugin(opts)` — reusable `constraint` plugin for seasonal demand/capacity gating
- `createLoadProfileScoringPlugin(opts)` — reusable `prioritiser` plugin for peak/load-shift/flexibility scoring
- `createTechnologyCouplingPlugin(opts)` — reusable `upgrade` plugin for battery/heat-pump adjusted demand and carbon effects

## Bundle Installers

- `installFinancialPlugins(opts)`
- `installSocialPlugins(opts)`
- `installPolicyPlugins(opts)`
- `installGridPlugins(opts)`
- `installOptimizationPlugins(opts)`
- `installGeographicPlugins(opts)`
- `installTimeseriesPlugins(opts)`
- `installAllPlugins(opts)`

```ts
import { installAllPlugins } from 'interactive-scenario-modeller';

const plugins = installAllPlugins();
// Example: plugins.grid.substationCapacityGate.exportRef
```

## Scenario Template Helper

- `createScenarioTemplate(opts)` — combines bundle installation and reusable state-default init hooks

```ts
import { createScenarioTemplate } from 'interactive-scenario-modeller';

const template = createScenarioTemplate();
// Example: template.init or template.withInit(...)
```

See the end-to-end example in [examples/scenario-template.ts](examples/scenario-template.ts).
For staged big-data runs, see [examples/large-dataset-workflow.ts](examples/large-dataset-workflow.ts).

## Risk Helpers

- `runSensitivityAnalysis(opts)` — runs cartesian parameter sweeps with per-scenario summaries
- `runMonteCarloAnalysis(opts)` — runs repeated stochastic scenarios with aggregate stats

## Goals & Notes

- Avoid `eval()` by default. Use predicate registry for named functions.
- Keep interfaces small and testable. The library is TypeScript-first.

See `PLANS.md` for next steps and migration notes.
