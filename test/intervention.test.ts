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

  it('upgradeChain uses the first transform that returns a non-empty delta', () => {
    const facet = arrayAdapter([
      { uprn: 'first', mode: 'a' },
      { uprn: 'second', mode: 'b' },
    ]);
    const i = new Intervention('chain', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: () => true,
      prioritise: () => 0,
      upgradeChain: [
        (e) => ((e as { mode?: string }).mode === 'a' ? { route: 'A' } : {}),
        () => ({ route: 'B' }),
      ],
    });
    const r = i.simulate();
    const routes = r.metrics['2026'].map((m) => (m.stats as { route?: string }).route);
    expect(routes).toEqual(['A', 'B']);
  });
});