/**
 * LAEP-style sequencing: primary intervention (e.g. ASHP) with a substation gate,
 * then a second intervention on the same entity stock for an alternate vector where
 * the primary did not apply.
 */
import {
  SimulationRunner,
  Intervention,
  arrayAdapter,
  registerPlugin,
  createSubstationCapacityGatePlugin,
} from "../src";

const gateName = "laep-fallback-demo-gate";
registerPlugin(
  createSubstationCapacityGatePlugin({
    name: gateName,
    demandIncrementField: "projectedDemandIncreaseKw",
  }),
);

const facet = arrayAdapter([
  { uprn: "1", substationId: "S1", projectedDemandIncreaseKw: 30, alternateVectorAvailable: true },
  { uprn: "2", substationId: "S1", projectedDemandIncreaseKw: 80, alternateVectorAvailable: true },
  { uprn: "3", substationId: "S1", projectedDemandIncreaseKw: 20, alternateVectorAvailable: false },
]);

const primary = new Intervention("ashp-primary", {
  facet,
  startYear: 2026,
  endYear: 2026,
  init: (ctx) => {
    ctx.state.substationCapacities = { S1: 100 };
  },
  filter: `${gateName}:constraint`,
  prioritise: () => 0,
  upgrade: (e) => {
    (e as { laepPrimaryServed2026?: boolean }).laepPrimaryServed2026 = true;
    return { vector: "ashp" };
  },
});

const secondary = new Intervention("district-heat-fallback", {
  facet,
  startYear: 2026,
  endYear: 2026,
  init: (ctx) => {
    ctx.state.substationCapacities = { S1: 200 };
  },
  filter: (entity) => {
    const e = entity as { laepPrimaryServed2026?: boolean; alternateVectorAvailable?: boolean };
    return !e.laepPrimaryServed2026 && !!e.alternateVectorAvailable;
  },
  prioritise: () => 0,
  upgrade: () => ({ vector: "district_heating" }),
});

const runner = new SimulationRunner([primary, secondary]);
const results = runner.run();

for (const { name, result } of results) {
  const rows = result.metrics["2026"] ?? [];
  console.log(
    name,
    rows.length,
    rows.map((r) => ({ entity: r.entity, vector: (r.stats as { vector?: string }).vector })),
  );
}
