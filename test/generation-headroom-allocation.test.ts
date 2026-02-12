import { describe, it, expect } from 'vitest';
import {
  arrayAdapter,
  createGenerationHeadroomAllocationPlugin,
  Intervention,
  registerPlugin,
} from '../src';

describe('Generation headroom allocation plugin', () => {
  it('allocates export headroom until substation limit is reached', () => {
    const pluginName = `grid-generation-headroom-${Date.now()}`;
    registerPlugin(createGenerationHeadroomAllocationPlugin({ name: pluginName }));

    const facet = arrayAdapter([
      { uprn: 'g1', substationId: 'S1', generationExportKw: 40 },
      { uprn: 'g2', substationId: 'S1', generationExportKw: 35 },
      { uprn: 'g3', substationId: 'S1', generationExportKw: 30 },
      { uprn: 'g4', substationId: 'S2', generationExportKw: 20 },
    ]);

    const intervention = new Intervention('generation-headroom', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: `${pluginName}:constraint`,
      init: (context) => {
        context.state.substationGenerationHeadroom = {
          S1: 80,
          S2: 20,
        };
      },
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();
    const selected = result.metrics['2026'].map((m) => m.building);

    expect(selected).toEqual(['g1', 'g2', 'g4']);
    expect(result.state.substationGenerationAllocated[2026].S1).toBe(75);
    expect(result.state.substationGenerationAllocated[2026].S2).toBe(20);
  });

  it('supports year-specific headroom definitions', () => {
    const pluginName = `grid-generation-headroom-yearly-${Date.now()}`;
    registerPlugin(createGenerationHeadroomAllocationPlugin({ name: pluginName }));

    const facet = arrayAdapter([
      { uprn: 'y1', substationId: 'S1', generationExportKw: 55 },
    ]);

    const intervention = new Intervention('generation-headroom-yearly', {
      facet,
      startYear: 2026,
      endYear: 2027,
      filter: `${pluginName}:constraint`,
      init: (context) => {
        context.state.substationGenerationHeadroom = {
          2026: { S1: 50 },
          2027: { S1: 60 },
        };
      },
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();
    expect(result.metrics['2026']).toHaveLength(0);
    expect(result.metrics['2027']).toHaveLength(1);
    expect(result.state.substationGenerationAllocated[2027].S1).toBe(55);
  });
});