# Scenario Modeller Use Cases

This document outlines various scenario modeling use cases for the interactive-sm library, extending beyond the substation capacity constraints to address diverse decarbonisation planning needs for local authorities and DNOs.

## Core Use Case Categories

### 1. Infrastructure Planning & Investment
#### Grid Upgrade Prioritization
- **Question**: "Which substations should be upgraded first to maximize renewable adoption?"
- **Data Requirements**: Substation capacity, upgrade costs, building PV potential, adoption rates
- **Methodology**: Cost-benefit analysis comparing upgrade costs vs. unlocked renewable capacity

#### Network Reinforcement Scenarios
- **Question**: "What's the optimal sequence of grid reinforcements over 10 years?"
- **Data Requirements**: Multi-year capital budgets, construction timelines, capacity constraints
- **Methodology**: Phased investment modeling with compound effects

### 2. Budget & Financial Planning
#### Capital Allocation Optimization
- **Question**: "Given a £50M budget over 5 years, which buildings should receive PV installations for maximum impact?"
- **Data Requirements**: Building costs, budget constraints, year-by-year allocation
- **Implementation**:
```typescript
registerPredicate('budgetConstraint', (building, context) => {
  const yearlyBudget = context.state.budgetAllocation[context.year] || 0;
  const spentBudget = context.state.budgetSpent[context.year] || 0;
  const buildingCost = building.estimatedPVCost;
  return (spentBudget + buildingCost) <= yearlyBudget;
});
```

#### Top Performers Targeting
- **Question**: "Install PV on top 1% of buildings by generation potential within budget constraints"
- **Methodology**: 
1. Rank buildings by solar generation potential
2. Apply budget filters yearly
3. Track cumulative adoption and budget utilization

#### Financing Scenario Comparison
- **Questions**:
- "How do different financing models (cash purchase vs. leasing vs. PPA) affect adoption rates?"
- "What's the impact of varying interest rates on large-scale deployment?"

### 3. Policy & Regulatory Compliance
#### Carbon Reduction Targets
- **Question**: "What combination of interventions achieves our 2030 carbon reduction target?"
- **Data Requirements**: Carbon targets, baseline emissions, intervention effectiveness
- **Methodology**: Multi-intervention optimization with target constraints

#### Planning Permission Constraints
- **Question**: "How do conservation area restrictions affect renewable deployment potential?"
- **Data Requirements**: Planning zones, restriction types, building classifications
- **Implementation**:
```typescript
registerPredicate('planningConstraint', (building, context) => {
  if (building.conservationArea && building.listedStatus === 'Grade II*') {
    return false; // No PV allowed
  }
  if (building.conservationArea && context.year < 2025) {
    return false; // Deferred until policy changes
  }
  return true;
});
```

#### Fuel Poverty Alleviation
- **Question**: "Prioritize renewable installations for fuel-poor households while maximizing carbon savings"
- **Data Requirements**: Income data, energy bills, deprivation indices
- **Methodology**: Multi-objective optimization balancing social and environmental goals

### 4. Temporal & Sequential Planning
#### Phased Deployment Strategies
- **Question**: "What's the optimal rollout sequence: pilot → expansion → full deployment?"
- **Data Requirements**: Learning curves, cost reductions over time, market development
- **Implementation**:
```typescript
registerPredicate('phasedRollout', (building, context) => {
  const phase = calculateDeploymentPhase(context.year);
  return building.priorityZone <= phase;
});
```

#### Technology Evolution Scenarios
- **Questions**:
- "How does battery storage adoption change PV system sizing over time?"
- "What impact do heat pump electrification rates have on grid capacity needs?"
- **Data Requirements**: Technology efficiency improvements, cost curves, market penetration rates

#### Seasonal Demand Management
- **Question**: "How does seasonal demand variation affect optimal renewable deployment patterns?"
- **Methodology**: Time-series analysis with seasonal load profiles

