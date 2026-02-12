export type Building = { [k: string]: any } & { uprn?: string | number };
export type State = { [k: string]: any };
export type Metric = { [k: string]: any };
export type Metrics = { [year: string]: Array<{ building: string | number, stats: Metric }> };

/**
 * Standard context passed to all predicates and lifecycle hooks.
 * Provides access to simulation state, current year, and utility functions.
 */
export interface SimulationContext {
  year: number;
  state: State;
  /** Access to the predicate registry for resolving named predicates */
  resolvePredicate: (name: string) => any;
  /** Access to the plugin registry */
  resolvePlugin: (name: string) => any;
  /** Deterministic random number generator helper */
  random: (seed?: number | string) => () => number;
  /** Logger for simulation-specific logging */
  logger: {
    debug: (...args: any[]) => void;
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
  };
}

export type PropertySpec = {
  columns?: Array<{ name: string } | string> | string[];
  buildingProperties?: any[];
  stateProperties?: any[];
  metrics?: string[];
};

export type PredicateFilter = ((building: Building, context: SimulationContext) => boolean) | string;
export type PredicatePrioritise = ((b1: Building, b2: Building, context: SimulationContext) => number) | string | "random";
export type PredicateUpgrade = ((building: Building, context: SimulationContext) => Metric | void) | string;

export type SimulatedFacetOptions = {
  /** Whether to include buildings that were not touched by any intervention */
  includeUntouched?: boolean;
  /** Additional columns from the original facet to carry forward (e.g., geographic identifiers).
   * Defaults to empty array. Set to null to disable automatic column carrying.
   */
  keepColumns?: string[] | null;
  /** Placeholder value for missing data. Defaults to "n/a" */
  naValue?: string;
  /** Custom output builder function. If provided, this will be used instead of the default DataTable builder.
   * Receives: columns, data array, and the original facet.
   * Should return a facet-like object with getRowCount() and getRow(i) methods.
   */
  outputBuilder?: (columns: string[], data: any[][], facet: any) => any;
};