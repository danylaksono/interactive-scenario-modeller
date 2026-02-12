import { Metrics, SimulatedFacetOptions } from "./types";
import { DataTable } from "./utils"; // lightweight DataTable in utils for example purposes

/**
 * Builds a simulated data facet from intervention metrics.
 * 
 * This is a convenience function that transforms metrics into a tabular format.
 * For custom output formats, you can build your own from the `metrics` object directly,
 * or provide a custom `outputBuilder` function in the options.
 * 
 * @param columnsUsed - Set of column names used by the intervention
 * @param facet - Original facet containing building data
 * @param metrics - Metrics produced by the intervention simulation
 * @param opts - Configuration options
 * @returns A facet-like object with getRowCount() and getRow(i) methods
 * 
 * @example
 * ```typescript
 * // Basic usage with default options
 * const result = intervention.simulate();
 * const simulatedFacet = buildSimulatedDataFacet(
 *   result.columns,
 *   originalFacet,
 *   result.metrics
 * );
 * 
 * // Custom configuration
 * const customFacet = buildSimulatedDataFacet(
 *   result.columns,
 *   originalFacet,
 *   result.metrics,
 *   {
 *     keepColumns: ['region', 'postcode'], // Custom columns to carry forward
 *     includeUntouched: true, // Include buildings not modified
 *     naValue: 'N/A' // Custom placeholder
 *   }
 * );
 * 
 * // Custom output builder for different visual analytics frameworks
 * const customOutput = buildSimulatedDataFacet(
 *   result.columns,
 *   originalFacet,
 *   result.metrics,
 *   {
 *     outputBuilder: (columns, data, facet) => {
 *       // Return your custom data structure
 *       return { columns, rows: data, metadata: { source: 'intervention' } };
 *     }
 *   }
 * );
 * ```
 */
export function buildSimulatedDataFacet(
  columnsUsed: Set<string>,
  facet: any,
  metrics: Metrics,
  opts: SimulatedFacetOptions = {}
) {
  const {
    includeUntouched = false,
    keepColumns = [],
    naValue = "n/a",
    outputBuilder
  } = opts;
  
  const N_A = naValue;
  const columnsToKeep = keepColumns === null ? [] : (Array.isArray(keepColumns) ? keepColumns : []);

  const ci = (s: any) => String(s).toLowerCase();
  const reserved = new Set(['uprn', 'year']);

  const rawUsedCols = Array.from(columnsUsed || []);
  const usedCols: string[] = [];
  const seen = new Set(['uprn', 'year']);
  for (const name of rawUsedCols) {
    if (!name) continue;
    const key = ci(name);
    if (reserved.has(key) || seen.has(key)) continue;
    usedCols.push(name);
    seen.add(key);
  }

  // build facet index
  const facetCount = facet?.getRowCount?.() ?? 0;
  const facetByUprn = new Map<string, any>();
  for (let i = 0; i < facetCount; i++) {
    const row = facet.getRow(i) || {};
    const id = row?.uprn ?? row?.UPRN ?? row?.id;
    if (id != null) facetByUprn.set(String(id), row);
  }

  const getCI = (row: any, key: string) => {
    if (!row || key == null) return undefined;
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
    const target = ci(key);
    for (const k in row) if (ci(k) === target) return row[k];
    return undefined;
  };

  const facetHasColCI = (key: string) => {
    const limit = Math.min(facetCount, 200);
    for (let i = 0; i < limit; i++) {
      const v = getCI(facet.getRow(i) || {}, key);
      if (v !== undefined) return true;
    }
    return false;
  };

  // flatten metrics
  const metricEntries: Array<{ uprn: string, year: string, stats: any }> = [];
  const statsKeyOrder: string[] = [];
  const statsKeySeen = new Set<string>();

  const pushStatsKeys = (obj: any) => {
    if (!obj) return;
    for (const k of Object.keys(obj)) {
      if (k === 'uprn' || k === 'id' || k === 'building' || k === 'year') continue;
      const lk = ci(k);
      if (reserved.has(lk) || seen.has(lk)) continue;
      if (!statsKeySeen.has(lk)) { statsKeySeen.add(lk); statsKeyOrder.push(k); seen.add(lk); }
    }
  };

  const sortedYears = Object.keys(metrics || {}).map(y => Number(y)).filter(y => !isNaN(y)).sort((a,b)=>a-b);
  for (const yearNum of sortedYears) {
    const yearKey = String(yearNum);
    const items = Array.isArray(metrics[yearKey]) ? metrics[yearKey] : [metrics[yearKey]];
    for (const item of items) {
      if (!item) continue;
      const stats = item.stats ?? {};
      const uprn = item.building ?? stats.uprn ?? stats.id ?? stats.building;
      if (uprn == null) continue;
      metricEntries.push({ uprn: String(uprn), year: yearKey, stats });
      pushStatsKeys(stats);
    }
  }

  // baseline columns
  const carryCols = [...usedCols];
  for (const k of columnsToKeep) {
    if (!k) continue;
    const lk = ci(k);
    if (reserved.has(lk) || seen.has(lk)) continue;
    if (!facetHasColCI(k)) continue;
    carryCols.push(k);
    seen.add(lk);
  }

  const columns = ['uprn','year', ...statsKeyOrder, ...carryCols];

  const data: any[] = [];
  const seenUprn = new Set<string>();

  for (const {uprn, year, stats} of metricEntries) {
    const facetRow = facetByUprn.get(uprn) || {};
    const out: any[] = [];
    out.push(uprn ?? N_A);
    out.push(year ?? N_A);
    for (const c of statsKeyOrder) out.push(Object.prototype.hasOwnProperty.call(stats, c) ? stats[c] : N_A);
    for (const c of carryCols) {
      const v = getCI(facetRow, c);
      out.push(v !== undefined ? v : N_A);
    }
    data.push(out);
    seenUprn.add(uprn);
  }

  if (includeUntouched) {
    for (let i = 0; i < facetCount; i++) {
      const row = facet.getRow(i) || {};
      const uprn = String(row?.uprn ?? row?.UPRN ?? row?.id ?? "");
      if (!uprn || seenUprn.has(uprn)) continue;
      const out: any[] = [];
      out.push(row?.uprn ?? row?.UPRN ?? row?.id ?? N_A);
      out.push(N_A);
      for (const c of statsKeyOrder) out.push(N_A);
      for (const c of carryCols) { const v = getCI(row, c); out.push(v !== undefined ? v : N_A); }
      data.push(out);
    }
  }

  // Use custom output builder if provided, otherwise use default DataTable
  if (outputBuilder) {
    return outputBuilder(columns, data, facet);
  }
  
  // Default: Use a minimal DataTable class for example; the consumer may replace with their own
  const table = new DataTable(columns, data);
  const outFacet = table.identityFacet();
  return outFacet;
}