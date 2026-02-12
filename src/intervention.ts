import { Building, State, Metrics, PropertySpec, PredicateFilter, PredicatePrioritise, PredicateUpgrade, SimulationContext } from "./types";
import { buildSimulatedDataFacet } from "./simulated-facet";
import { getPredicate } from "./registry";
import { getPlugin } from "./plugin";

/**
 * Configuration options for creating an Intervention.
 */
export type InterventionOptions = {
  /** Human-readable description of the intervention */
  description?: string;
  /** Data facet adapter providing building data. Must implement FacetLike interface. */
  facet?: any; 
  /** Starting year for the intervention (inclusive) */
  startYear?: number;
  /** Ending year for the intervention (inclusive) */
  endYear?: number;
  /** Function returning property specification for inputs/outputs */
  propertySpec?: () => PropertySpec;
  /** Function to transform facet rows into Building objects */
  setupBuilding?: (row: any, building?: Building) => Building;
  /** Filter predicate: determines which buildings are eligible for upgrade. Can be a function or a registered name. */
  filter?: PredicateFilter;
  /** Prioritization predicate: determines order of upgrades. Can be a function, a registered name, or "random". */
  prioritise?: PredicatePrioritise;
  /** Upgrade predicate: applies upgrade and returns metric deltas. Can be a function or a registered name. */
  upgrade?: PredicateUpgrade;
  /** Initialization hook: called once before simulation starts */
  init?: (context: SimulationContext) => void;
  /** Finalization hook: called once after simulation completes */
  finalise?: (context: SimulationContext) => void;
  /** Year initialization hook: called at the start of each year */
  initYear?: (year: number, context: SimulationContext, metrics?: Metrics) => void;
  /** Year finalization hook: called at the end of each year */
  finaliseYear?: (year: number, context: SimulationContext, metrics?: Metrics) => void;
};

/**
 * Core class for modeling decarbonisation interventions.
 */
export class Intervention {
  name: string;
  description: string;
  facet: any;
  startYear: number | null;
  endYear: number | null;
  propertySpec?: () => PropertySpec;
  setupBuilding?: (row: any, building?: Building) => Building;
  
  private _filter: PredicateFilter;
  private _prioritise: PredicatePrioritise;
  private _upgrade: PredicateUpgrade;
  
  init: (context: SimulationContext) => void;
  finalise: (context: SimulationContext) => void;
  initYear: (year: number, context: SimulationContext, metrics?: Metrics) => void;
  finaliseYear: (year: number, context: SimulationContext, metrics?: Metrics) => void;
  
  buildings: Building[] | null;
  simulatedFacet: any | null;

  constructor(name: string, opts: InterventionOptions = {}) {
    this.name = name;
    this.description = opts.description ?? "";
    this.facet = opts.facet;
    this.startYear = opts.startYear ?? null;
    this.endYear = opts.endYear ?? null;
    this.propertySpec = opts.propertySpec;
    this.setupBuilding = opts.setupBuilding;
    
    this._filter = opts.filter ?? (() => true);
    this._prioritise = opts.prioritise ?? (() => 0);
    this._upgrade = opts.upgrade ?? (() => ({}));
    
    this.init = opts.init ?? (() => {});
    this.finalise = opts.finalise ?? (() => {});
    this.initYear = opts.initYear ?? (() => {});
    this.finaliseYear = opts.finaliseYear ?? (() => {});
    
    this.buildings = null;
    this.simulatedFacet = null;
  }

  /**
   * Resolves a predicate that might be a string (registry name) or a function.
   */
  private resolvePredicate(p: any): any {
    if (typeof p === 'function') return p;
    if (typeof p === 'string') {
      const registered = getPredicate(p);
      if (registered) return registered;
      
      // Try plugin registry if name includes ":" (plugin:predicate format)
      if (p.includes(':')) {
        const [pluginName, exportName] = p.split(':');
        const plugin = getPlugin(pluginName);
        if (plugin && (plugin as any)[exportName]) {
          return (plugin as any)[exportName];
        }
      }
    }
    return null;
  }

  get filter(): PredicateFilter { return this._filter; }
  set filter(v: PredicateFilter) { this._filter = v; }
  get prioritise(): PredicatePrioritise { return this._prioritise; }
  set prioritise(v: PredicatePrioritise) { this._prioritise = v; }
  get upgrade(): PredicateUpgrade { return this._upgrade; }
  set upgrade(v: PredicateUpgrade) { this._upgrade = v; }

  isSeed() {
    return !(Number.isFinite(this.startYear as number) && Number.isFinite(this.endYear as number));
  }

  update(opts: Partial<InterventionOptions>) {
    Object.assign(this, opts);
    if (opts.filter !== undefined) this._filter = opts.filter;
    if (opts.prioritise !== undefined) this._prioritise = opts.prioritise;
    if (opts.upgrade !== undefined) this._upgrade = opts.upgrade;
    return this;
  }

