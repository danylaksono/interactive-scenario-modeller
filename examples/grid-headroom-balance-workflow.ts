import {
  Intervention,
  arrayAdapter,
  installGridPlugins,
} from "../src";

const grid = installGridPlugins({
  generationHeadroomAllocation: {
    name: "grid-generation-headroom-allocation-demo",
  },
  gridEnergyBalanceReporting: {
    name: "grid-energy-balance-reporting-demo",
  },
});

const projects = [
  {
    uprn: "wind-farm-a",
    technology: "wind",
    substationId: "S1",
    generationExportKw: 300,
    projectedDemandIncreaseKw: 30,
  },
  {
    uprn: "ground-mount-pv-b",
    technology: "ground-mount-pv",
    substationId: "S1",
    generationExportKw: 250,
    projectedDemandIncreaseKw: 20,
  },
  {
    uprn: "wind-farm-c",
    technology: "wind",
    substationId: "S1",
    generationExportKw: 180,
    projectedDemandIncreaseKw: 15,
  },
  {
    uprn: "ground-mount-pv-d",
    technology: "ground-mount-pv",
    substationId: "S2",
    generationExportKw: 200,
    projectedDemandIncreaseKw: 25,
  },
  {
    uprn: "wind-farm-e",
    technology: "wind",
    substationId: "S2",
    generationExportKw: 170,
    projectedDemandIncreaseKw: 20,
  },
];

const facet = arrayAdapter(projects);

const intervention = new Intervention("Grid headroom + energy balance workflow", {
  facet,
  startYear: 2026,
  endYear: 2026,
  init: (context) => {
    context.state.substationGenerationHeadroom = {
      2026: {
        S1: 600,
        S2: 350,
      },
    };
  },
  filter: grid.generationHeadroomAllocation.exportRef,
  upgrade: grid.gridEnergyBalanceReporting.exportRef,
});

const result = intervention.simulate();
const year = "2026";

const selected = result.metrics[year].map((m) => m.building);
const allocated = result.state.substationGenerationAllocated?.[Number(year)] ?? {};
const balance = result.state.gridEnergyBalance?.[Number(year)] ?? {};

console.log("Selected generation projects:", selected);
console.log("Allocated generation export by substation:", allocated);
console.log("Grid energy balance summary:", {
  totalDemandKw: balance.totalDemandKw,
  totalGenerationKw: balance.totalGenerationKw,
  totalRequirementKw: balance.totalRequirementKw,
  remainingHeadroomKw: balance.remainingHeadroomKw,
});
console.log("Per-substation balance:", balance.bySubstation);