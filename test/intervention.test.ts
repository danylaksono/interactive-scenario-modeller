import { describe, it, expect } from 'vitest';
import { Intervention } from '../src/intervention';
import { arrayAdapter } from '../src/facet-adapter';

describe('Intervention basic simulation', () => {
  it('runs and aggregates metrics', () => {
    const data = [ { uprn: '1' }, { uprn: '2' } ];
    const facet = arrayAdapter(data);
    const i = new Intervention('t', { facet, startYear: 2020, endYear: 2021, upgrade: (b)=>({ installed: true }) });
    const r = i.simulate();
    expect(Object.keys(r.metrics).length).toBe(2);
  });
});