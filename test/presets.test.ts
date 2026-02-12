import { describe, it, expect } from 'vitest';
import {
  arrayAdapter,
  getPlugin,
  getPredicate,
  installScenarioModellerPresets,
  Intervention,
} from '../src';

describe('Scenario modeller presets', () => {
  it('registers namespaced predicates and core plugin', () => {
    const namespace = `scenario-test-${Date.now()}`;
    const result = installScenarioModellerPresets({ namespace });

    expect(result.predicates.budgetConstraint).toBe(`${namespace}:budgetConstraint`);
    expect(typeof getPredicate(result.predicates.budgetConstraint)).toBe('function');
    expect(typeof getPredicate(result.predicates.policyEvolution)).toBe('function');

    const plugins = [
      `${namespace}-budget-constraint`,
      `${namespace}-planning-constraint`,
      `${namespace}-phased-rollout`,
      `${namespace}-multi-objective`,
      `${namespace}-policy-evolution`,
    ];

    for (const pluginName of plugins) {
      const plugin = getPlugin(pluginName);
      expect(plugin?.manifest?.trusted).toBe(true);
      expect(typeof plugin?.constraint).toBe('function');
    }

    expect(result.pluginExports.budgetConstraint).toBe(`${namespace}-budget-constraint:constraint`);
    expect(result.pluginExports.planningConstraint).toBe(`${namespace}-planning-constraint:constraint`);
    expect(result.pluginExports.phasedRollout).toBe(`${namespace}-phased-rollout:constraint`);
    expect(result.pluginExports.multiObjectivePrioritization).toBe(`${namespace}-multi-objective:constraint`);
    expect(result.pluginExports.policyEvolution).toBe(`${namespace}-policy-evolution:constraint`);
  });

  it('resolves preset references through simulate()', () => {
    const namespace = `scenario-sim-${Date.now()}`;
    const { predicates, pluginExports } = installScenarioModellerPresets({ namespace });

    const facet = arrayAdapter([
      { uprn: 'ok-1', conservationArea: false, listedStatus: 'None' },
      { uprn: 'blocked-1', conservationArea: true, listedStatus: 'Grade II*' },
      { uprn: 'blocked-2', conservationArea: true, listedStatus: 'None' },
    ]);

    const byPredicate = new Intervention('predicate-constraint', {
      facet,
      startYear: 2024,
      endYear: 2024,
      filter: predicates.planningConstraint,
      upgrade: () => ({ installed: true }),
    });

    const byPluginExport = new Intervention('plugin-export-constraint', {
      facet,
      startYear: 2024,
      endYear: 2024,
      filter: pluginExports.planningConstraint,
      upgrade: () => ({ installed: true }),
    });

    const budgetFacet = arrayAdapter([
      { uprn: 'budget-ok', estimatedPVCost: 100 },
      { uprn: 'budget-blocked', estimatedPVCost: 1000 },
    ]);

    const byBudgetPluginExport = new Intervention('plugin-export-budget', {
      facet: budgetFacet,
      startYear: 2026,
      endYear: 2026,
      init: (context) => {
        context.state.budgetAllocation = { 2026: 500 };
        context.state.budgetSpent = { 2026: 0 };
      },
      filter: pluginExports.budgetConstraint,
      upgrade: () => ({ installed: true }),
    });

    const predicateResult = byPredicate.simulate();
    const pluginResult = byPluginExport.simulate();
    const budgetPluginResult = byBudgetPluginExport.simulate();

    expect(predicateResult.metrics['2024']).toHaveLength(1);
    expect(pluginResult.metrics['2024']).toHaveLength(1);
    expect(budgetPluginResult.metrics['2026']).toHaveLength(1);
    expect(predicateResult.metrics['2024'][0].building).toBe('ok-1');
    expect(pluginResult.metrics['2024'][0].building).toBe('ok-1');
    expect(budgetPluginResult.metrics['2026'][0].building).toBe('budget-ok');
  });
});
