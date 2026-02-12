import { Intervention, arrayAdapter, createScenarioTemplate } from '../../src';

const template = createScenarioTemplate({
  stateDefaults: {
    budgetAllocation: { 2026: 300, 2027: 300 },
    substationCapacities: { S1: 60 },
  },
});

const facet = arrayAdapter([
  { uprn: 'A', estimatedPVCost: 100, projectedDemandIncreaseKw: 30, substationId: 'S1' },
  { uprn: 'B', estimatedPVCost: 120, projectedDemandIncreaseKw: 40, substationId: 'S1' },
  { uprn: 'C', estimatedPVCost: 90, projectedDemandIncreaseKw: 20, substationId: 'S1' },
]);

const intervention = new Intervention('Browser Scenario Demo', {
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

const app = document.getElementById('app');
if (!app) {
  throw new Error('Expected #app element');
}

const rows = Object.keys(result.metrics)
  .sort()
  .map((year) => {
    const selected = result.metrics[year].map((entry) => String(entry.building)).join(', ');
    const budgetSpent = result.state.budgetSpent?.[year] ?? 0;
    const loads = result.state.substationLoads?.[year] ?? {};
    const substationSummary = Object.entries(loads)
      .map(([substation, load]) => `${substation}: ${load}`)
      .join(' | ');

    return `<tr>
      <td>${year}</td>
      <td>${selected || '-'}</td>
      <td>${budgetSpent}</td>
      <td>${substationSummary || '-'}</td>
    </tr>`;
  })
  .join('');

app.innerHTML = `
  <table border="1" cellpadding="6" cellspacing="0">
    <thead>
      <tr>
        <th>Year</th>
        <th>Selected Buildings</th>
        <th>Budget Spent</th>
        <th>Substation Loads</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
`;