### 5. Geographic & Spatial Analysis
#### Urban vs. Rural Deployment
- **Question**: "How should deployment strategies differ between dense urban areas and rural communities?"
- **Data Requirements**: Population density, building types, grid infrastructure
- **Methodology**: Comparative scenario analysis with location-specific constraints

#### Cluster Development Strategies
- **Question**: "Should we focus on creating renewable clusters or distributed deployment?"
- **Methodology**: Spatial clustering analysis with infrastructure optimization

#### Transportation Integration
- **Question**: "How does electric vehicle charging infrastructure planning interact with renewable deployment?"
- **Data Requirements**: Traffic patterns, charging demand, grid capacity

### 6. Risk & Uncertainty Modeling
#### Sensitivity Analysis
- **Questions**:
- "How sensitive are our targets to changes in energy prices?"
- "What's the impact of varying PV cost reduction rates on deployment timelines?"

#### Extreme Weather Resilience
- **Question**: "How do grid reliability requirements affect renewable integration strategies?"
- **Data Requirements**: Weather patterns, outage history, resilience requirements

#### Market Volatility Scenarios
- **Question**: "How do gas price volatility scenarios impact the economics of renewable deployment?"

## Advanced Implementation Patterns

### Multi-Objective Optimization
```typescript
// Complex prioritization balancing multiple factors
registerPredicate('multiObjectivePrioritization', (building, context) => {
  const score = 
    (building.carbonSavingPotential * 0.4) +
    (building.fuelPovertyScore * 0.3) +
    (building.gridCapacityEfficiency * 0.2) +
    (building.communityImpact * 0.1);
  
  return score >= context.state.minScoreThreshold;
});
```

### Dynamic Policy Changes
```typescript
registerPredicate('policyEvolution', (building, context) => {
  const policies = context.state.activePolicies[context.year];
  
  if (policies.enabledBuildingTypes && 
      !policies.enabledBuildingTypes.includes(building.type)) {
    return false;
  }
  
  if (policies.minEfficiencyStandard) {
    return building.efficiencyRating >= policies.minEfficiencyStandard;
  }
  
  return true;
});
```

### Cross-Scenario Dependencies
```typescript
// Where one intervention enables others
const upgradeIntervention = new Intervention('Grid Upgrades', {
  upgrade: (building, context) => {
    // Mark areas as upgraded for subsequent interventions
    context.state.upgradedSubstations = context.state.upgradedSubstations || [];
    context.state.upgradedSubstations.push(building.substationId);
    return { upgraded: true, year: context.year };
  }
});

const enhancedPV = new Intervention('Enhanced PV Deployment', {
  filter: (building, context) => {
    // Only deploy in upgraded areas
    return context.state.upgradedSubstations?.includes(building.substationId);
  }
});
```

## Plugin Development Recommendations

## Built-in Preset Cookbook

The library now provides first-party preset registration via `installScenarioModellerPresets(...)`.
This section shows the minimum setup for each built-in preset predicate so scenario-modeller integrations can start quickly.

### One-Time Setup

```typescript
import {
  Intervention,
  arrayAdapter,
  installScenarioModellerPresets,
} from 'interactive-scenario-modeller';

const { predicates, pluginExports } = installScenarioModellerPresets({
  namespace: 'scenario',
  defaultMinScoreThreshold: 0.6,
});

const facet = arrayAdapter(buildings);
```

### 1) `budgetConstraint`

**Required state shape**

```typescript
context.state.budgetAllocation = {
  2026: 5_000_000,
  2027: 6_000_000,
};
context.state.budgetSpent = {
  2026: 1_250_000,
};
```

**Building fields used**

- `estimatedPVCost`

**Example intervention**

```typescript
const budgetIntervention = new Intervention('Budget-limited PV', {
  facet,
  startYear: 2026,
  endYear: 2027,
  filter: predicates.budgetConstraint,
  upgrade: (building, context) => {
    const cost = building.estimatedPVCost ?? 0;
    const y = context.year;
    context.state.budgetSpent = context.state.budgetSpent ?? {};
    context.state.budgetSpent[y] = (context.state.budgetSpent[y] ?? 0) + cost;
    return { installed: true, cost };
  },
});
```

