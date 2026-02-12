import { describe, it, expect } from 'vitest';
import {
  arrayAdapter,
  createSpatialClusterPrioritiserPlugin,
  createUrbanRuralStrategyPlugin,
  installGeographicPlugins,
  Intervention,
  registerPlugin,
} from '../src';

describe('Geographic plugins', () => {
  it('spatial cluster prioritiser orders by density and efficiency', () => {
    const pluginName = `geo-cluster-${Date.now()}`;
    registerPlugin(createSpatialClusterPrioritiserPlugin({ name: pluginName }));

    const facet = arrayAdapter([
      { uprn: 'a', clusterDensity: 0.8, infrastructureEfficiency: 0.2 },
      { uprn: 'b', clusterDensity: 0.4, infrastructureEfficiency: 0.9 },
      { uprn: 'c', clusterDensity: 0.9, infrastructureEfficiency: 0.8 },
    ]);

    const intervention = new Intervention('geo-prior', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: () => true,
      prioritise: `${pluginName}:prioritise`,
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();
    const order = result.metrics['2026'].map((entry) => String(entry.building));

    expect(order).toEqual(['c', 'a', 'b']);
  });

  it('urban/rural strategy can constrain and prefer area types', () => {
    const pluginName = `geo-strategy-${Date.now()}`;
    registerPlugin(
      createUrbanRuralStrategyPlugin({
        name: pluginName,
        allowedAreaTypes: ['urban', 'rural'],
        preferAreaType: 'rural',
      }),
    );

    const facet = arrayAdapter([
      { uprn: 'u1', areaType: 'urban' },
      { uprn: 'r1', areaType: 'rural' },
      { uprn: 'x1', areaType: 'suburban' },
    ]);

    const intervention = new Intervention('geo-strategy', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: `${pluginName}:constraint`,
      prioritise: `${pluginName}:prioritise`,
      init: (context) => {
        context.state.urbanRuralStrategy = {
          allowedAreaTypes: ['urban', 'rural'],
          preferAreaType: 'rural',
        };
      },
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();
    const selected = result.metrics['2026'].map((entry) => String(entry.building));

    expect(selected).toEqual(['r1', 'u1']);
  });

  it('geographic bundle installer returns export refs', () => {
    const suffix = Date.now();
    const refs = installGeographicPlugins({
      spatialClusterPrioritiser: { name: `bundle-geo-cluster-${suffix}` },
      urbanRuralStrategy: { name: `bundle-geo-strategy-${suffix}` },
    });

    expect(refs.spatialClusterPrioritiser.exportRef).toBe(`bundle-geo-cluster-${suffix}:prioritise`);
    expect(refs.urbanRuralStrategyConstraint.exportRef).toBe(`bundle-geo-strategy-${suffix}:constraint`);
    expect(refs.urbanRuralStrategyPrioritiser.exportRef).toBe(`bundle-geo-strategy-${suffix}:prioritise`);
  });
});
