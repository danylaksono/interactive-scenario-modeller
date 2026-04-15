import { describe, it, expect } from 'vitest';
import {
  buildDfesCapacityByScenario,
  normaliseEpcRow,
  normaliseImdRow,
  normaliseOsUprnRow,
} from '../src/adapters/uk/index';

describe('UK adapters', () => {
  it('normalises EPC column aliases', () => {
    const row = normaliseEpcRow({
      UPRN: '123',
      TOTAL_FLOOR_AREA: '90',
      CURRENT_ENERGY_RATING: 'D',
    });
    expect(row.uprn).toBe('123');
    expect(row.totalFloorAreaM2).toBe(90);
    expect(row.currentEnergyRating).toBe('D');
  });

  it('normalises IMD rows', () => {
    const row = normaliseImdRow({ lsoa11cd: 'E01000001', imd_decile: 3.2 });
    expect(row.lsoaCode).toBe('E01000001');
    expect(row.imdDecile).toBe(3);
  });

  it('normalises OS UPRN rows', () => {
    const row = normaliseOsUprnRow({ UPRN: '99', EASTING: '451000', NORTHING: '198000' });
    expect(row.uprn).toBe('99');
    expect(row.easting).toBe(451000);
  });

  it('builds nested DFES capacity tables', () => {
    const nested = buildDfesCapacityByScenario([
      { substationId: 'S1', year: 2026, scenario: 'A', headroomKw: 50 },
      { substationId: 'S1', year: 2026, scenario: 'B', headroomKw: 200 },
    ]);
    expect(nested.A['2026'].S1).toBe(50);
    expect(nested.B['2026'].S1).toBe(200);
  });
});