### 2) `planningConstraint`

**Building fields used**

- `conservationArea`
- `listedStatus`

**Behavior**

- Blocks Grade II* buildings in conservation areas
- Blocks all conservation-area buildings before 2025

**Example intervention**

```typescript
const planningIntervention = new Intervention('Planning-aware PV', {
  facet,
  startYear: 2024,
  endYear: 2030,
  filter: predicates.planningConstraint,
  upgrade: () => ({ installed: true }),
});
```

### 3) `phasedRollout`

**Optional state shape**

```typescript
context.state.phaseStartYear = 2026;
context.state.phaseByYear = {
  2026: 1,
  2027: 2,
  2028: 3,
};
```

If `phaseByYear` is omitted, phase increases automatically by year since `phaseStartYear`.

**Building fields used**

- `priorityZone` (lower value = earlier rollout)

**Example intervention**

```typescript
const phasedIntervention = new Intervention('Phased rollout', {
  facet,
  startYear: 2026,
  endYear: 2030,
  filter: predicates.phasedRollout,
  upgrade: () => ({ installed: true }),
});
```

### 4) `multiObjectivePrioritization`

**Optional state shape**

```typescript
context.state.objectiveWeights = {
  carbonSavingPotential: 0.4,
  fuelPovertyScore: 0.3,
  gridCapacityEfficiency: 0.2,
  communityImpact: 0.1,
};
context.state.minScoreThreshold = 0.6;
```

**Building fields used**

- `carbonSavingPotential`
- `fuelPovertyScore`
- `gridCapacityEfficiency`
- `communityImpact`

**Example intervention**

```typescript
const multiObjectiveIntervention = new Intervention('Multi-objective targeting', {
  facet,
  startYear: 2026,
  endYear: 2030,
  filter: predicates.multiObjectivePrioritization,
  upgrade: () => ({ installed: true }),
});
```

### 5) `policyEvolution`

**Required state shape**

```typescript
context.state.activePolicies = {
  2026: {
    enabledBuildingTypes: ['residential', 'public'],
    minEfficiencyStandard: 60,
  },
  2027: {
    enabledBuildingTypes: ['residential', 'public', 'commercial'],
  },
};
```

**Building fields used**

- `type`
- `efficiencyRating`

**Example intervention**

```typescript
const policyIntervention = new Intervention('Policy-evolution PV', {
  facet,
  startYear: 2026,
  endYear: 2030,
  filter: predicates.policyEvolution,
  upgrade: () => ({ installed: true }),
});
```

### Plugin Export Form (Alternative)

If preferred, plugin export references can be used directly:

```typescript
const viaPluginExport = new Intervention('Plugin export example', {
  facet,
  startYear: 2026,
  endYear: 2026,
  filter: pluginExports.planningConstraint,
  upgrade: () => ({ installed: true }),
});
```

This is useful when scenario definitions are persisted as string references.

### Financial Upgrade Plugin: Budget Spend Tracker

Use the upgrade plugin when spend updates should be centralized and reused.

```typescript
import {
  createBudgetSpendTrackerPlugin,
  registerPlugin,
  Intervention,
} from 'interactive-scenario-modeller';

registerPlugin(createBudgetSpendTrackerPlugin({
  name: 'financial-budget-spend-tracker',
}));

const budgetUpgrade = new Intervention('Budget spend tracking', {
  facet,
  startYear: 2026,
  endYear: 2026,
  filter: predicates.budgetConstraint,
  upgrade: 'financial-budget-spend-tracker:upgrade',
  init: (context) => {
    context.state.budgetSpent = { 2026: 0 };
    context.state.budgetAllocation = { 2026: 10_000_000 };
  },
});
```

**Default behavior**

