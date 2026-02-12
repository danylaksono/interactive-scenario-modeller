import { describe, it, expect } from 'vitest';
import {
  arrayAdapter,
  createSubstationCapacityGatePlugin,
  Intervention,
  registerPlugin,
} from '../src';

describe('Substation capacity gate plugin', () => {
  it('allows upgrades until substation capacity is reached', () => {
    const pluginName = `grid-capacity-${Date.now()}`;
    registerPlugin(createSubstationCapacityGatePlugin({ name: pluginName }));

    const facet = arrayAdapter([
      { uprn: 'a', substationId: 'S1', projectedDemandIncreaseKw: 40 },
      { uprn: 'b', substationId: 'S1', projectedDemandIncreaseKw: 30 },
      { uprn: 'c', substationId: 'S1', projectedDemandIncreaseKw: 50 },
      { uprn: 'd', substationId: 'S2', projectedDemandIncreaseKw: 20 },
    ]);

    const intervention = new Intervention('capacity-gate', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: `${pluginName}:constraint`,
      init: (context) => {
        context.state.substationCapacities = {
          S1: 100,
          S2: 30,
        };
      },
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();
    const selected = result.metrics['2026'].map((m) => m.building);

    expect(selected).toEqual(['a', 'b', 'd']);
    expect(result.state.substationLoads[2026].S1).toBe(70);
    expect(result.state.substationLoads[2026].S2).toBe(20);
  });

  it('supports year-specific capacities', () => {
    const pluginName = `grid-capacity-year-${Date.now()}`;
    registerPlugin(createSubstationCapacityGatePlugin({ name: pluginName }));

    const facet = arrayAdapter([
      { uprn: 'x', substationId: 'S1', projectedDemandIncreaseKw: 60 },
    ]);

    const intervention = new Intervention('capacity-yearly', {
      facet,
      startYear: 2026,
      endYear: 2027,
      filter: `${pluginName}:constraint`,
      init: (context) => {
        context.state.substationCapacities = {
          2026: { S1: 50 },
          2027: { S1: 70 },
        };
      },
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();

    expect(result.metrics['2026']).toHaveLength(0);
    expect(result.metrics['2027']).toHaveLength(1);
    expect(result.state.substationLoads[2027].S1).toBe(60);
  });

  it('allows missing capacities when strict mode is disabled', () => {
    const pluginName = `grid-capacity-open-${Date.now()}`;
    registerPlugin(
      createSubstationCapacityGatePlugin({
        name: pluginName,
        strictMissingCapacity: false,
      }),
    );

    const facet = arrayAdapter([
      { uprn: 'm1', substationId: 'UNKNOWN', projectedDemandIncreaseKw: 10 },
    ]);

    const intervention = new Intervention('capacity-missing', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: `${pluginName}:constraint`,
      init: (context) => {
        context.state.substationCapacities = {
          S1: 100,
        };
      },
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();
    expect(result.metrics['2026']).toHaveLength(1);
  });
});
