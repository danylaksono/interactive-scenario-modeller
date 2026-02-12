import { describe, it, expect } from 'vitest';
import {
  arrayAdapter,
  Intervention,
  runSensitivityAnalysis,
  runMonteCarloAnalysis,
} from '../src';

describe('Risk helpers', () => {
  it('runs sensitivity combinations and returns summaries', () => {
    const facet = arrayAdapter([
      { uprn: 'a', estimatedPVCost: 100 },
      { uprn: 'b', estimatedPVCost: 200 },
    ]);

    const scenarios = runSensitivityAnalysis({
      parameters: [
        { key: 'budgetAllocation.2026', values: [150, 300] },
        { key: 'minCost', values: [0, 150] },
      ],
      createIntervention: () =>
        new Intervention('sensitivity', {
          facet,
          startYear: 2026,
          endYear: 2026,
          filter: (building, context) => {
            const budget = context.state.budgetAllocation?.[2026] ?? 0;
            const minCost = context.state.minCost ?? 0;
            return building.estimatedPVCost <= budget && building.estimatedPVCost >= minCost;
          },
          upgrade: () => ({ selected: true }),
        }),
    });

    expect(scenarios).toHaveLength(4);
    expect(scenarios[0].summary.totalSelected).toBeTypeOf('number');

    const totals = scenarios.map((entry) => entry.summary.totalSelected);
    expect(Math.max(...totals)).toBeGreaterThanOrEqual(Math.min(...totals));
  });

  it('runs monte carlo analysis and aggregates totalSelected', () => {
    const facet = arrayAdapter([
      { uprn: 'x', score: 0.2 },
      { uprn: 'y', score: 0.8 },
    ]);

    const result = runMonteCarloAnalysis({
      runs: 5,
      createIntervention: () =>
        new Intervention('mc', {
          facet,
          startYear: 2026,
          endYear: 2026,
          filter: (building, context) => {
            const threshold = context.state.threshold ?? 0.5;
            return building.score >= threshold;
          },
          upgrade: () => ({ selected: true }),
        }),
      sampleState: ({ runIndex }) => ({
        threshold: runIndex % 2 === 0 ? 0.5 : 0.1,
      }),
    });

    expect(result.runs).toHaveLength(5);
    expect(result.aggregate.runs).toBe(5);
    expect(result.aggregate.totalSelected.max).toBeGreaterThanOrEqual(result.aggregate.totalSelected.min);
    expect(result.aggregate.totalSelected.mean).toBeGreaterThanOrEqual(result.aggregate.totalSelected.min);
  });
});
