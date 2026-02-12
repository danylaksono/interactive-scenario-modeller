import { describe, it, expect } from 'vitest';
import {
  arrayAdapter,
  createLoadProfileScoringPlugin,
  installTimeseriesPlugins,
  Intervention,
  registerPlugin,
} from '../src';

describe('Load profile scoring plugin', () => {
  it('prioritises buildings by weighted load-profile score', () => {
    const pluginName = `ts-load-profile-${Date.now()}`;
    registerPlugin(createLoadProfileScoringPlugin({ name: pluginName }));

    const facet = arrayAdapter([
      { uprn: 'a', peakReductionPotential: 0.9, loadShiftPotential: 0.1, flexibilityScore: 0.1 },
      { uprn: 'b', peakReductionPotential: 0.4, loadShiftPotential: 0.8, flexibilityScore: 0.7 },
      { uprn: 'c', peakReductionPotential: 0.2, loadShiftPotential: 0.2, flexibilityScore: 0.2 },
    ]);

    const intervention = new Intervention('load-profile-prior', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: () => true,
      prioritise: `${pluginName}:prioritise`,
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();
    const order = result.metrics['2026'].map((entry) => String(entry.building));

    expect(order).toEqual(['b', 'a', 'c']);
  });

  it('supports state-level weight overrides', () => {
    const pluginName = `ts-load-profile-weights-${Date.now()}`;
    registerPlugin(createLoadProfileScoringPlugin({ name: pluginName }));

    const facet = arrayAdapter([
      { uprn: 'x', peakReductionPotential: 1.0, loadShiftPotential: 0.1, flexibilityScore: 0.1 },
      { uprn: 'y', peakReductionPotential: 0.1, loadShiftPotential: 1.0, flexibilityScore: 1.0 },
    ]);

    const intervention = new Intervention('load-profile-weights', {
      facet,
      startYear: 2026,
      endYear: 2026,
      init: (context) => {
        context.state.loadProfileWeights = {
          peakReduction: 0.1,
          loadShift: 0.45,
          flexibility: 0.45,
        };
      },
      filter: () => true,
      prioritise: `${pluginName}:prioritise`,
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();
    const order = result.metrics['2026'].map((entry) => String(entry.building));

    expect(order).toEqual(['y', 'x']);
  });

  it('timeseries installer exposes load-profile prioritiser ref', () => {
    const suffix = Date.now();
    const refs = installTimeseriesPlugins({
      loadProfileScoring: { name: `bundle-ts-load-profile-${suffix}` },
    });

    expect(refs.loadProfileScoring.exportRef).toBe(`bundle-ts-load-profile-${suffix}:prioritise`);
  });
});
