// Example adapter to wrap DecarbV2 Facet/DataTable shape
// NOTE: This is illustrative only — do not import DecarbV2 code here; instead, when integrating, provide the live facet instance to the adapter.

export function decarbV2FacetAdapter(facet: any) {
  // Assumes facet has getRowCount() and getRow(i) methods
  return {
    getRowCount() { return facet.getRowCount(); },
    getRow(i:number) { return facet.getRow(i); },
    colNames: facet.colNames || []
  };
}

// Usage (in host app):
// const wrapped = decarbV2FacetAdapter(myAppFacet);
// const inter = new Intervention('x', { facet: wrapped, startYear: 2024, endYear: 2030, ... });
