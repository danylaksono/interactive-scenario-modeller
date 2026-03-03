# Multi-Criteria Decision Analysis (MCDA) & AHP in Scenario Modeller

The Scenario Modeller library is designed to natively support **MCDA** and **AHP** (Analytic Hierarchy Process) through its **Prioritise** stage. This guide explains how to leverage the built-in multi-criteria plugin to rank any spatial unit (buildings, parcels, H3 cells) based on weighted stakeholder preferences.

## 1. Core Concept: Ranking vs. Filtering

In a simulation, MCDA typically operates at the **Prioritise** stage. While **Filter** determines who is *eligible* (binary), **Prioritise** determines the *order* of merit (ranking).

- **Analytic Hierarchy Process (AHP)**: A method to derive weights from pairwise comparisons of criteria.
- **Weighted Sum Model (WSM)**: The actual math applied to each entity using those weights to calculate a "Priority Score."

## 2. Using the Multi-Criteria Plugin

The library provides a specialized plugin `createMultiCriteriaPrioritiserPlugin` designed for generality. It does not assume specific field names, making it compatible with any data schema.

### Basic Implementation

```typescript
import { createMultiCriteriaPrioritiserPlugin } from 'interactive-scenario-modeller';

const prioritiser = createMultiCriteriaPrioritiserPlugin({
  criteria: [
    { 
      name: 'carbon', 
      weight: 0.5, // Derived from AHP
      getValue: (e) => e.carbonPotential,
      direction: 1 // Higher is better
    },
    { 
      name: 'cost', 
      weight: 0.3, 
      getValue: (e) => e.estimatedCost,
      direction: -1 // Lower cost is better
    },
    { 
      name: 'equity', 
      weight: 0.2, 
      getValue: (e) => 10 - e.deprivationDecile
    }
  ]
});

const intervention = new Intervention('AHP-Driven Rollout', {
  prioritise: prioritiser.prioritise,
  // ...
});
```

## 3. Dynamic AHP Weights

One of the library's strengths is the ability to adjust weights mid-simulation. By default, the plugin looks at `context.state.mcdaWeights`.

### Year-by-Year Weight Steering

Scenario managers can shift priorities over time (e.g., focusing on early carbon wins, then shifting to equity later):

```typescript
const intervention = new Intervention('Steered Rollout', {
  prioritise: prioritiser.prioritise,
  initYear: (year, context) => {
    if (year >= 2030) {
      // Shift priority to equity after 2030
      context.state.mcdaWeights = {
        carbon: 0.2,
        cost: 0.2,
        equity: 0.6
      };
    }
  }
});
```

## 4. Domain Examples

### Urban Planning (Parcels)
Rank parcels for green infrastructure, balancing flood risk reduction, air quality improvement, and land cost.
- **Criteria**: `floodMitigation` (max), `pm25Reduction` (max), `landValue` (min).

### Public Health (LSOAs)
Rank neighborhoods for health program rollout, balancing infection rates and accessibility.
- **Criteria**: `prevalenceRate` (max), `distToClinic` (min), `avgAge` (max).

### Energy (H3 Cells)
Rank hexagonal cells for EV charging hubs based on proximity to main roads and existing grid headroom.
- **Criteria**: `distanceToA_Road` (min), `availableCapacity` (max), `trafficFlow` (max).

## 5. Technical Notes

- **Generality**: Always use functional `getValue` getters. Avoid hardcoding properties like `entity.cost`.
- **Normalization**: The standard Weighted Sum Model works best when values are on similar scales (e.g., 0-1 or 0-100). If your data units are drastically different (e.g., £Millions vs 0.1 Carbon), pre-normalize your data in the `FacetAdapter` or inside the `getValue` function.
- **Performance**: The plugin uses standard JavaScript `sort()`. For very large datasets (50k+ entities), ensure your `getValue` functions are optimized (e.g., O(1) property lookups).

---
*This document reflects the implementation as of version 0.1.0.*