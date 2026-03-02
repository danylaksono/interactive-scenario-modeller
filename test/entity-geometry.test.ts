import { describe, it, expect, beforeAll } from 'vitest';
import { Intervention } from '../src/intervention';
import { arrayAdapter } from '../src/facet-adapter';
import { registerSpatialPredicates } from '../src/plugins/geographic/spatial-predicates';

describe('Entity and Geometry support', () => {
  beforeAll(() => {
    registerSpatialPredicates();
  });

  it('supports spatial predicates like geo:within', () => {
    // London: 51.5074, -0.1278
    // Paris: 48.8566, 2.3522
    // Cambridge: 52.2053, 0.1218 (near London)
    const data = [
      { id: 'London', geometry: { type: 'Point', coordinates: [-0.1278, 51.5074] } },
      { id: 'Paris', geometry: { type: 'Point', coordinates: [2.3522, 48.8566] } },
      { id: 'Cambridge', geometry: { type: 'Point', coordinates: [0.1218, 52.2053] } }
    ];
    const facet = arrayAdapter(data);
    
    const i = new Intervention('Spatial Test', {
      facet,
      startYear: 2020,
      endYear: 2020,
      // Find entities within 100km of London
      filter: (e, ctx) => ctx.resolvePredicate('geo:within')(e, ctx, { lat: 51.5, lon: -0.1, radius: 100 }),
      transform: (e) => ({ found: true })
    });

    const result = i.simulate();
    const foundIds = [];
    for (let j = 0; j < i.simulatedFacet.getRowCount(); j++) {
      const row = i.simulatedFacet.getRow(j);
      if (row.found) foundIds.push(row.id);
    }
    
    expect(foundIds).toContain('London');
    expect(foundIds).toContain('Cambridge');
    expect(foundIds).not.toContain('Paris');
  });

  it('supports Entity terminology and carrying geometry', () => {
    const data = [
      { id: 'A', geometry: { type: 'Point', coordinates: [0, 0] }, value: 10 },
      { id: 'B', geometry: { type: 'Point', coordinates: [1, 1] }, value: 20 }
    ];
    const facet = arrayAdapter(data);
    
    const i = new Intervention('Spatial Intervention', {
      facet,
      startYear: 2020,
      endYear: 2020,
      // Use "transform" instead of "upgrade"
      transform: (entity, context) => {
        return { 
          processed: true,
          // Can access geometry in predicate
          isOrigin: entity.geometry.coordinates[0] === 0
        };
      }
    });

    const result = i.simulate();
    
    // Check if result.simulatedFacet carries geometry
    const outFacet = i.simulatedFacet;
    expect(outFacet.getRowCount()).toBe(2);
    
    const rowA = outFacet.getRow(0);
    expect(rowA.id).toBe('A');
    expect(rowA.geometry).toEqual({ type: 'Point', coordinates: [0, 0] });
    expect(rowA.processed).toBe(true);
    expect(rowA.isOrigin).toBe(true);
    
    const rowB = outFacet.getRow(1);
    expect(rowB.id).toBe('B');
    expect(rowB.geometry).toEqual({ type: 'Point', coordinates: [1, 1] });
    expect(rowB.processed).toBe(true);
    expect(rowB.isOrigin).toBe(false);
  });

  it('supports setupEntity alias', () => {
    const data = [ { uprn: '123' } ];
    const facet = arrayAdapter(data);
    
    const i = new Intervention('Test', {
      facet,
      startYear: 2020,
      endYear: 2020,
      setupEntity: (row) => ({ id: row.uprn, custom: true }),
      apply: (entity) => ({ ok: entity.custom })
    });
    
    const result = i.simulate();
    const row = i.simulatedFacet.getRow(0);
    expect(row.id).toBe('123');
    expect(row.ok).toBe(true);
  });

  it('supports shared resources across interventions', () => {
    const data = [ { id: '1' }, { id: '2' }, { id: '3' } ];
    const facet = arrayAdapter(data);
    
    // Shared budget of 150
    const sharedResources = new Map();
    sharedResources.set('budget', 150);
    
    const i = new Intervention('Budgeted Intervention', {
      facet,
      startYear: 2020,
      endYear: 2020,
      transform: (entity, context) => {
        const cost = 100;
        if (context.resources.consume('budget', cost)) {
          return { installed: true, cost };
        }
        return { installed: false, error: 'no budget' };
      }
    });

    // Run directly with shared resources
    const result = i.simulate(null, sharedResources);
    
    const rows = [i.simulatedFacet.getRow(0), i.simulatedFacet.getRow(1), i.simulatedFacet.getRow(2)];
    
    // Only one should be installed (100 cost, 150 budget)
    const installed = rows.filter(r => r.installed);
    expect(installed.length).toBe(1);
    expect(sharedResources.get('budget')).toBe(50); // Map was updated
  });
});
