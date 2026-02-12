# Substation Capacity Constraint Modeling

This document explains how the interactive-sm library can model scenarios where substation capacity limits renewable energy adoption, specifically addressing questions like "if 50% of this street adopts PV, the substation will fail, preventing further adoption."

## System Capabilities

The system supports complex conditional scenarios through:
- **Predicate system**: Customizable filter, prioritization, and upgrade logic
- **Simulation context**: Shared state across buildings and years
- **Sequential interventions**: Multiple phases building on previous results
- **Registry system**: Reusable constraint and upgrade functions

## Required Data

### 1. Substation Capacity Data
- **Format**: GeoJSON Voronoi polygons
- **Fields**: Primary, secondary, BSP, GSP identifiers
- **Purpose**: Track electrical capacity constraints per geographic area

```typescript
interface SubstationData {
  id: string;
  type: 'primary' | 'secondary' | 'bsp' | 'gsp';
  capacity: number; // MW
  geometry: GeoJSON.Polygon;
}
```

### 2. Building Stock Data
- **Join fields**: Substation ID references for each hierarchy level
- **Location**: Latitude and longitude coordinates
- **PV metrics**: Annual generation potential, carbon savings, energy demand impact

```typescript
interface Building {
  uprn: string;
  lat: number;
  lng: number;
  substationId: {
    primary: string;
    secondary: string;
    bsp: string;
    gsp: string;
  };
  solarGenerationPotential: number; // MWh/year
  carbonSavingPotential: number; // tCO2/year
  energyDemandChange: number; // MWh/year
}
```

## Implementation Example

### 1. Register Substation Constraint

```typescript
// Register reusable substation capacity constraint
registerPredicate('substationCapacityConstraint', (building, context) => {
  const subId = building.substationId.primary; // Or secondary/bsp/gsp
  const substation = context.state.substations?.[subId];
  
  if (!substation) return true; // No constraint data = allow
  
  // Calculate current PV generation on this substation
  const currentPV = context.state.substationPV?.[subId] || 0;
  const buildingPotential = building.solarGenerationPotential / 8760; // Convert to MW
  
  // Check if adding this building would exceed capacity
  return (currentPV + buildingPotential) <= substation.capacity;
});
```

### 2. Track Adoption by Geography

```typescript
// Alternative: Street-level adoption tracking
registerPredicate('streetAdoptionConstraint', (building, context) => {
  const street = building.street;
  const streetStats = context.state.streetStats ||= {};
  
  // Initialize street data
  if (!streetStats[street]) {
    streetStats[street] = {
      totalBuildings: context.state.buildingCountPerStreet?.[street] || 0,
      withPV: 0
    };
  }
  
  // Check 50% adoption threshold
  const adoptionRate = streetStats[street].withPV / streetStats[street].totalBuildings;
  return adoptionRate < 0.5;
});
```

### 3. Create Intervention with Constraints

```typescript
const pvIntervention = new Intervention('Constrained PV Adoption', {
  facet: buildingData,
  startYear: 2020,
  endYear: 2030,
  
  // Apply capacity constraint
  filter: 'substationCapacityConstraint',
  
  // Prioritize by carbon savings
  prioritise: (b1, b2, context) => b2.carbonSavingPotential - b1.carbonSavingPotential,
  
  // Track adoption and metrics
  upgrade: (building, context) => {
    const subId = building.substationId.primary;
    
    // Update substation load tracking
    context.state.substationPV ||= {};
    context.state.substationPV[subId] = (context.state.substationPV[subId] || 0) + 
                                         (building.solarGenerationPotential / 8760);
    
    // Update street tracking
    const street = building.street;
    if (context.state.streetStats?.[street]) {
      context.state.streetStats[street].withPV++;
    }
    
    return {
      pvInstalled: true,
      year: context.year,
      annualGeneration: building.solarGenerationPotential,
      carbonSaving: building.carbonSavingPotential,
      demandImpact: building.energyDemandChange,
      substationId: subId,
      constrained: true
    };
  },
  
  // Initialize substation capacity data
  init: (context) => {
    context.state.substations = loadSubstationCapacityData();
    context.state.buildingCountPerStreet = calculateBuildingCountPerStreet();
  }
});
```

## Answerable Questions

With this setup, the system can answer questions like:

### Capacity Analysis
- "When will substation X reach 50% of its capacity?"
- "What's the maximum PV adoption possible under current grid constraints?"
- "Which substations are bottlenecking renewable adoption the most?"

### Geographic Analysis
- "What streets hit the 50% adoption threshold first?"
- "How does substation capacity vary across different regions?"
- "Which areas have the highest untapped solar potential?"

### Impact Assessment
- "What are the total carbon savings limited by grid capacity?"
- "How much additional generation could be unlocked with grid upgrades?"
- "What's the cost-benefit of substation upgrades vs. constrained adoption?"

### Scenario Planning
- "What if substation capacity increased by 20%?"
- "How does prioritizing by carbon savings vs. generation capacity change outcomes?"
- "What adoption rates are achievable with different grid upgrade timelines?"

## Multi-Scenario Modeling

Use `SimulationRunner` to compare different approaches:

```typescript
const runner = new SimulationRunner();

// Scenario 1: Current constraints
runner.add(pvIntervention);

// Scenario 2: Upgraded substations
const upgradedPV = pvIntervention.update({
  filter: (building, context) => {
    // Modified capacity with upgrades
    const substation = context.state.substations[building.substationId.primary];
    const currentPV = context.state.substationPV?.[building.substationId.primary] || 0;
    const buildingPotential = building.solarGenerationPotential / 8760;
    return (currentPV + buildingPotential) <= (substation.capacity * 1.2); // 20% upgrade
  }
});
runner.add(upgradedPV);

const results = runner.run();
// Compare outcomes between scenarios
```

## Data Flow

1. **Input**: Building stock + substation capacity GeoJSON
2. **Filter**: Check substation headroom for each building
3. **Prioritize**: Sort eligible buildings (by carbon savings, generation potential, etc.)
4. **Upgrade**: Install PV, update state tracking
5. **Metrics**: Track adoption, generation, carbon savings, constraints
6. **Output**: Constrained adoption patterns with capacity-limited results

The system provides a complete framework for modeling grid-constrained renewable energy adoption with detailed spatial and temporal resolution.