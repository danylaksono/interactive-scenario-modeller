import {
  Intervention,
  arrayAdapter,
  installGridPlugins,
  installTransportPlugins,
} from "../src";

const grid = installGridPlugins({
  generationHeadroomAllocation: {
    name: "grid-generation-headroom-allocation-integrated-demo",
  },
  gridEnergyBalanceReporting: {
    name: "grid-energy-balance-reporting-integrated-demo",
  },
});

const transport = installTransportPlugins({
  evLoadInteraction: {
    name: "transport-ev-load-interaction-integrated-demo",
  },
  transportCorridorConstraint: {
    name: "transport-corridor-constraint-integrated-demo",
  },
});

const assetRows = [
  {
    uprn: "site-wind-1",
    technology: "wind",
    substationId: "S1",
    generationExportKw: 280,
    projectedDemandIncreaseKw: 25,
    stage: "generation",
  },
  {
    uprn: "site-pv-1",
    technology: "ground-mount-pv",
    substationId: "S1",
    generationExportKw: 240,
    projectedDemandIncreaseKw: 20,
    stage: "generation",
  },
  {
    uprn: "site-wind-2",
    technology: "wind",
    substationId: "S2",
    generationExportKw: 210,
    projectedDemandIncreaseKw: 20,
    stage: "generation",
  },
  {
    uprn: "site-retrofit-1",
    technology: "retrofit",
    substationId: "S1",
    generationExportKw: 0,
    projectedDemandIncreaseKw: 55,
    stage: "demand",
  },
  {
    uprn: "site-retrofit-2",
    technology: "retrofit",
    substationId: "S2",
    generationExportKw: 0,
    projectedDemandIncreaseKw: 45,
    stage: "demand",
  },
  {
    uprn: "site-retrofit-3",
    technology: "retrofit",
    substationId: "S2",
    generationExportKw: 0,
    projectedDemandIncreaseKw: 35,
    stage: "demand",
  },
  {
    uprn: "site-transport-1",
    technology: "ev-hub",
    substationId: "S1",
    transportCorridorId: "A34",
    chargingPointsProvided: 4,
    generationExportKw: 0,
    projectedDemandIncreaseKw: 15,
    evChargingDemandKw: 22,
    stage: "transport",
  },
  {
    uprn: "site-transport-2",
    technology: "ev-hub",
    substationId: "S2",
    transportCorridorId: "A34",
    chargingPointsProvided: 3,
    generationExportKw: 0,
    projectedDemandIncreaseKw: 12,
    evChargingDemandKw: 18,
    stage: "transport",
  },
  {
    uprn: "site-transport-3",
    technology: "ev-hub",
    substationId: "S2",
    transportCorridorId: "M3",
    chargingPointsProvided: 2,
    generationExportKw: 0,
    projectedDemandIncreaseKw: 10,
    evChargingDemandKw: 14,
    stage: "transport",
  },
];

const facet = arrayAdapter(assetRows);

let sharedState: Record<string, any> = {
  substationGenerationHeadroom: {
    2026: {
      S1: 500,
      S2: 260,
    },
  },
  substationCapacities: {
    2026: {
      S1: 210,
      S2: 170,
    },
  },
  evBaselineLoad: {
    2026: {
      S1: 80,
      S2: 65,
    },
  },
  corridorChargingRequirements: {
    2026: {
      A34: 8,
      M3: 4,
    },
  },
};

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

const generationStage = new Intervention("Stage 1: Allocate generation export headroom", {
  facet,
  startYear: 2026,
  endYear: 2026,
  init: (context) => {
    Object.assign(context.state, cloneState(sharedState));
  },
  finalise: (context) => {
    sharedState = cloneState(context.state);
  },
  filter: (building, context) => {
    if (building.stage !== "generation") return false;
    const gate = context.resolvePlugin(
      grid.generationHeadroomAllocation.name,
    )?.constraint;
    return gate ? gate(building, context) : false;
  },
  upgrade: grid.gridEnergyBalanceReporting.exportRef,
});

const demandStage = new Intervention("Stage 2: Apply demand-side upgrades", {
  facet,
  startYear: 2026,
  endYear: 2026,
  init: (context) => {
    Object.assign(context.state, cloneState(sharedState));
  },
  finalise: (context) => {
    sharedState = cloneState(context.state);
  },
  filter: (building) => building.stage === "demand",
  upgrade: grid.gridEnergyBalanceReporting.exportRef,
});

const transportStage = new Intervention("Stage 3: Apply EV transport interaction", {
  facet,
  startYear: 2026,
  endYear: 2026,
  init: (context) => {
    Object.assign(context.state, cloneState(sharedState));
  },
  finalise: (context) => {
    sharedState = cloneState(context.state);
  },
  filter: (building, context) => {
    if (building.stage !== "transport") return false;

    const evGate = context.resolvePlugin(transport.evLoadInteraction.name)?.constraint;
    const corridorGate = context.resolvePlugin(transport.transportCorridorConstraint.name)?.constraint;

    if (!evGate || !corridorGate) return false;

    return evGate(building, context) && corridorGate(building, context);
  },
  upgrade: grid.gridEnergyBalanceReporting.exportRef,
});

const results: Array<{ name: string; result: ReturnType<typeof generationStage.simulate> }> = [];

const generationResult = generationStage.simulate();
results.push({ name: generationStage.name, result: generationResult });

const demandResult = demandStage.simulate(generationResult.buildings);
results.push({ name: demandStage.name, result: demandResult });

const transportResult = transportStage.simulate(demandResult.buildings);
results.push({ name: transportStage.name, result: transportResult });

for (const entry of results) {
  const year = "2026";
  const selected = entry.result.metrics[year].map((item) => item.building);
  const balance = entry.result.state.gridEnergyBalance?.[2026];
  const allocated = entry.result.state.substationGenerationAllocated?.[2026] ?? {};

  console.log(`\n${entry.name}`);
  console.log("Selected assets:", selected);
  console.log("Generation allocated (kW):", allocated);
  console.log("Substation load incl. EV (kW):", entry.result.state.substationLoads?.[2026] ?? {});
  console.log("Energy balance:", {
    totalDemandKw: balance?.totalDemandKw ?? 0,
    totalGenerationKw: balance?.totalGenerationKw ?? 0,
    totalRequirementKw: balance?.totalRequirementKw ?? 0,
    remainingHeadroomKw: balance?.remainingHeadroomKw ?? 0,
  });
  console.log("By substation:", balance?.bySubstation ?? {});
}