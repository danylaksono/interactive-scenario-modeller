import { describe, it, expect } from 'vitest';
import {
  arrayAdapter,
  createEVLoadInteractionPlugin,
  createTransportCorridorConstraintPlugin,
  installTransportPlugins,
  Intervention,
  registerPlugin,
} from '../src';

describe('Transport plugins', () => {
  it('ev-load-interaction gates by baseline EV load and incremental EV charging demand', () => {
    const pluginName = `transport-ev-${Date.now()}`;
    registerPlugin(createEVLoadInteractionPlugin({ name: pluginName }));

    const facet = arrayAdapter([
      {
        uprn: 'b1',
        substationId: 'S1',
        projectedDemandIncreaseKw: 8,
        evChargingDemandKw: 5,
      },
      {
        uprn: 'b2',
        substationId: 'S1',
        projectedDemandIncreaseKw: 4,
        evChargingDemandKw: 4,
      },
    ]);

    const intervention = new Intervention('ev-load-constraint', {
      facet,
      startYear: 2026,
      endYear: 2026,
      init: (context) => {
        context.state.substationCapacities = { S1: 25 };
        context.state.evBaselineLoad = { S1: 10 };
      },
      filter: `${pluginName}:constraint`,
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();

    expect(result.metrics['2026']).toHaveLength(1);
    expect(result.metrics['2026'][0].building).toBe('b1');
    expect(result.state.substationLoads[2026].S1).toBe(13);
  });

  it('transport-corridor-constraint enforces corridor limits with overbuild factor', () => {
    const pluginName = `transport-corridor-${Date.now()}`;
    registerPlugin(
      createTransportCorridorConstraintPlugin({
        name: pluginName,
        maxOverbuildFactor: 1.1,
      }),
    );

    const facet = arrayAdapter([
      {
        uprn: 'c1',
        transportCorridorId: 'A34',
        chargingPointsProvided: 2,
      },
      {
        uprn: 'c2',
        transportCorridorId: 'A34',
        chargingPointsProvided: 2,
      },
    ]);

    const intervention = new Intervention('corridor-constraint', {
      facet,
      startYear: 2026,
      endYear: 2026,
      init: (context) => {
        context.state.corridorChargingRequirements = {
          2026: { A34: 3 },
        };
      },
      filter: `${pluginName}:constraint`,
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();

    expect(result.metrics['2026']).toHaveLength(1);
    expect(result.metrics['2026'][0].building).toBe('c1');
    expect(result.state.corridorChargingDelivered[2026].A34).toBe(2);
  });

  it('transport installer exposes both constraint refs', () => {
    const suffix = Date.now();
    const refs = installTransportPlugins({
      evLoadInteraction: { name: `bundle-ev-load-${suffix}` },
      transportCorridorConstraint: { name: `bundle-corridor-${suffix}` },
    });

    expect(refs.evLoadInteraction.exportRef).toBe(`bundle-ev-load-${suffix}:constraint`);
    expect(refs.transportCorridorConstraint.exportRef).toBe(`bundle-corridor-${suffix}:constraint`);
  });
});