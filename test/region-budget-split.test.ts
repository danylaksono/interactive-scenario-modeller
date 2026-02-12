import { describe, it, expect } from 'vitest';
import {
  arrayAdapter,
  createRegionBudgetSplitPlugin,
  installGeographicPlugins,
  Intervention,
  registerPlugin,
} from '../src';

describe('Region budget split plugin', () => {
  it('enforces yearly regional budget envelopes', () => {
    const pluginName = `geo-region-budget-${Date.now()}`;
    registerPlugin(createRegionBudgetSplitPlugin({ name: pluginName }));

    const facet = arrayAdapter([
      { uprn: 'a', regionCode: 'R1', estimatedPVCost: 40 },
      { uprn: 'b', regionCode: 'R1', estimatedPVCost: 30 },
      { uprn: 'c', regionCode: 'R1', estimatedPVCost: 50 },
      { uprn: 'd', regionCode: 'R2', estimatedPVCost: 20 },
    ]);

    const intervention = new Intervention('region-budget-yearly', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: `${pluginName}:constraint`,
      init: (context) => {
        context.state.regionBudgetAllocation = {
          2026: {
            R1: 80,
            R2: 30,
          },
        };
        context.state.regionBudgetSpent = {
          2026: {
            R1: 0,
            R2: 0,
          },
        };
      },
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();
    const selected = result.metrics['2026'].map((entry) => String(entry.building));

    expect(selected).toEqual(['a', 'b', 'd']);
  });

  it('supports flat regional budget allocations', () => {
    const pluginName = `geo-region-flat-${Date.now()}`;
    registerPlugin(createRegionBudgetSplitPlugin({ name: pluginName }));

    const facet = arrayAdapter([
      { uprn: 'x', regionCode: 'North', estimatedPVCost: 60 },
      { uprn: 'y', regionCode: 'North', estimatedPVCost: 50 },
    ]);

    const intervention = new Intervention('region-budget-flat', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: `${pluginName}:constraint`,
      init: (context) => {
        context.state.regionBudgetAllocation = {
          North: 100,
        };
        context.state.regionBudgetSpent = {
          2026: {
            North: 0,
          },
        };
      },
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();
    const selected = result.metrics['2026'].map((entry) => String(entry.building));

    expect(selected).toEqual(['x']);
  });

  it('geographic installer exposes region budget export ref', () => {
    const suffix = Date.now();
    const refs = installGeographicPlugins({
      regionBudgetSplit: {
        name: `bundle-geo-region-budget-${suffix}`,
      },
    });

    expect(refs.regionBudgetSplit.exportRef).toBe(`bundle-geo-region-budget-${suffix}:constraint`);
  });
});
