import { describe, it, expect } from 'vitest';
import { getPlugin, getPredicate, installLaepPresets } from '../src';

describe('LAEP preset installer', () => {
  it('registers prefixed plugins, scenario predicates, and LAEP plugins', () => {
    const ns = `laep-preset-${Date.now()}`;
    const { namespace, plugins, scenario, laep } = installLaepPresets({ namespace: ns });

    expect(namespace).toBe(ns);
    expect(getPlugin(plugins.grid.substationCapacityGate.name)).toBeTruthy();
    expect(getPredicate(scenario.predicates.budgetConstraint)).toBeTruthy();
    expect(getPlugin(laep.archetypeConstraint.name)?.constraint).toBeTypeOf('function');
    expect(getPlugin(laep.coBenefitsTracker.name)?.upgrade).toBeTypeOf('function');
    expect(getPlugin(laep.heatNetworkEconomics.name)?.prioritise).toBeTypeOf('function');
    expect(getPlugin(laep.flexibilityDemandAdjustment.name)?.constraint).toBeTypeOf('function');
  });
});
