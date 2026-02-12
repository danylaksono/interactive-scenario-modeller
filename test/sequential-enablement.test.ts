import { describe, it, expect } from 'vitest';
import {
  arrayAdapter,
  createSequentialEnablementPlugin,
  Intervention,
  registerPlugin,
} from '../src';

describe('Sequential enablement plugin', () => {
  it('allows buildings with completed prerequisite on building record', () => {
    const pluginName = `grid-seq-building-${Date.now()}`;
    registerPlugin(createSequentialEnablementPlugin({ name: pluginName }));

    const facet = arrayAdapter([
      {
        uprn: 'a',
        requiresIntervention: 'grid-upgrade',
        completedInterventions: ['grid-upgrade'],
      },
      {
        uprn: 'b',
        requiresIntervention: 'grid-upgrade',
        completedInterventions: [],
      },
    ]);

    const intervention = new Intervention('seq-building', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: `${pluginName}:constraint`,
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();
    expect(result.metrics['2026']).toHaveLength(1);
    expect(result.metrics['2026'][0].building).toBe('a');
  });

  it('supports state-level completion map with default required intervention', () => {
    const pluginName = `grid-seq-state-${Date.now()}`;
    registerPlugin(
      createSequentialEnablementPlugin({
        name: pluginName,
        defaultRequiredIntervention: 'phase-1',
      }),
    );

    const facet = arrayAdapter([
      { uprn: 'x' },
      { uprn: 'y' },
    ]);

    const intervention = new Intervention('seq-state', {
      facet,
      startYear: 2027,
      endYear: 2027,
      filter: `${pluginName}:constraint`,
      init: (context) => {
        context.state.completedInterventionsByName = {
          'phase-1': {
            x: true,
          },
        };
      },
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();
    expect(result.metrics['2027']).toHaveLength(1);
    expect(result.metrics['2027'][0].building).toBe('x');
  });

  it('supports multiple required interventions', () => {
    const pluginName = `grid-seq-multi-${Date.now()}`;
    registerPlugin(createSequentialEnablementPlugin({ name: pluginName }));

    const facet = arrayAdapter([
      {
        uprn: 'm1',
        requiresIntervention: ['phase-1', 'phase-2'],
      },
      {
        uprn: 'm2',
        requiresIntervention: ['phase-1', 'phase-2'],
      },
    ]);

    const intervention = new Intervention('seq-multi', {
      facet,
      startYear: 2028,
      endYear: 2028,
      filter: `${pluginName}:constraint`,
      init: (context) => {
        context.state.completedInterventionsByName = {
          'phase-1': { m1: true, m2: true },
          'phase-2': { m1: true },
        };
      },
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();
    expect(result.metrics['2028']).toHaveLength(1);
    expect(result.metrics['2028'][0].building).toBe('m1');
  });
});