- Reads building cost from `estimatedPVCost`
- Updates `context.state.budgetSpent[year]`
- Returns upgrade metrics: `cost`, `cumulativeCost`, `year`

**Custom mapping options**

- `costField`
- `budgetSpentKey`
- `outputCostKey`
- `outputCumulativeCostKey`
- `outputYearKey`

### Financial Upgrade Plugin: Financing Model (Cash/Lease/PPA)

Use the financing plugin to standardize annual payment and NPV outputs across models.

```typescript
import {
  createFinancingModelPlugin,
  registerPlugin,
  Intervention,
} from 'interactive-scenario-modeller';

registerPlugin(createFinancingModelPlugin({
  name: 'financial-financing-model',
}));

const financingIntervention = new Intervention('Financing comparison', {
  facet,
  startYear: 2026,
  endYear: 2026,
  filter: () => true,
  upgrade: 'financial-financing-model:upgrade',
  init: (context) => {
    context.state.financing = {
      modelType: 'lease',
      interestRate: 0.05,
      discountRate: 0.035,
      termYears: 20,
      escalationRate: 0,
    };
  },
});
```

**Supported model types**

- `cash`: one-off payment, `annualPayment = capex`, `npvCost = capex`
- `lease`: annuity-based annual payment, discounted to NPV over term
- `ppa`: annual payment from generation × tariff, discounted to NPV over term

**Default state/field lookup**

- Building capex field: `estimatedPVCost`
- State scenario key: `context.state.financing`
- Building scenario override field: `building.financing`

**Standard output metrics**

- `annualPayment`
- `npvCost`
- `modelType`

All output keys can be remapped via plugin options.

### Social Constraint Plugin: Fuel Poverty Priority

Use this plugin to target buildings by a weighted blend of fuel poverty and carbon impact.

```typescript
import {
  createFuelPovertyPriorityPlugin,
  registerPlugin,
  Intervention,
} from 'interactive-scenario-modeller';

registerPlugin(createFuelPovertyPriorityPlugin({
  name: 'social-fuel-poverty-priority',
  threshold: 0.6,
}));

const socialIntervention = new Intervention('Fuel poverty targeting', {
  facet,
  startYear: 2026,
  endYear: 2026,
  filter: 'social-fuel-poverty-priority:constraint',
  init: (context) => {
    context.state.fuelPovertyPriority = {
      threshold: 0.55,
      weights: {
        fuelPovertyScore: 0.7,
        carbonSavingPotential: 0.3,
      },
    };
  },
  upgrade: () => ({ installed: true }),
});
```

**Default building fields**

- `fuelPovertyScore`
- `carbonSavingPotential`

**State override key**

- `context.state.fuelPovertyPriority`
  - `threshold`
  - `weights.fuelPovertyScore`
  - `weights.carbonSavingPotential`

All field names and state key are configurable via plugin options.

### Policy Constraint Plugin: Timeline Validator

Use this plugin to validate policy timeline shape before running full scenario execution.

```typescript
import {
  createPolicyTimelineValidatorPlugin,
  registerPlugin,
  Intervention,
} from 'interactive-scenario-modeller';

registerPlugin(createPolicyTimelineValidatorPlugin({
  name: 'policy-timeline-validator',
  strictCoverage: true,
}));

const policyValidationIntervention = new Intervention('Policy validation gate', {
  facet,
  startYear: 2026,
  endYear: 2028,
  filter: 'policy-timeline-validator:constraint',
  init: (context) => {
    context.state.activePolicies = {
      2026: { enabledBuildingTypes: ['residential'], minEfficiencyStandard: 60 },
      2027: { enabledBuildingTypes: ['residential', 'public'] },
      2028: { enabledBuildingTypes: ['residential', 'public', 'commercial'] },
    };

    // Required when strictCoverage=true
    context.state.requiredPolicyYears = [2026, 2027, 2028];
  },
  upgrade: () => ({ validated: true }),
});
```

**Validated fields**

