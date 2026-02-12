# Interactive Scenario Modeller

This library provides a structured framework to simulate complex decarbonisation interventions (e.g., solar rollouts, energy upgrades) with realistic constraints like budgets, grid capacity, planning rules, and timing. It enables real-time decision-making with immediate feedback on complex trade-offs.

Example: Local Authority Housing Decarbonisation.

A council needs to retrofit 10,000 social housing units with heat pumps but faces constraints:
- £50M budget over 5 years
- Grid capacity limits in certain districts  
- Fuel poverty prioritization requirements
- Planning permission delays in conservation areas

Therefore, policymakers can:

1. Adjust budget allocations annually and instantly see impact on deployment
2. Test "what if" scenarios: "What if we prioritize fuel-poor neighborhoods first?"  
3. Visualize real-time trade-offs between carbon reduction vs. social equity
4. Immediately see how grid upgrades unlock additional deployment potential
5. Iterate on policy combinations in meetings rather than waiting for new reports


## The Three Main Functions (Principal Predicates)

The Scenario Modeller (centered around the Intervention primitive) is designed to simulate decarbonization pathways by applying changes to a building stock over time. Its design is governed by three primary functional stages and a core philosophy of flexibility and data-agnosticism.

Every intervention is defined by three core functions that run iteratively for each year of the simulation:

1. **Filter**: Determines eligibility. It answers the question: "Which buildings are candidates for this intervention right now?" For example, you might filter for buildings with an EPC rating below 'C', or those located in a specific deprivation decile.
2. **Prioritise**: Determines order. It answers the question: "In what order should we process the eligible buildings?" This is critical when resources (like budget or installer capacity) are limited. Common strategies include prioritizing by cost-effectiveness (emissions reduction per £ spent) or technical suitability.
3. **Upgrade**: Determines impact. It answers the question: "What change is applied, and what are the results?" This function performs the actual modification (e.g., installing a heat pump) and returns the metrics for that action, such as installation cost, energy savings, and CO2 reduction.

## The Philosophy of the Modeller

The philosophy of the library focuses on making complex energy planning logic transparent, reusable, and adaptable:

* **The Facet Adapter Pattern (Data Agnosticism)**: The modeller does not care about the underlying data format (CSV, JSON, SQL, etc.). By using "Facet Adapters," it can interface with any data source that implements a simple row-and-column interface. This decouples the modelling logic from data engineering.
* **Functional Expressiveness (Predicate-Based Control)**: Instead of using rigid configuration files, the modeller uses high-level functions (predicates). This allows planners to express complex, real-world logic—such as "only install heat pumps if the building is already well-insulated"—directly in code.
* **Minimal Core with Extensibility**: The library follows a "lean core" approach. Specialized logic (like grid constraints or specific technology costs) is handled through a Predicate Registry and Plugin System. This allows teams to build a shared library of reusable "building blocks" for different scenarios.
* **Transparency and Testability**: By breaking down simulations into the discrete Filter-Prioritise-Upgrade steps, the modeller moves away from "black box" simulations. Each stage can be individually tested and audited, making the resulting energy plans more robust and easier to explain to stakeholders.

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

## Expected Input Data

The library accepts row-oriented data (typically one row per building). There is no strict schema, but these conventions make plugins and joins work consistently:

- `uprn` (recommended) — unique building identifier (`string | number`)
- Cost / potential fields used by your predicates (for example `estimatedPVCost`, `heatPumpCost`, `carbonSavingsKg`)
- Optional geographic fields for regional/grid plugins (for example `region`, `substationId`, `lsoa`)
- Optional social fields for prioritisation (for example `fuelPovertyScore`, `deprivationIndex`)

Minimal example:

```ts
const buildings = [
	{
		uprn: '100001',
		estimatedPVCost: 5000,
		carbonSavingsKg: 850,
		region: 'North',
		substationId: 'SS-12',
		fuelPovertyScore: 0.72,
	},
];
```

Notes:

- If `uprn` is missing, many flows can still run, but cross-year tracking and facet joins are less reliable.
- Plugins may require additional fields depending on the domain (grid, transport, risk, etc.).

### Data Requirements by Plugin Family

Use this as a quick checklist when preparing your dataset. Required fields vary by plugin options and your predicate logic, but these are common defaults:

