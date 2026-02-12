import { describe, it, expect } from 'vitest';
import {
  arrayAdapter,
  createFuelPovertyPriorityPlugin,
  getPlugin,
  Intervention,
  registerPlugin,
} from '../src';

describe('Fuel poverty priority plugin', () => {
  it('filters buildings using weighted default score', () => {
    const pluginName = `social-fuel-${Date.now()}`;
    registerPlugin(createFuelPovertyPriorityPlugin({ name: pluginName }));

    const plugin = getPlugin(pluginName);
    expect(plugin?.manifest.kind).toEqual(['constraint']);
    expect(typeof plugin?.constraint).toBe('function');

    const facet = arrayAdapter([
      { uprn: 'a', fuelPovertyScore: 0.9, carbonSavingPotential: 0.2 },
      { uprn: 'b', fuelPovertyScore: 0.2, carbonSavingPotential: 0.9 },
      { uprn: 'c', fuelPovertyScore: 0.3, carbonSavingPotential: 0.3 },
    ]);

    const intervention = new Intervention('fuel-poverty-default', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: `${pluginName}:constraint`,
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();
    const selected = result.metrics['2026'].map((m) => m.building);

    expect(selected).toEqual(['a']);
  });

  it('supports state-level threshold and weights override', () => {
    const pluginName = `social-fuel-overrides-${Date.now()}`;
    registerPlugin(
      createFuelPovertyPriorityPlugin({
        name: pluginName,
        threshold: 0.7,
      }),
    );

    const facet = arrayAdapter([
      { uprn: 'x', fuelPovertyScore: 0.95, carbonSavingPotential: 0.1 },
      { uprn: 'y', fuelPovertyScore: 0.35, carbonSavingPotential: 0.9 },
      { uprn: 'z', fuelPovertyScore: 0.4, carbonSavingPotential: 0.4 },
    ]);

    const intervention = new Intervention('fuel-poverty-overrides', {
      facet,
      startYear: 2027,
      endYear: 2027,
      filter: `${pluginName}:constraint`,
      init: (context) => {
        context.state.fuelPovertyPriority = {
          threshold: 0.6,
          weights: {
            fuelPovertyScore: 0.2,
            carbonSavingPotential: 0.8,
          },
        };
      },
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();
    const selected = result.metrics['2027'].map((m) => m.building);

    expect(selected).toEqual(['y']);
  });
});
