import { describe, it, expect } from 'vitest';
import {
  arrayAdapter,
  createSeasonalDemandGatePlugin,
  installTimeseriesPlugins,
  Intervention,
  registerPlugin,
} from '../src';

describe('Seasonal demand gate plugin', () => {
  it('enforces season-specific segment capacity using year-season map', () => {
    const pluginName = `ts-seasonal-${Date.now()}`;
    registerPlugin(createSeasonalDemandGatePlugin({ name: pluginName }));

    const facet = arrayAdapter([
      { uprn: 'a', substationId: 'S1', projectedDemandIncreaseKw: 20 },
      { uprn: 'b', substationId: 'S1', projectedDemandIncreaseKw: 25 },
      { uprn: 'c', substationId: 'S1', projectedDemandIncreaseKw: 10 },
    ]);

    const intervention = new Intervention('seasonal-gate', {
      facet,
      startYear: 2026,
      endYear: 2026,
      init: (context) => {
        context.state.seasonByYear = { 2026: 'winter' };
        context.state.seasonalDemandCapacity = {
          2026: {
            winter: {
              S1: 45,
            },
          },
        };
      },
      filter: `${pluginName}:constraint`,
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();
    const selected = result.metrics['2026'].map((entry) => String(entry.building));

    expect(selected).toEqual(['a', 'b']);
    expect(result.state.seasonalDemandLoad[2026].winter.S1).toBe(45);
  });

  it('supports flat segment capacities and relaxed missing-capacity mode', () => {
    const pluginName = `ts-seasonal-relaxed-${Date.now()}`;
    registerPlugin(
      createSeasonalDemandGatePlugin({
        name: pluginName,
        strictMissingCapacity: false,
      }),
    );

    const facet = arrayAdapter([
      { uprn: 'x', substationId: 'S2', projectedDemandIncreaseKw: 15, season: 'summer' },
      { uprn: 'y', substationId: 'S3', projectedDemandIncreaseKw: 15, season: 'summer' },
    ]);

    const intervention = new Intervention('seasonal-relaxed', {
      facet,
      startYear: 2026,
      endYear: 2026,
      init: (context) => {
        context.state.seasonalDemandCapacity = {
          S2: 20,
        };
      },
      filter: `${pluginName}:constraint`,
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();
    const selected = result.metrics['2026'].map((entry) => String(entry.building));

    expect(selected).toEqual(['x', 'y']);
  });

  it('timeseries installer returns seasonal-demand export ref', () => {
    const suffix = Date.now();
    const refs = installTimeseriesPlugins({
      seasonalDemandGate: {
        name: `bundle-ts-seasonal-${suffix}`,
      },
    });

    expect(refs.seasonalDemandGate.exportRef).toBe(`bundle-ts-seasonal-${suffix}:constraint`);
  });
});
