import { Metrics, SimulatedFacetOptions } from "./types";
import { DataTable } from "./utils";

/**
 * Builds a simulated data facet from intervention metrics.
 * 
 * This is a convenience function that transforms metrics into a tabular format.
 * For custom output formats, you can build your own from the `metrics` object directly,
 * or provide a custom `outputBuilder` function in the options.
 * 
 * @param columnsUsed - Set of column names used by the intervention
 * @param facet - Original facet containing entity data
 * @param metrics - Metrics produced by the intervention simulation
 * @param opts - Configuration options
 * @returns A facet-like object with getRowCount() and getRow(i) methods
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
  const reserved = new Set(['uprn', 'id', 'year', 'geometry']);

  const rawUsedCols = Array.from(columnsUsed || []);
  const usedCols: string[] = [];
  const seen = new Set(['uprn', 'id', 'year', 'geometry']);
  for (const name of rawUsedCols) {
    if (!name) continue;
    const key = ci(name);
    if (reserved.has(key) || seen.has(key)) continue;
    usedCols.push(name);
    seen.add(key);
  }

  // build facet index
  const facetCount = facet?.getRowCount?.() ?? 0;
  const facetById = new Map<string, any>();
  for (let i = 0; i < facetCount; i++) {
    const row = facet.getRow(i) || {};
    const id = row?.id ?? row?.uprn ?? row?.UPRN;
    if (id != null) facetById.set(String(id), row);
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
  const metricEntries: Array<{ id: string, year: string, stats: any }> = [];
  const statsKeyOrder: string[] = [];
  const statsKeySeen = new Set<string>();

  const pushStatsKeys = (obj: any) => {
    if (!obj) return;
    for (const k of Object.keys(obj)) {
      if (k === 'uprn' || k === 'id' || k === 'building' || k === 'entity' || k === 'year' || k === 'geometry') continue;
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
      const id = item.building ?? item.entity ?? stats.uprn ?? stats.id ?? stats.building ?? stats.entity;
      if (id == null) continue;
      metricEntries.push({ id: String(id), year: yearKey, stats });
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

  // check if geometry exists in facet to carry it forward as first-class
  const hasGeometry = facetHasColCI('geometry');
  const columns = ['id', 'year', ...statsKeyOrder, ...carryCols];
  if (hasGeometry) columns.push('geometry');

  const data: any[] = [];
  const seenId = new Set<string>();

  const buildRow = (id: string, year: any, stats: any, facetRow: any) => {
    const row: any = { id, year };
    for (const c of statsKeyOrder) row[c] = Object.prototype.hasOwnProperty.call(stats, c) ? stats[c] : N_A;
    for (const c of carryCols) {
      const v = getCI(facetRow, c);
      row[c] = v !== undefined ? v : N_A;
    }
    if (hasGeometry) {
      const g = getCI(facetRow, 'geometry');
      row.geometry = g !== undefined ? g : null;
    }
    // Backward compatibility for uprn
    if (row.uprn === undefined) row.uprn = id;
    return row;
  };

  for (const {id, year, stats} of metricEntries) {
    const facetRow = facetById.get(id) || {};
    data.push(buildRow(id, year, stats, facetRow));
    seenId.add(id);
  }

  if (includeUntouched) {
    for (let i = 0; i < facetCount; i++) {
      const row = facet.getRow(i) || {};
      const id = String(row?.id ?? row?.uprn ?? row?.UPRN ?? "");
      if (!id || seenId.has(id)) continue;
      data.push(buildRow(id, N_A, {}, row));
    }
  }

  // Use custom output builder if provided
  if (outputBuilder) {
    // For outputBuilder, we might still want to provide array format if that's what's expected,
    // but building objects is more robust for internal chaining.
    // If outputBuilder expects arrays, it can do Object.values(row) based on columns.
    return outputBuilder(columns, data.map(r => columns.map(c => r[c])), facet);
  }
  
  return {
    columns,
    getRowCount: () => data.length,
    getRow: (i: number) => data[i],
    colNames: columns
  };
}