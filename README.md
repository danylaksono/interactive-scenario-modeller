# Interactive Scenario Modeller

This library provides a structured framework to simulate complex interventions and evolutions of entity stocks (e.g., building upgrades, urban planning, biodiversity restoration) under realistic constraints like budgets, spatial quotas, and timing. 

It uses a generic **Filter → Prioritise → Transform** lifecycle that makes it immediately usable across domains beyond energy, including transport, conservation, and public health.

## Core Concepts

Every intervention is defined by three core functions (predicates) that run iteratively for each step (year, month, or custom event) of the simulation:

1. **Filter**: Determines eligibility. It answers the question: "Which entities are candidates for this transformation right now?"
2. **Prioritise**: Determines order. It answers the question: "In what order should we process the eligible entities?" (Critical when resources like budget or capacity are limited).
3. **Transform (Upgrade)**: Determines impact. It answers the question: "What change is applied, and what are the results?" This function performs the actual modification and returns metric deltas.

## Features

- **Domain Agnostic**: Works with any "Entity" (Buildings, Parcels, Habitat Patches, Fleet Corridors).
- **Spatial First**: Geometries are first-class properties. Carry GeoJSON through the simulation and use spatial predicates (`within`, `distanceTo`).
- **Resource Layer**: Global `resources` API for cross-intervention constraints (e.g., "max 5 upgrades per km²", "global installer headroom", "regional budget envelopes").
- **Flexible Timesteps**: Configure the simulation loop by years, months, or custom event steps.
- **Data Agnostic**: Interface with any data source (CSV, JSON, GeoJSON, SQL) via the Facet Adapter pattern.
- **Pure Client-Side**: Run complex simulations (50k+ features) directly in the browser with no backend required.

## Quickstart

```bash
npm install interactive-scenario-modeller
```

```ts
import { Intervention, arrayAdapter, toGeoJSON } from 'interactive-scenario-modeller';

const entities = [
  { id: 'A', geometry: { type: 'Point', coordinates: [0, 0] }, value: 10 },
  { id: 'B', geometry: { type: 'Point', coordinates: [1, 1] }, value: 20 }
];

const intervention = new Intervention('Greening Project', {
  facet: arrayAdapter(entities),
  startYear: 2025,
  endYear: 2030,
  // Filter by spatial location or attributes
  filter: (entity, context) => entity.value < 15,
  // Ranks entities by potential
  prioritise: (a, b) => b.value - a.value,
  // Apply the transformation and consume global resources
  transform: (entity, context) => {
    if (context.resources.consume('budget', 1000)) {
      return { greened: true, cost: 1000 };
    }
  }
});

const result = intervention.simulate(null, { budget: 50000 });
const geojson = toGeoJSON(intervention.simulatedFacet);
```

## API Overview

### `Intervention`
The primary modelling primitive. 
- `setupEntity` / `setupBuilding`: Transform facet rows into entity objects.
- `transform` / `apply` / `upgrade`: Apply changes and return metrics.
- `simulate(entities?, sharedResources?)`: Run the simulation loop.

### `SimulationContext`
Passed to every predicate, providing access to:
- `step` / `year`: Current timestep.
- `resources`: Global resource API (`get`, `set`, `consume`, `has`).
- `state`: Local intervention state.
- `random()`: Deterministic RNG for reproducible scenarios.

### `Geographic Support`
- `toGeoJSON(facet)`: Export results to a GeoJSON FeatureCollection if geometries are present.
- `registerSpatialPredicates()`: Adds `geo:distanceTo` and `geo:within` to the registry.

## The Philosophy of the Modeller

* **The Facet Adapter Pattern**: Decouples logic from data engineering. Wrap any source in `FacetLike`.
* **Predicate-Based Control**: Express complex, real-world logic directly in code rather than rigid config files.
* **Minimal Core with Extensibility**: Specialized logic (grid, finance, risk) is handled through a plugin system.
* **Transparency**: Break down "black box" simulations into auditable, testable steps.

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


