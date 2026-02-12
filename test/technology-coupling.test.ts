import { describe, it, expect } from 'vitest';
import {
  arrayAdapter,
  createTechnologyCouplingPlugin,
  installTimeseriesPlugins,
  Intervention,
  registerPlugin,
} from '../src';

describe('Technology coupling plugin', () => {
  it('applies default coupling factors to demand and carbon outputs', () => {
    const pluginName = `ts-tech-coupling-${Date.now()}`;
    registerPlugin(createTechnologyCouplingPlugin({ name: pluginName }));

    const facet = arrayAdapter([
      {
        uprn: 'a',
        projectedDemandIncreaseKw: 100,
        carbonSavingPotential: 50,
        batteryAdoptionRate: 0.4,
        heatPumpAdoptionRate: 0.2,
      },
    ]);

    const intervention = new Intervention('tech-coupling-default', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: () => true,
      upgrade: `${pluginName}:upgrade`,
    });

    const result = intervention.simulate();
    const stats = result.metrics['2026'][0].stats;

    expect(stats.adjustedDemandIncreaseKw).toBeCloseTo(97, 5);
    expect(stats.adjustedCarbonSavingPotential).toBeCloseTo(51.5, 5);
  });

  it('supports state-level coupling overrides', () => {
    const pluginName = `ts-tech-coupling-overrides-${Date.now()}`;
    registerPlugin(createTechnologyCouplingPlugin({ name: pluginName }));

    const facet = arrayAdapter([
      {
        uprn: 'x',
        projectedDemandIncreaseKw: 80,
        carbonSavingPotential: 40,
      },
    ]);

    const intervention = new Intervention('tech-coupling-overrides', {
      facet,
      startYear: 2026,
      endYear: 2026,
      init: (context) => {
        context.state.technologyCoupling = {
          batteryAdoptionRate: 0.5,
          heatPumpAdoptionRate: 0.5,
          batteryDemandReductionFactor: 0.4,
          heatPumpDemandIncreaseFactor: 0.2,
          batteryCarbonBoostFactor: 0.2,
          heatPumpCarbonPenaltyFactor: 0.1,
        };
      },
      filter: () => true,
      upgrade: `${pluginName}:upgrade`,
    });

    const result = intervention.simulate();
    const stats = result.metrics['2026'][0].stats;

    expect(stats.adjustedDemandIncreaseKw).toBeCloseTo(72, 5);
    expect(stats.adjustedCarbonSavingPotential).toBeCloseTo(42, 5);
  });

  it('timeseries installer exposes technology-coupling upgrade ref', () => {
    const suffix = Date.now();
    const refs = installTimeseriesPlugins({
      technologyCoupling: { name: `bundle-ts-tech-coupling-${suffix}` },
    });

    expect(refs.technologyCoupling.exportRef).toBe(`bundle-ts-tech-coupling-${suffix}:upgrade`);
  });
});