- Timeline key (`activePolicies` by default) must be an object keyed by year
- `enabledBuildingTypes` must be an array of strings
- `minEfficiencyStandard` must be a finite number
- Optional strict coverage check for required years

### Grid Constraint Plugin: Substation Capacity Gate

Use this plugin to block upgrades when projected substation load exceeds configured capacity.

```typescript
import {
  createSubstationCapacityGatePlugin,
  registerPlugin,
  Intervention,
} from 'interactive-scenario-modeller';

registerPlugin(createSubstationCapacityGatePlugin({
  name: 'grid-substation-capacity-gate',
}));

const capacityIntervention = new Intervention('Substation gate', {
  facet,
  startYear: 2026,
  endYear: 2028,
  filter: 'grid-substation-capacity-gate:constraint',
  init: (context) => {
    // Flat form: same capacity every year
    context.state.substationCapacities = {
      S1: 100,
      S2: 80,
    };

    // Alternative yearly form:
    // context.state.substationCapacities = {
    //   2026: { S1: 90, S2: 70 },
    //   2027: { S1: 100, S2: 80 },
    //   2028: { S1: 110, S2: 90 },
    // };
  },
  upgrade: () => ({ installed: true }),
});
```

**Default building fields**

- `substationId`
- `projectedDemandIncreaseKw`

**State keys**

- `substationCapacities` (required unless `strictMissingCapacity=false`)
- `substationLoads` (written by plugin per year/substation)

Field names and state keys are configurable via plugin options.

### Grid/System Constraint Plugin: Sequential Enablement

Use this plugin to allow intervention B only when intervention A has already completed.

```typescript
import {
  createSequentialEnablementPlugin,
  registerPlugin,
  Intervention,
} from 'interactive-scenario-modeller';

registerPlugin(createSequentialEnablementPlugin({
  name: 'grid-sequential-enablement',
}));

const dependentIntervention = new Intervention('Dependent rollout', {
  facet,
  startYear: 2027,
  endYear: 2027,
  filter: 'grid-sequential-enablement:constraint',
  init: (context) => {
    context.state.completedInterventionsByName = {
      'grid-upgrade-phase-1': {
        'UPRN-1': true,
        'UPRN-2': true,
      },
    };
  },
  upgrade: () => ({ enabled: true }),
});
```

**Default building fields**

- `requiresIntervention` (string or string[])
- `completedInterventions` (array or object map)

**Default state key**

- `completedInterventionsByName[interventionName][buildingId]`

All field names and state keys are configurable via plugin options.

### One-Call Plugin Bundle Installation

If scenario apps need a standard stack quickly, install bundled plugins in one step:

```typescript
import {
  installAllPlugins,
  Intervention,
} from 'interactive-scenario-modeller';

const bundles = installAllPlugins();

const intervention = new Intervention('Bundle-based scenario', {
  facet,
  startYear: 2026,
  endYear: 2026,
  filter: bundles.grid.substationCapacityGate.exportRef,
  upgrade: bundles.financial.budgetSpendTracker.exportRef,
});
```

Bundle installers available:

- `installFinancialPlugins`
- `installSocialPlugins`
- `installPolicyPlugins`
- `installGridPlugins`
- `installAllPlugins`

### Scenario Template Helper (Bundles + Defaults)

Use `createScenarioTemplate` to combine plugin bundle installation with reusable state defaults for intervention `init` hooks.

```typescript
import {
  createScenarioTemplate,
  Intervention,
} from 'interactive-scenario-modeller';

const template = createScenarioTemplate({
  stateDefaults: {
    substationCapacities: { S1: 100, S2: 80 },
    budgetAllocation: { 2026: 5_000_000 },
  },
});

const intervention = new Intervention('Template-driven scenario', {
  facet,
  startYear: 2026,
  endYear: 2026,
  init: template.withInit((context) => {
    context.state.budgetSpent = { 2026: 0 };
  }),
  filter: template.pluginRefs!.grid.substationCapacityGate.exportRef,
  upgrade: template.pluginRefs!.financial.budgetSpendTracker.exportRef,
});
```

