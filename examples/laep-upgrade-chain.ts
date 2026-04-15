/**
 * `upgradeChain`: first successful transform wins (non-empty delta).
 */
import { Intervention, arrayAdapter } from "../src";

const facet = arrayAdapter([
  { uprn: "hp-eligible", useHeatPump: true },
  { uprn: "dh-only", useHeatPump: false },
]);

const intervention = new Intervention("vector-chain", {
  facet,
  startYear: 2026,
  endYear: 2026,
  filter: () => true,
  prioritise: () => 0,
  upgradeChain: [
    (e) => ((e as { useHeatPump?: boolean }).useHeatPump ? { vector: "ashp", capexGbp: 8000 } : {}),
    () => ({ vector: "district_heating", capexGbp: 12000 }),
  ],
});

const { metrics } = intervention.simulate();
console.log(
  metrics["2026"].map((m) => ({
    entity: m.entity,
    vector: (m.stats as { vector?: string }).vector,
    capexGbp: (m.stats as { capexGbp?: number }).capexGbp,
  })),
);
