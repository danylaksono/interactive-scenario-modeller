import { describe, it, expect } from 'vitest';
import {
  arrayAdapter,
  getPlugin,
  installAllPlugins,
  installFinancialPlugins,
  installGridPlugins,
  installPolicyPlugins,
  installRiskPlugins,
  installSocialPlugins,
  installTransportPlugins,
  Intervention,
} from '../src';

describe('Plugin bundle installers', () => {
  it('installs financial bundle and returns export refs', () => {
    const suffix = Date.now();
    const refs = installFinancialPlugins({
      budgetSpendTracker: { name: `bundle-budget-${suffix}` },
      financingModel: { name: `bundle-financing-${suffix}` },
    });

    expect(refs.budgetSpendTracker.exportRef).toBe(`bundle-budget-${suffix}:upgrade`);
    expect(refs.financingModel.exportRef).toBe(`bundle-financing-${suffix}:upgrade`);

    expect(typeof getPlugin(refs.budgetSpendTracker.name)?.upgrade).toBe('function');
    expect(typeof getPlugin(refs.financingModel.name)?.upgrade).toBe('function');
  });

  it('installs social/policy/grid bundles and resolves in simulate()', () => {
    const suffix = Date.now();

    const social = installSocialPlugins({
      fuelPovertyPriority: { name: `bundle-social-${suffix}`, threshold: 0.6 },
    });
    const policy = installPolicyPlugins({
      policyTimelineValidator: { name: `bundle-policy-${suffix}` },
    });
    const grid = installGridPlugins({
      substationCapacityGate: { name: `bundle-grid-cap-${suffix}` },
      sequentialEnablement: {
        name: `bundle-grid-seq-${suffix}`,
        defaultRequiredIntervention: 'phase-1',
      },
      generationHeadroomAllocation: { name: `bundle-grid-headroom-${suffix}` },
      gridEnergyBalanceReporting: { name: `bundle-grid-balance-${suffix}` },
    });

    expect(typeof getPlugin(social.fuelPovertyPriority.name)?.constraint).toBe('function');
    expect(typeof getPlugin(policy.policyTimelineValidator.name)?.constraint).toBe('function');
    expect(typeof getPlugin(grid.substationCapacityGate.name)?.constraint).toBe('function');
    expect(typeof getPlugin(grid.sequentialEnablement.name)?.constraint).toBe('function');
    expect(typeof getPlugin(grid.generationHeadroomAllocation.name)?.constraint).toBe('function');
    expect(typeof getPlugin(grid.gridEnergyBalanceReporting.name)?.upgrade).toBe('function');

    const facet = arrayAdapter([
      {
        uprn: 'ok-1',
        fuelPovertyScore: 0.9,
        carbonSavingPotential: 0.5,
        substationId: 'S1',
        projectedDemandIncreaseKw: 20,
      },
      {
        uprn: 'blocked-1',
        fuelPovertyScore: 0.2,
        carbonSavingPotential: 0.2,
        substationId: 'S1',
        projectedDemandIncreaseKw: 20,
      },
    ]);

    const inter = new Intervention('bundle-usage', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: social.fuelPovertyPriority.exportRef,
      init: (context) => {
        context.state.activePolicies = { 2026: { enabledBuildingTypes: ['residential'] } };
        context.state.substationCapacities = { S1: 50 };
      },
      upgrade: () => ({ installed: true }),
    });

    const res = inter.simulate();
    expect(res.metrics['2026']).toHaveLength(1);
    expect(res.metrics['2026'][0].building).toBe('ok-1');
  });

  it('installs all bundles together', () => {
    const suffix = Date.now();
    const all = installAllPlugins({
      financial: {
        budgetSpendTracker: { name: `all-budget-${suffix}` },
        financingModel: { name: `all-financing-${suffix}` },
      },
      social: {
        fuelPovertyPriority: { name: `all-social-${suffix}` },
      },
      policy: {
        policyTimelineValidator: { name: `all-policy-${suffix}` },
      },
      grid: {
        substationCapacityGate: { name: `all-grid-cap-${suffix}` },
        sequentialEnablement: { name: `all-grid-seq-${suffix}` },
        generationHeadroomAllocation: { name: `all-grid-headroom-${suffix}` },
        gridEnergyBalanceReporting: { name: `all-grid-balance-${suffix}` },
      },
      transport: {
        evLoadInteraction: { name: `all-transport-ev-${suffix}` },
        transportCorridorConstraint: { name: `all-transport-corridor-${suffix}` },
      },
      risk: {
        volatilityScenario: { name: `all-risk-volatility-${suffix}` },
      },
    });

    expect(all.financial.budgetSpendTracker.exportRef).toBe(`all-budget-${suffix}:upgrade`);
    expect(all.grid.sequentialEnablement.exportRef).toBe(`all-grid-seq-${suffix}:constraint`);
    expect(all.grid.generationHeadroomAllocation.exportRef).toBe(`all-grid-headroom-${suffix}:constraint`);
    expect(all.grid.gridEnergyBalanceReporting.exportRef).toBe(`all-grid-balance-${suffix}:upgrade`);
    expect(all.transport.evLoadInteraction.exportRef).toBe(`all-transport-ev-${suffix}:constraint`);
    expect(all.transport.transportCorridorConstraint.exportRef).toBe(`all-transport-corridor-${suffix}:constraint`);
    expect(all.risk.volatilityScenario.exportRef).toBe(`all-risk-volatility-${suffix}:upgrade`);
  });

  it('installs transport bundle and registers both constraints', () => {
    const suffix = Date.now();
    const refs = installTransportPlugins({
      evLoadInteraction: { name: `bundle-transport-ev-${suffix}` },
      transportCorridorConstraint: { name: `bundle-transport-corridor-${suffix}` },
    });

    expect(refs.evLoadInteraction.exportRef).toBe(`bundle-transport-ev-${suffix}:constraint`);
    expect(refs.transportCorridorConstraint.exportRef).toBe(`bundle-transport-corridor-${suffix}:constraint`);

    expect(typeof getPlugin(refs.evLoadInteraction.name)?.constraint).toBe('function');
    expect(typeof getPlugin(refs.transportCorridorConstraint.name)?.constraint).toBe('function');
  });

  it('installs risk bundle and registers volatility upgrade', () => {
    const suffix = Date.now();
    const refs = installRiskPlugins({
      volatilityScenario: { name: `bundle-risk-volatility-${suffix}` },
    });

    expect(refs.volatilityScenario.exportRef).toBe(`bundle-risk-volatility-${suffix}:upgrade`);
    expect(typeof getPlugin(refs.volatilityScenario.name)?.upgrade).toBe('function');
  });
});
