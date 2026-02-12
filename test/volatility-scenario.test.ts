import { describe, it, expect } from 'vitest';
import {
  arrayAdapter,
  createVolatilityScenarioPlugin,
  installRiskPlugins,
  Intervention,
  registerPlugin,
} from '../src';

describe('Volatility scenario plugin', () => {
  it('applies year/season volatility multiplier to energy price', () => {
    const pluginName = `risk-volatility-${Date.now()}`;
    registerPlugin(createVolatilityScenarioPlugin({ name: pluginName }));

    const facet = arrayAdapter([{ uprn: 'v1', energyPrice: 100 }]);

    const intervention = new Intervention('volatility-seasonal', {
      facet,
      startYear: 2026,
      endYear: 2026,
      init: (context) => {
        context.state.volatilitySeasonByYear = { 2026: 'winter' };
        context.state.priceVolatilityMultipliers = {
          2026: { winter: 1.2, summer: 0.9 },
        };
      },
      filter: () => true,
      upgrade: `${pluginName}:upgrade`,
    });

    const result = intervention.simulate();
    const stats = result.metrics['2026'][0].stats;

    expect(stats.volatilityMultiplier).toBeCloseTo(1.2, 6);
    expect(stats.volatilityAdjustedPrice).toBeCloseTo(120, 6);
    expect(stats.volatilityYear).toBe(2026);
    expect(stats.volatilitySeason).toBe('winter');
  });

  it('falls back to default multiplier when no year/season match exists', () => {
    const pluginName = `risk-volatility-fallback-${Date.now()}`;
    registerPlugin(
      createVolatilityScenarioPlugin({
        name: pluginName,
        fallbackMultiplier: 1.05,
      }),
    );

    const facet = arrayAdapter([{ uprn: 'v2', energyPrice: 200 }]);

    const intervention = new Intervention('volatility-fallback', {
      facet,
      startYear: 2027,
      endYear: 2027,
      init: (context) => {
        context.state.priceVolatilityMultipliers = {
          2026: { winter: 1.3 },
        };
      },
      filter: () => true,
      upgrade: `${pluginName}:upgrade`,
    });

    const result = intervention.simulate();
    const stats = result.metrics['2027'][0].stats;

    expect(stats.volatilityMultiplier).toBeCloseTo(1.05, 6);
    expect(stats.volatilityAdjustedPrice).toBeCloseTo(210, 6);
  });

  it('risk installer exposes volatility upgrade ref', () => {
    const suffix = Date.now();
    const refs = installRiskPlugins({
      volatilityScenario: { name: `bundle-risk-${suffix}` },
    });

    expect(refs.volatilityScenario.exportRef).toBe(`bundle-risk-${suffix}:upgrade`);
  });
});