Template outputs:

- `pluginRefs` (bundle export refs)
- `init(context)`
- `withInit(afterInit)`
- `applyStateDefaults(state)`

### Optimization Plugins: Target and Prioritisation

Use optimization plugins for cost-benefit ranking, target-gating, and top-percent targeting.

```typescript
import {
  createCostBenefitPrioritiserPlugin,
  createCarbonTargetConstraintPlugin,
  createTopPercentPotentialPlugin,
  registerPlugin,
  Intervention,
} from 'interactive-scenario-modeller';

registerPlugin(createCostBenefitPrioritiserPlugin({
  name: 'optimization-cost-benefit-prioritiser',
}));
registerPlugin(createCarbonTargetConstraintPlugin({
  name: 'optimization-carbon-target-constraint',
}));
registerPlugin(createTopPercentPotentialPlugin({
  name: 'optimization-top-percent-potential',
  percentile: 0.01,
}));

const optimizationIntervention = new Intervention('Targeted rollout', {
  facet,
  startYear: 2026,
  endYear: 2026,
  init: (context) => {
    context.state.carbonTargetByYear = { 2026: 5_000 };
    context.state.currentCarbonReducedByYear = { 2026: 0 };
  },
  filter: 'optimization-carbon-target-constraint:constraint',
  prioritise: 'optimization-cost-benefit-prioritiser:prioritise',
  upgrade: (building, context) => {
    const reduced = building.carbonReductionPotential ?? 0;
    context.state.currentCarbonReducedByYear[context.year] += reduced;
    return { carbonReduced: reduced };
  },
});
```

**Cost-Benefit Prioritiser defaults**

- Benefit field: `carbonSavingPotential`
- Cost field: `estimatedPVCost`

**Carbon Target Constraint defaults**

- Target state key: `carbonTargetByYear`
- Actual state key: `currentCarbonReducedByYear`

**Top-Percent Potential defaults**

- Rank field: `potentialRank`
- Rank count field: `potentialRankCount`

### Geographic Plugins: Clustering and Urban/Rural Strategy

Use geographic plugins for spatial deployment strategy and area-type preference.

```typescript
import {
  createSpatialClusterPrioritiserPlugin,
  createUrbanRuralStrategyPlugin,
  registerPlugin,
  Intervention,
} from 'interactive-scenario-modeller';

registerPlugin(createSpatialClusterPrioritiserPlugin({
  name: 'geographic-spatial-cluster-prioritiser',
}));

registerPlugin(createUrbanRuralStrategyPlugin({
  name: 'geographic-urban-rural-strategy',
  allowedAreaTypes: ['urban', 'rural'],
  preferAreaType: 'rural',
}));

const geographicIntervention = new Intervention('Geographic targeting', {
  facet,
  startYear: 2026,
  endYear: 2026,
  filter: 'geographic-urban-rural-strategy:constraint',
  prioritise: 'geographic-spatial-cluster-prioritiser:prioritise',
  upgrade: () => ({ installed: true }),
});
```

**Spatial Cluster Prioritiser defaults**

- `clusterDensity` (higher = more preferred)
- `infrastructureEfficiency` (higher = more preferred)

**Urban/Rural Strategy defaults**

- Area field: `areaType`
- State key: `urbanRuralStrategy`
- Supports:
  - `allowedAreaTypes`
  - `preferAreaType`

### Geographic Constraint Plugin: Region Budget Split

Use this plugin to enforce budget envelopes per region while running one scenario.

