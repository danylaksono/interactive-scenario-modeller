import { Intervention, arrayAdapter, createScenarioTemplate } from "../src";

const template = createScenarioTemplate({
  stateDefaults: {
    budgetAllocation: { 2026: 300, 2027: 300 },
    substationCapacities: { S1: 60 },
    activePolicies: {
      2026: { enabledBuildingTypes: ["residential"] },
      2027: { enabledBuildingTypes: ["residential"] },
    },
  },
});

const facet = arrayAdapter([
  {
    uprn: "A",
    type: "residential",
    estimatedPVCost: 100,
    projectedDemandIncreaseKw: 30,
    substationId: "S1",
  },
  {
    uprn: "B",
    type: "residential",
    estimatedPVCost: 120,
    projectedDemandIncreaseKw: 40,
    substationId: "S1",
  },
  {
    uprn: "C",
    type: "residential",
    estimatedPVCost: 90,
    projectedDemandIncreaseKw: 20,
    substationId: "S1",
  },
]);

const intervention = new Intervention("Template demo", {
  facet,
  startYear: 2026,
  endYear: 2027,
  init: template.withInit((context) => {
    context.state.budgetSpent = { 2026: 0, 2027: 0 };
  }),
  filter: template.pluginRefs!.grid.substationCapacityGate.exportRef,
  upgrade: template.pluginRefs!.financial.budgetSpendTracker.exportRef,
});

const result = intervention.simulate();

console.log("Selected upgrades by year:");
for (const year of Object.keys(result.metrics)) {
  const selected = result.metrics[year].map((entry) => entry.building);
  console.log(`  ${year}:`, selected);
}

console.log("Budget spent:", result.state.budgetSpent);
console.log("Substation loads:", result.state.substationLoads);
