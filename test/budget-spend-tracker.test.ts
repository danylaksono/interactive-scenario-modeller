import { describe, it, expect } from 'vitest';
import {
  arrayAdapter,
  createBudgetSpendTrackerPlugin,
  getPlugin,
  Intervention,
  registerPlugin,
} from '../src';

describe('Budget spend tracker plugin', () => {
  it('updates yearly spend and returns upgrade metrics', () => {
    const pluginName = `financial-budget-${Date.now()}`;
    const plugin = createBudgetSpendTrackerPlugin({ name: pluginName });
    registerPlugin(plugin);

    const resolved = getPlugin(pluginName);
    expect(resolved?.manifest.kind).toEqual(['upgrade']);
    expect(typeof resolved?.upgrade).toBe('function');

    const facet = arrayAdapter([
      { uprn: 'a', estimatedPVCost: 100 },
      { uprn: 'b', estimatedPVCost: 200 },
    ]);

    const intervention = new Intervention('budget-upgrade', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: () => true,
      upgrade: `${pluginName}:upgrade`,
      init: (context) => {
        context.state.budgetSpent = { 2026: 50 };
      },
    });

    const result = intervention.simulate();
    const metrics = result.metrics['2026'];

    expect(metrics).toHaveLength(2);
    expect(metrics[0].stats.cost).toBe(100);
    expect(metrics[0].stats.cumulativeCost).toBe(150);
    expect(metrics[1].stats.cost).toBe(200);
    expect(metrics[1].stats.cumulativeCost).toBe(350);
    expect(result.state.budgetSpent[2026]).toBe(350);
  });

  it('supports custom field mapping', () => {
    const pluginName = `financial-budget-custom-${Date.now()}`;
    registerPlugin(
      createBudgetSpendTrackerPlugin({
        name: pluginName,
        costField: 'capexGBP',
        budgetSpentKey: 'capitalSpent',
        outputCostKey: 'spentGBP',
        outputCumulativeCostKey: 'cumulativeSpentGBP',
      }),
    );

    const facet = arrayAdapter([
      { uprn: 'x', capexGBP: '300' },
      { uprn: 'y', capexGBP: 50 },
    ]);

    const intervention = new Intervention('budget-upgrade-custom', {
      facet,
      startYear: 2027,
      endYear: 2027,
      filter: () => true,
      upgrade: `${pluginName}:upgrade`,
      init: (context) => {
        context.state.capitalSpent = { 2027: 25 };
      },
    });

    const result = intervention.simulate();
    const metrics = result.metrics['2027'];

    expect(metrics).toHaveLength(2);
    expect(metrics[0].stats.spentGBP).toBe(300);
    expect(metrics[0].stats.cumulativeSpentGBP).toBe(325);
    expect(metrics[1].stats.spentGBP).toBe(50);
    expect(metrics[1].stats.cumulativeSpentGBP).toBe(375);
    expect(result.state.capitalSpent[2027]).toBe(375);
  });
});