```typescript
import {
  createRegionBudgetSplitPlugin,
  registerPlugin,
  Intervention,
} from 'interactive-scenario-modeller';

registerPlugin(createRegionBudgetSplitPlugin({
  name: 'geographic-region-budget-split',
}));

const regionalBudgetIntervention = new Intervention('Regional budget rollout', {
  facet,
  startYear: 2026,
  endYear: 2028,
  filter: 'geographic-region-budget-split:constraint',
  init: (context) => {
    context.state.regionBudgetAllocation = {
      2026: { North: 2_000_000, South: 1_500_000 },
      2027: { North: 2_100_000, South: 1_600_000 },
      2028: { North: 2_200_000, South: 1_700_000 },
    };

    context.state.regionBudgetSpent = {
      2026: { North: 0, South: 0 },
      2027: { North: 0, South: 0 },
      2028: { North: 0, South: 0 },
    };
  },
  upgrade: () => ({ installed: true }),
});
```

**Defaults**

- Region field: `regionCode`
- Cost field: `estimatedPVCost`
- Allocation state key: `regionBudgetAllocation`
- Spent state key: `regionBudgetSpent`

Supports both flat allocations (`regionBudgetAllocation[region]`) and yearly allocations (`regionBudgetAllocation[year][region]`).

### Timeseries Constraint Plugin: Seasonal Demand Gate

Use this plugin to enforce seasonal demand limits per segment (e.g., substation/feeder).

```typescript
import {
  createSeasonalDemandGatePlugin,
  registerPlugin,
  Intervention,
} from 'interactive-scenario-modeller';

registerPlugin(createSeasonalDemandGatePlugin({
  name: 'timeseries-seasonal-demand-gate',
}));

const seasonalIntervention = new Intervention('Seasonal demand rollout', {
  facet,
  startYear: 2026,
  endYear: 2028,
  init: (context) => {
    context.state.seasonByYear = {
      2026: 'winter',
      2027: 'summer',
      2028: 'winter',
    };

    context.state.seasonalDemandCapacity = {
      2026: { winter: { S1: 120, S2: 90 } },
      2027: { summer: { S1: 140, S2: 100 } },
      2028: { winter: { S1: 130, S2: 95 } },
    };
  },
  filter: 'timeseries-seasonal-demand-gate:constraint',
  upgrade: () => ({ installed: true }),
});
```

**Defaults**

- Season state key: `seasonByYear[year]`
- Segment field: `substationId`
- Demand field: `projectedDemandIncreaseKw`
- Capacity state key: `seasonalDemandCapacity`
- Load state key: `seasonalDemandLoad`

Supports `year -> season -> segment` capacity maps and flat segment fallback.

### Timeseries Prioritiser Plugin: Load Profile Scoring

Use this prioritiser to rank candidates by contribution to peak reduction and demand flexibility.

```typescript
import {
  createLoadProfileScoringPlugin,
  registerPlugin,
  Intervention,
} from 'interactive-scenario-modeller';

registerPlugin(createLoadProfileScoringPlugin({
  name: 'timeseries-load-profile-scoring',
}));

const loadProfileIntervention = new Intervention('Load-profile prioritised rollout', {
  facet,
  startYear: 2026,
  endYear: 2026,
  filter: () => true,
  prioritise: 'timeseries-load-profile-scoring:prioritise',
  upgrade: () => ({ installed: true }),
});
```

**Defaults**

- `peakReductionPotential` (weight default 0.5)
- `loadShiftPotential` (weight default 0.3)
- `flexibilityScore` (weight default 0.2)

Override weights via `context.state.loadProfileWeights`.

### Timeseries Upgrade Plugin: Technology Coupling

Use this upgrade plugin to model how battery and heat-pump uptake modifies demand and carbon effects.

```typescript
import {
  createTechnologyCouplingPlugin,
  registerPlugin,
  Intervention,
} from 'interactive-scenario-modeller';

registerPlugin(createTechnologyCouplingPlugin({
  name: 'timeseries-technology-coupling',
}));

const couplingIntervention = new Intervention('Technology-coupled rollout', {
  facet,
  startYear: 2026,
  endYear: 2026,
  init: (context) => {
    context.state.technologyCoupling = {
      batteryAdoptionRate: 0.35,
      heatPumpAdoptionRate: 0.25,
      batteryDemandReductionFactor: 0.25,
      heatPumpDemandIncreaseFactor: 0.35,
      batteryCarbonBoostFactor: 0.1,
      heatPumpCarbonPenaltyFactor: 0.05,
    };
  },
  filter: () => true,
  upgrade: 'timeseries-technology-coupling:upgrade',
});
```

