import { describe, it, expect } from 'vitest';
import {
  arrayAdapter,
  createFinancingModelPlugin,
  Intervention,
  registerPlugin,
} from '../src';

describe('Financing model plugin', () => {
  it('computes lease annual payment and npv output', () => {
    const pluginName = `financial-financing-${Date.now()}`;
    registerPlugin(createFinancingModelPlugin({ name: pluginName }));

    const facet = arrayAdapter([
      { uprn: 'lease-1', estimatedPVCost: 1000 },
    ]);

    const intervention = new Intervention('lease-model', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: () => true,
      upgrade: `${pluginName}:upgrade`,
      init: (context) => {
        context.state.financing = {
          modelType: 'lease',
          interestRate: 0.1,
          discountRate: 0.05,
          termYears: 2,
        };
      },
    });

    const result = intervention.simulate();
    const stats = result.metrics['2026'][0].stats;

    expect(stats.modelType).toBe('lease');
    expect(stats.annualPayment).toBeCloseTo(576.19, 2);
    expect(stats.npvCost).toBeCloseTo(1071.37, 2);
  });

  it('supports ppa and custom output keys', () => {
    const pluginName = `financial-financing-custom-${Date.now()}`;
    registerPlugin(
      createFinancingModelPlugin({
        name: pluginName,
        outputAnnualPaymentKey: 'annualCostGBP',
        outputNpvCostKey: 'npvCostGBP',
        outputModelTypeKey: 'financeType',
      }),
    );

    const facet = arrayAdapter([
      {
        uprn: 'ppa-1',
        financing: {
          modelType: 'ppa',
          ppaRatePerKwh: 0.12,
          expectedAnnualGenerationKwh: 2000,
          termYears: 3,
          discountRate: 0.05,
          escalationRate: 0,
        },
      },
    ]);

    const intervention = new Intervention('ppa-model', {
      facet,
      startYear: 2027,
      endYear: 2027,
      filter: () => true,
      upgrade: `${pluginName}:upgrade`,
    });

    const result = intervention.simulate();
    const stats = result.metrics['2027'][0].stats;

    expect(stats.financeType).toBe('ppa');
    expect(stats.annualCostGBP).toBe(240);
    expect(stats.npvCostGBP).toBeCloseTo(653.58, 2);
  });
});
