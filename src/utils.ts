import type { Entity, SimulationContext } from "./types";

export class DataTable {
  columns: string[];
  data: any[];
  constructor(columns: string[], data: any[]) { this.columns = columns; this.data = data; }
  identityFacet() { // minimal facade
    return {
      columns: this.columns.slice(),
      data: this.data.slice(),
      getRowCount() { return this.data.length; },
      getRow(i: number) { return this.data[i]; }
    };
  }
}

export function compilePredicate(code: string): Function {
  if (typeof code !== 'string' || !code.trim()) throw new Error('No code provided');
  try {
    const fn = Function('"use strict"; return (' + code + ')')();
    if (typeof fn !== 'function') throw new Error('Compiled code is not a function');
    return fn;
  } catch (e:any) {
    throw new Error(`Failed to compile predicate: ${e && e.message ? e.message : String(e)}`);
  }
}

/**
 * Combines multiple constraint-style predicates so every function must pass.
 * Useful when a flexibility “prepare” step must run before a grid capacity gate.
 */
export function combineConstraints(
  ...predicates: Array<(entity: Entity, context: SimulationContext) => boolean>
): (entity: Entity, context: SimulationContext) => boolean {
  return (entity, context) => predicates.every((fn) => fn(entity, context));
}

/**
 * Converts a simulated facet to a GeoJSON FeatureCollection if geometries are present.
 *
 * @param facet - A facet-like object (e.g. from intervention.simulatedFacet)
 * @returns GeoJSON FeatureCollection or null if no geometries found
 */
export function toGeoJSON(facet: any) {
  if (!facet || typeof facet.getRowCount !== 'function') return null;
  
  const features = [];
  const count = facet.getRowCount();
  let hasGeo = false;

  for (let i = 0; i < count; i++) {
    const row = facet.getRow(i);
    if (row && row.geometry) {
      hasGeo = true;
      const { geometry, ...properties } = row;
      features.push({
        type: 'Feature',
        geometry,
        properties
      });
    }
  }
  
  if (!hasGeo) return null;

  return {
    type: 'FeatureCollection',
    features
  };
}

export function safeEval(code: string) {
  // Deprecated convenience wrapper: prefer `compilePredicate` + `registerPredicate`.
  return compilePredicate(code);
}