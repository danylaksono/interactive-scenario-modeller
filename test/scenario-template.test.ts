import { describe, it, expect } from 'vitest';
import {
  arrayAdapter,
  createScenarioTemplate,
  Intervention,
} from '../src';

describe('Scenario template helper', () => {
  it('installs plugin bundles and exposes export refs', () => {
    const suffix = Date.now();
    const template = createScenarioTemplate({
      pluginOptions: {
        financial: {
          budgetSpendTracker: { name: `tmpl-budget-${suffix}` },
          financingModel: { name: `tmpl-financing-${suffix}` },
        },
        social: {
          fuelPovertyPriority: { name: `tmpl-social-${suffix}` },
        },
        policy: {
          policyTimelineValidator: { name: `tmpl-policy-${suffix}` },
        },
        grid: {
          substationCapacityGate: { name: `tmpl-grid-cap-${suffix}` },
          sequentialEnablement: { name: `tmpl-grid-seq-${suffix}` },
        },
      },
    });

    expect(template.pluginRefs?.financial.budgetSpendTracker.exportRef).toBe(
      `tmpl-budget-${suffix}:upgrade`,
    );
    expect(template.pluginRefs?.grid.substationCapacityGate.exportRef).toBe(
      `tmpl-grid-cap-${suffix}:constraint`,
    );
  });

  it('applies defaults without overwriting preexisting state values', () => {
    const template = createScenarioTemplate({
      installPlugins: false,
      stateDefaults: {
        financing: {
          modelType: 'lease',
        },
        budgetAllocation: {
          2026: 1000,
        },
      },
    });

    const state: Record<string, any> = {
      financing: {
        modelType: 'ppa',
        discountRate: 0.04,
      },
      budgetAllocation: {
        2026: 500,
      },
    };

    template.applyStateDefaults(state);

    expect(state.financing.modelType).toBe('ppa');
    expect(state.financing.discountRate).toBe(0.04);
    expect(state.financing.termYears).toBe(20);
    expect(state.budgetAllocation[2026]).toBe(500);
  });

  it('works as intervention init hook with bundle refs', () => {
    const suffix = Date.now();
    const template = createScenarioTemplate({
      pluginOptions: {
        financial: {
          budgetSpendTracker: { name: `tmpl2-budget-${suffix}` },
        },
        grid: {
          substationCapacityGate: { name: `tmpl2-grid-cap-${suffix}` },
        },
      },
      stateDefaults: {
        substationCapacities: {
          S1: 50,
        },
      },
    });

    const facet = arrayAdapter([
      { uprn: 'a', substationId: 'S1', projectedDemandIncreaseKw: 30, estimatedPVCost: 100 },
      { uprn: 'b', substationId: 'S1', projectedDemandIncreaseKw: 30, estimatedPVCost: 100 },
    ]);

    const intervention = new Intervention('template-intervention', {
      facet,
      startYear: 2026,
      endYear: 2026,
      init: template.withInit((context) => {
        context.state.budgetSpent = { 2026: 0 };
      }),
      filter: template.pluginRefs!.grid.substationCapacityGate.exportRef,
      upgrade: template.pluginRefs!.financial.budgetSpendTracker.exportRef,
    });

    const result = intervention.simulate();

    expect(result.metrics['2026']).toHaveLength(1);
    expect(result.metrics['2026'][0].building).toBe('a');
    expect(result.state.substationLoads[2026].S1).toBe(30);
    expect(result.state.budgetSpent[2026]).toBe(100);
  });
});