  simulate(buildingsInput: Building[] | null = null) {
    if (this.isSeed()) {
      console.warn(`Intervention "${this.name}" is a seed; simulate() skipped.`);
      return { state: {}, metrics: {}, buildings: [], columns: new Set<string>() };
    }

    const spec = this.propertySpec?.() ?? { columns: [], buildingProperties: [], stateProperties: [], metrics: [] };

    // Prepare buildings
    let bldgs: Building[] = [];
    if (!buildingsInput) {
      const count = this.facet?.getRowCount?.() ?? 0;
      bldgs = new Array(count);
      for (let i = 0; i < count; i++) {
        const row = this.facet.getRow(i);
        bldgs[i] = this.setupBuilding ? this.setupBuilding(row) : { ...row };
      }
    } else {
      bldgs = buildingsInput.slice();
      const byUPRN = new Map(bldgs.filter(b => b && b.uprn !== undefined).map(b => [String(b.uprn), b]));
      const count = this.facet?.getRowCount?.() ?? 0;
      for (let i = 0; i < count; i++) {
        const row = this.facet.getRow(i);
        const uprn = row?.UPRN ?? row?.uprn;
        if (uprn !== undefined && uprn !== null) {
          const hit = byUPRN.get(String(uprn));
          if (hit && this.setupBuilding) this.setupBuilding(row, hit);
        }
      }
    }

    this.buildings = bldgs;

    let order = 0;
    const state: State = {};
    const metrics: Metrics = {};

    // Create persistent context
    const context: SimulationContext = {
      year: this.startYear!,
      state,
      resolvePredicate: (name) => getPredicate(name),
      resolvePlugin: (name) => getPlugin(name),
      random: (seed) => {
        // Basic deterministic RNG stub for library use
        let s = seed ? String(seed).split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0) : Math.random();
        return () => {
          s = Math.sin(s) * 10000;
          return s - Math.floor(s);
        };
      },
      logger: {
        debug: (...args) => console.debug(`[${this.name}]`, ...args),
        info: (...args) => console.log(`[${this.name}]`, ...args),
        warn: (...args) => console.warn(`[${this.name}]`, ...args),
        error: (...args) => console.error(`[${this.name}]`, ...args),
      }
    };

    this.init(context);

    // Resolve predicates once if possible, or inside loop if state-dependent
    const filterFn = this.resolvePredicate(this._filter);
    const upgradeFn = this.resolvePredicate(this._upgrade);
    const prioritiseFn = this._prioritise === "random" ? "random" : this.resolvePredicate(this._prioritise);

    for (let year = (this.startYear as number); year <= (this.endYear as number); year++) {
      metrics[String(year)] = [];
      context.year = year;
      this.initYear(year, context, metrics as any); // Backward compatibility for metrics arg

      // filter
      const eligibleIdx: number[] = [];
      for (let i = 0; i < bldgs.length; i++) {
        const b = bldgs[i];
        if (!b) continue;
        try {
          if (filterFn && filterFn(b, context)) eligibleIdx.push(i);
        } catch (e) {
          context.logger.error("Filter error:", e);
        }
      }

      // prioritise
      if (prioritiseFn === "random") {
        this.shuffle(eligibleIdx);
      } else if (prioritiseFn) {
        eligibleIdx.sort((ia, ib) => {
          try {
            return prioritiseFn(bldgs[ia], bldgs[ib], context) || 0;
          } catch (e) {
            context.logger.error("Prioritise error:", e);
            return 0;
          }
        });
      }

      // upgrade
      for (const idx of eligibleIdx) {
        const b = bldgs[idx];
        if (!b) continue;
        let delta: any = {};
        try {
          if (upgradeFn) {
            delta = upgradeFn(b, context) || {};
          }
        } catch (e) {
          context.logger.error("Upgrade error:", e);
        }
        if (delta && Object.keys(delta).length > 0) {
          const stats = { ...delta };
          if (stats.building === undefined) stats.building = b.uprn ?? b.UPRN ?? b.id;
          if (stats.year === undefined) stats.year = year;
          if (stats.order === undefined) stats.order = ++order;
          metrics[String(year)].push({ building: stats.building, stats });
        }
      }

      this.finaliseYear(year, context, metrics as any);
    }

    this.finalise(context);

    const columns = new Set((spec.columns || []).map((c: any) => typeof c === 'string' ? c : c.name));
    this.simulatedFacet = buildSimulatedDataFacet(columns, this.facet, metrics);

    return { state, metrics, buildings: bldgs, columns };
  }

  private shuffle(a: any[]) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  getPredicateSource(name: string) {
    const fn = (this as any)[`_${name}`] || (this as any)[name];
    return typeof fn === 'function' ? fn.toString() : String(fn);
  }
}