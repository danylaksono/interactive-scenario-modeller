import { describe, it, expect } from 'vitest';
import {
  arrayAdapter,
  createGridEnergyBalanceReportingPlugin,
  Intervention,
  registerPlugin,
} from '../src';

describe('Grid energy balance reporting plugin', () => {
  it('tracks demand/generation totals and remaining headroom by substation', () => {
    const pluginName = `grid-energy-balance-${Date.now()}`;
    registerPlugin(createGridEnergyBalanceReportingPlugin({ name: pluginName }));

    const facet = arrayAdapter([
      { uprn: 'e1', substationId: 'S1', projectedDemandIncreaseKw: 10, generationExportKw: 20 },
      { uprn: 'e2', substationId: 'S1', projectedDemandIncreaseKw: 5, generationExportKw: 15 },
      { uprn: 'e3', substationId: 'S2', projectedDemandIncreaseKw: 7, generationExportKw: 3 },
    ]);

    const intervention = new Intervention('grid-energy-balance', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: () => true,
      init: (context) => {
        context.state.substationGenerationHeadroom = {
          S1: 60,
          S2: 20,
        };
      },
      upgrade: `${pluginName}:upgrade`,
    });

    const result = intervention.simulate();
    const stats = result.metrics['2026'];

    expect(stats).toHaveLength(3);
    expect(result.state.gridEnergyBalance[2026].totalDemandKw).toBe(22);
    expect(result.state.gridEnergyBalance[2026].totalGenerationKw).toBe(38);
    expect(result.state.gridEnergyBalance[2026].totalRequirementKw).toBe(60);
    expect(result.state.gridEnergyBalance[2026].bySubstation.S1.remainingHeadroomKw).toBe(10);
    expect(result.state.gridEnergyBalance[2026].bySubstation.S2.remainingHeadroomKw).toBe(10);
    expect(result.state.gridEnergyBalance[2026].remainingHeadroomKw).toBe(20);
  });

  it('supports custom output key mapping', () => {
    const pluginName = `grid-energy-balance-custom-${Date.now()}`;
    registerPlugin(
      createGridEnergyBalanceReportingPlugin({
        name: pluginName,
        outputTotalRequirementKey: 'requiredKw',
        outputRemainingHeadroomKey: 'remainingKw',
      }),
    );

    const facet = arrayAdapter([
      { uprn: 'c1', substationId: 'S1', projectedDemandIncreaseKw: 4, generationExportKw: 6 },
    ]);

    const intervention = new Intervention('grid-energy-balance-custom', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: () => true,
      init: (context) => {
        context.state.substationGenerationHeadroom = { S1: 25 };
      },
      upgrade: `${pluginName}:upgrade`,
    });

    const result = intervention.simulate();
    const metric = result.metrics['2026'][0].stats;
    expect(metric.requiredKw).toBe(10);
    expect(metric.remainingKw).toBe(15);
  });
});