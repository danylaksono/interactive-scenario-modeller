import { describe, it, expect } from 'vitest';
import {
  arrayAdapter,
  createCarbonTargetConstraintPlugin,
  createCostBenefitPrioritiserPlugin,
  createTopPercentPotentialPlugin,
  installOptimizationPlugins,
  Intervention,
  registerPlugin,
} from '../src';

describe('Optimization plugins', () => {
  it('cost-benefit prioritiser orders by benefit per cost', () => {
    const pluginName = `opt-prioritiser-${Date.now()}`;
    registerPlugin(createCostBenefitPrioritiserPlugin({ name: pluginName }));

    const facet = arrayAdapter([
      { uprn: 'a', carbonSavingPotential: 20, estimatedPVCost: 10 }, // 2.0
      { uprn: 'b', carbonSavingPotential: 30, estimatedPVCost: 30 }, // 1.0
      { uprn: 'c', carbonSavingPotential: 10, estimatedPVCost: 5 }, // 2.0
    ]);

    const intervention = new Intervention('opt-prioritiser', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: () => true,
      prioritise: `${pluginName}:prioritise`,
      upgrade: () => ({ installed: true }),
    });

    const result = intervention.simulate();
    const order = result.metrics['2026'].map((entry) => String(entry.building));

    expect(order[0]).toBe('a');
    expect(order[1]).toBe('c');
    expect(order[2]).toBe('b');
  });

  it('carbon-target constraint blocks once annual target is reached', () => {
    const pluginName = `opt-target-${Date.now()}`;
    registerPlugin(createCarbonTargetConstraintPlugin({ name: pluginName }));

    const facet = arrayAdapter([
      { uprn: 'x', carbonReductionPotential: 40 },
      { uprn: 'y', carbonReductionPotential: 30 },
      { uprn: 'z', carbonReductionPotential: 20 },
    ]);

    const intervention = new Intervention('opt-target', {
      facet,
      startYear: 2026,
      endYear: 2026,
      init: (context) => {
        context.state.carbonTargetByYear = { 2026: 60 };
        context.state.currentCarbonReducedByYear = { 2026: 0 };
      },
      filter: `${pluginName}:constraint`,
      upgrade: (building, context) => {
        const reduction = building.carbonReductionPotential ?? 0;
        context.state.currentCarbonReducedByYear[context.year] += reduction;
        return { carbonReduced: reduction };
      },
    });

    const result = intervention.simulate();
    const selected = result.metrics['2026'].map((entry) => String(entry.building));

    expect(selected).toEqual(['x', 'y']);
    expect(result.state.currentCarbonReducedByYear[2026]).toBe(70);
  });

  it('top-percent potential constraint filters by precomputed rank', () => {
    const pluginName = `opt-top-${Date.now()}`;
    registerPlugin(createTopPercentPotentialPlugin({ name: pluginName, percentile: 0.1 }));

    const facet = arrayAdapter([
      { uprn: 'r1', potentialRank: 1, potentialRankCount: 20 },
      { uprn: 'r2', potentialRank: 2, potentialRankCount: 20 },
      { uprn: 'r3', potentialRank: 3, potentialRankCount: 20 },
    ]);

    const intervention = new Intervention('opt-top', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: `${pluginName}:constraint`,
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();
    const selected = result.metrics['2026'].map((entry) => String(entry.building));

    expect(selected).toEqual(['r1', 'r2']);
  });

  it('optimization bundle installer returns valid export refs', () => {
    const suffix = Date.now();
    const refs = installOptimizationPlugins({
      costBenefitPrioritiser: { name: `bundle-opt-prior-${suffix}` },
      carbonTargetConstraint: { name: `bundle-opt-target-${suffix}` },
      topPercentPotential: { name: `bundle-opt-top-${suffix}` },
    });

    expect(refs.costBenefitPrioritiser.exportRef).toBe(`bundle-opt-prior-${suffix}:prioritise`);
    expect(refs.carbonTargetConstraint.exportRef).toBe(`bundle-opt-target-${suffix}:constraint`);
    expect(refs.topPercentPotential.exportRef).toBe(`bundle-opt-top-${suffix}:constraint`);
  });
});
