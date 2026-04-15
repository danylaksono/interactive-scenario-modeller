import { describe, it, expect } from 'vitest';
import {
  Intervention,
  arrayAdapter,
  combineConstraints,
  createArchetypeConstraintPlugin,
  createCoBenefitsTrackerPlugin,
  createFlexibilityDemandAdjustmentPlugin,
  createHeatNetworkEconomicsPlugin,
  createSubstationCapacityGatePlugin,
  getPlugin,
  registerPlugin,
} from '../src';

describe('LAEP plugin pack', () => {
  it('archetype constraint blocks listed interventions in conservation areas', () => {
    const name = `arch-${Date.now()}`;
    registerPlugin(
      createArchetypeConstraintPlugin({
        name,
        rules: [
          {
            interventionTypes: ['external_hp'],
            inConservationArea: true,
            listed: true,
            allow: false,
          },
        ],
        defaultAllow: true,
      }),
    );

    const facet = arrayAdapter([
      { uprn: 'ok', interventionType: 'loft_ins', listedStatus: 'None', inConservationArea: false },
      { uprn: 'bad', interventionType: 'external_hp', listedStatus: 'Grade II', inConservationArea: true },
    ]);

    const i = new Intervention('t', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: `${name}:constraint`,
      upgrade: () => ({ done: true }),
    });
    const r = i.simulate();
    expect(r.metrics['2026']).toHaveLength(1);
  });

  it('co-benefits tracker emits monetised totals from coefficients', () => {
    const name = `cob-${Date.now()}`;
    registerPlugin(createCoBenefitsTrackerPlugin({ name }));

    const facet = arrayAdapter([
      {
        uprn: 'x',
        fuelPovertyHouseholdLifts: 2,
        noxReductionKg: 1,
        pm25ReductionKg: 0.5,
        capexGbp: 2_000_000,
      },
    ]);

    const i = new Intervention('t', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: () => true,
      init: (ctx) => {
        ctx.state.coBenefitsCoefficients = {
          gbpPerFuelPovertyHouseholdLift: 1000,
          gbpPerKgNoxReduced: 100,
          gbpPerKgPm25Reduced: 200,
          jobsFtePerMillionGbpCapex: 10,
        };
      },
      upgrade: `${name}:upgrade`,
    });
    const r = i.simulate();
    const s = r.metrics['2026'][0].stats as Record<string, number>;
    expect(s.coBenefitsGbpFuelPoverty).toBe(2000);
    expect(s.coBenefitsGbpNoxComponent).toBe(100);
    expect(s.coBenefitsGbpPm25Component).toBe(100);
    expect(s.coBenefitsJobsFteEstimate).toBe(20);
  });

  it('heat network economics prioritises higher heat density', () => {
    const name = `heat-${Date.now()}`;
    registerPlugin(createHeatNetworkEconomicsPlugin({ name }));

    const facet = arrayAdapter([
      { uprn: 'low', annualHeatDemandKwh: 5000, floorAreaM2: 100 },
      { uprn: 'high', annualHeatDemandKwh: 12000, floorAreaM2: 100 },
    ]);

    const i = new Intervention('t', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: () => true,
      prioritise: `${name}:prioritise`,
      upgrade: () => ({ tag: 1 }),
    });
    const r = i.simulate();
    expect((r.metrics['2026'][0].stats as { tag?: number }).tag).toBe(1);
    expect(r.metrics['2026'][0].entity).toBe('high');
  });

  it('flexibility adjustment reduces demand seen by a combined gate', () => {
    const flexName = `flex-${Date.now()}`;
    const gateName = `gate-${Date.now()}`;
    registerPlugin(
      createFlexibilityDemandAdjustmentPlugin({
        name: flexName,
        outputDemandField: 'effectiveProjectedDemandIncreaseKw',
      }),
    );
    registerPlugin(
      createSubstationCapacityGatePlugin({
        name: gateName,
        demandIncrementField: 'effectiveProjectedDemandIncreaseKw',
      }),
    );

    const flex = getPlugin(flexName)!.constraint!;
    const gate = getPlugin(gateName)!.constraint!;

    const facet = arrayAdapter([
      { uprn: 'a', substationId: 'S1', projectedDemandIncreaseKw: 100, flexibilityPeakReductionFraction: 0.25 },
    ]);

    const i = new Intervention('t', {
      facet,
      startYear: 2026,
      endYear: 2026,
      init: (ctx) => {
        ctx.state.substationCapacities = { S1: 80 };
      },
      filter: combineConstraints(flex, gate),
      upgrade: () => ({ ok: true }),
    });
    const r = i.simulate();
    expect(r.metrics['2026']).toHaveLength(1);
    expect((r.entities![0] as any).effectiveProjectedDemandIncreaseKw).toBe(75);
  });
});