| Plugin family | Typical required fields | Typical optional fields |
| --- | --- | --- |
| Financial | `uprn`, intervention cost field (for example `estimatedPVCost`) | `capex`, `opex`, financing parameters, discount-rate inputs |
| Social | `uprn`, `fuelPovertyScore` (or equivalent priority metric) | `deprivationIndex`, vulnerability flags, tenure |
| Policy | `uprn`, year/timeline fields used by policy rules | local policy zone, planning class, permit status |
| Grid | `uprn`, `substationId`, demand/export fields used by checks | feeder id, constrained-area flag, upgrade queue status |
| Optimization | `uprn`, benefit + cost fields (for ranking/constraints) | readiness score, confidence/uncertainty score |
| Geographic | `uprn`, geographic grouping field (`region`, `lsoa`, etc.) | urban/rural class, spatial cluster id, district code |
| Timeseries | `uprn`, seasonal/load profile inputs | flexibility score, hourly shape id, storage coupling fields |
| Transport | `uprn`, EV charging demand/load fields, corridor/group id | charger type mix, fleet assumptions, travel-demand class |
| Risk | `uprn`, baseline metric(s) to perturb (cost, demand, carbon, etc.) | scenario tags, volatility class, sensitivity labels |

When in doubt, start with `uprn` + the exact fields referenced by your `filter`, `prioritise`, and `upgrade` functions, then add plugin-specific columns incrementally.

## What Is a Facet?

A facet is the input data interface consumed by `Intervention`. It is intentionally minimal and can wrap arrays, tables, or external data structures.

Required shape:

```ts
type FacetLike = {
	getRowCount?: () => number;
	getRow?: (i: number) => any;
	colNames?: string[];
};
```

`arrayAdapter()` converts a plain `Array<object>` into this interface:

```ts
const facet = arrayAdapter(buildings);
const intervention = new Intervention('My intervention', { facet });
```

If you already have your own table abstraction, just provide `getRowCount()` and `getRow(i)` and pass it directly as `facet`.

## Simulation Output

`intervention.simulate()` returns:

- `state` — mutable scenario state accumulated via `init`, `upgrade`, and year hooks
- `metrics` — per-year upgrade events and metric deltas
- `buildings` — final in-memory building objects after simulation
- `columns` — `Set<string>` of declared output columns from `propertySpec()`

Example shape:

```ts
const result = intervention.simulate();

// result.state
// { budgetSpent: { 2024: 1200000, 2025: 1800000 } }

// result.metrics
// {
//   "2024": [
//     {
//       building: "100001",
//       stats: {
//         installed: true,
//         cost: 5000,
//         building: "100001",
//         year: 2024,
//         order: 1
//       }
//     }
//   ]
// }

// result.buildings
// [ { uprn: "100001", ...updated fields... } ]

// result.columns
// Set { "cost", "installed", ... }
```

The intervention also stores `intervention.simulatedFacet`, a facet-like tabular output built from metrics (with columns like `uprn`, `year`, metric fields, plus optional carried-through input columns).

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
- `createGenerationHeadroomAllocationPlugin(opts)` — reusable `constraint` plugin for allocating substation export headroom to utility-scale renewables
- `createGridEnergyBalanceReportingPlugin(opts)` — reusable `upgrade` plugin to calculate demand+generation requirements and remaining headroom

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

## Transport Plugins

- `createEVLoadInteractionPlugin(opts)` — reusable `constraint` plugin that combines baseline EV load and per-building EV charging demand in capacity checks
- `createTransportCorridorConstraintPlugin(opts)` — reusable `constraint` plugin for corridor-level charging delivery requirements

## Risk Plugins

- `createVolatilityScenarioPlugin(opts)` — reusable `upgrade` plugin that applies year/season volatility multipliers to price metrics

## Bundle Installers

- `installFinancialPlugins(opts)`
- `installSocialPlugins(opts)`
- `installPolicyPlugins(opts)`
- `installGridPlugins(opts)`
- `installOptimizationPlugins(opts)`
- `installGeographicPlugins(opts)`
- `installTimeseriesPlugins(opts)`
- `installTransportPlugins(opts)`
- `installRiskPlugins(opts)`
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
For grid export allocation and demand/headroom balance with mock data, see [examples/grid-headroom-balance-workflow.ts](examples/grid-headroom-balance-workflow.ts).
For a three-stage integrated flow (generation allocation, demand-side upgrades, then EV transport interaction), see [examples/integrated-grid-two-stage-workflow.ts](examples/integrated-grid-two-stage-workflow.ts).

## Risk Helpers

- `runSensitivityAnalysis(opts)` — runs cartesian parameter sweeps with per-scenario summaries
- `runMonteCarloAnalysis(opts)` — runs repeated stochastic scenarios with aggregate stats

## Goals & Notes

- Avoid `eval()` by default. Use predicate registry for named functions.
- Keep interfaces small and testable. The library is TypeScript-first.