**Outputs**

- `adjustedDemandIncreaseKw`
- `adjustedCarbonSavingPotential`
- `batteryAdoption`
- `heatPumpAdoption`

Building-level adoption fields can override state defaults.

### Risk Helpers: Sensitivity and Monte Carlo

Use helper utilities to compare uncertainty scenarios without manual boilerplate.

```typescript
import {
  runSensitivityAnalysis,
  runMonteCarloAnalysis,
  Intervention,
} from 'interactive-scenario-modeller';

const sensitivity = runSensitivityAnalysis({
  parameters: [
    { key: 'budgetAllocation.2026', values: [2_000_000, 3_000_000] },
    { key: 'minScoreThreshold', values: [0.55, 0.65] },
  ],
  createIntervention: () => new Intervention('Sensitivity run', {
    facet,
    startYear: 2026,
    endYear: 2026,
    filter: predicates.multiObjectivePrioritization,
    upgrade: () => ({ installed: true }),
  }),
});

const monteCarlo = runMonteCarloAnalysis({
  runs: 100,
  createIntervention: () => new Intervention('Monte Carlo run', {
    facet,
    startYear: 2026,
    endYear: 2026,
    filter: () => true,
    upgrade: () => ({ installed: true }),
  }),
  sampleState: ({ seed }) => ({
    priceMultiplier: 0.9 + (seed % 20) / 100,
  }),
});
```

Both helpers return scenario/run summaries and can optionally include raw simulation outputs.

### 1. Budget Management Module
- Annual budget allocation interface
- Cost tracking and reporting
- Multi-year financial planning tools

### 2. Policy Simulation Framework
- Policy timeline editor
- Impact assessment tools
- Compliance tracking

### 3. Geographic Analysis Tools
- Interactive mapping interface
- Spatial clustering algorithms
- Regional comparison tools

### 4. Risk Assessment Dashboard
- Sensitivity analysis visualization
- Monte Carlo simulation integration
- Scenario comparison metrics

### 5. Stakeholder Engagement Module
- Community impact assessment
- Public consultation scenario planning
- Communication report generation

## Data Integration Requirements

### Essential Data Sources
1. **Building Stock Data**: UPRN, coordinates, energy consumption, building characteristics
2. **Infrastructure Data**: Grid capacity, substation locations, network topology
3. **Financial Data**: Installation costs, energy prices, budget allocations
4. **Policy Data**: Regulations, incentives, planning constraints
5. **Demographic Data**: Population, income levels, deprivation indices

### Optional Enrichment Data
1. **Weather Data**: Solar irradiance, temperature, wind patterns
2. **Transportation Data**: Traffic patterns, EV adoption rates
3. **Economic Data**: Employment rates, business types, industrial energy use
4. **Environmental Data**: Air quality, green spaces, flood risk

## Success Metrics & KPIs

### Technical Metrics
- Renewable capacity installed (MW)
- Energy generated (MWh/year)
- Carbon emissions reduced (tCO2/year)
- Grid utilization efficiency (%)

### Financial Metrics
- Investment required (£)
- Cost per ton of CO2 reduced (£/tCO2)
- Payback period (years)
- Lifetime savings (£)

### Social Metrics
- Households benefiting from lower energy bills
- Fuel poverty reduction
- Community energy projects initiated
- Local employment created

### Operational Metrics
- Grid stability improvements
- Peak demand reduction
- System resilience scores
- Maintenance requirements

This comprehensive use case framework enables the interactive-sm library to address diverse decarbonisation planning scenarios while maintaining flexibility for custom requirements and emerging challenges.