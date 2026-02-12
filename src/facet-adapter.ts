/**
 * Minimal interface for data facets.
 * 
 * Any data source can be adapted to this interface to work with Interventions.
 * 
 * @example
 * ```typescript
 * const myFacet: FacetLike = {
 *   getRowCount: () => data.length,
 *   getRow: (i) => data[i],
 *   colNames: Object.keys(data[0] || {})
 * };
 * ```
 */
export type FacetLike = {
  /** Returns the total number of rows in the facet */
  getRowCount?: () => number;
  /** Returns the row at index `i` */
  getRow?: (i: number) => any;
  /** Optional array of column names */
  colNames?: string[];
};

/**
 * Creates a facet adapter from a plain array of objects.
 * 
 * This is the simplest way to provide data to an Intervention.
 * 
 * @param arr - Array of objects representing buildings/rows
 * @returns A FacetLike adapter for the array
 * 
 * @example
 * ```typescript
 * const buildings = [
 *   { uprn: 1, buildingType: 'detached', emissions: 5000 },
 *   { uprn: 2, buildingType: 'flat', emissions: 2000 }
 * ];
 * const facet = arrayAdapter(buildings);
 * const intervention = new Intervention('Test', { facet, ... });
 * ```
 */
export const arrayAdapter = (arr: any[]) => {
  return {
    getRowCount() { return arr.length; },
    getRow(i:number) { return arr[i]; },
    colNames: arr.length ? Object.keys(arr[0]) : []
  };
};

// TODO: add an adapter factory for the DecarbV2 Facet/DataTable shape (example in examples/)