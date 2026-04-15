import { Entity, State, Metrics, PropertySpec, PredicateFilter, PredicatePrioritise, PredicateUpgrade, PredicateTransform, SimulationContext } from "./types";
import { buildSimulatedDataFacet } from "./simulated-facet";
import { getPredicate } from "./registry";
import { getPlugin } from "./plugin";

/**
 * Configuration options for creating an Intervention.
 */
export type InterventionOptions = {
  /** Human-readable description of the intervention */
  description?: string;
  /** Data facet adapter providing entity data. Must implement FacetLike interface. */
  facet?: any; 
  /** Starting year for the intervention (inclusive) */
  startYear?: number;
  /** Ending year for the intervention (inclusive) */
  endYear?: number;
  /** Function returning property specification for inputs/outputs */
  propertySpec?: () => PropertySpec;
  /** Function to transform facet rows into Entity objects */
  setupEntity?: (row: any, entity?: Entity) => Entity;
  /** Filter predicate: determines which entities are eligible for transformation. Can be a function or a registered name. */
  filter?: PredicateFilter;
  /** Prioritization predicate: determines order of transformations. Can be a function, a registered name, or "random". */
  prioritise?: PredicatePrioritise;
  /** Upgrade predicate: applies transformation and returns metric deltas. Can be a function or a registered name. */
  upgrade?: PredicateUpgrade;
  /** Alias for upgrade. Transformation predicate: applies change and returns metric deltas. */
  transform?: PredicateTransform;
  /** Alias for upgrade. Transformation predicate: applies change and returns metric deltas. */
  apply?: PredicateTransform;
  /**
   * When non-empty, each entity uses the first transform in the list that returns a
   * non-empty delta (keys other than `year` / `step`). Ignores `upgrade` / `transform` / `apply` for applying changes.
   */
  upgradeChain?: Array<PredicateUpgrade | string>;
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
 * Core class for modeling interventions.
 */
export class Intervention {
  name: string;
  description: string;
  facet: any;
  startYear: number | null;
  endYear: number | null;
  propertySpec?: () => PropertySpec;
  setupEntity?: (row: any, entity?: Entity) => Entity;
  
  private _filter: PredicateFilter;
  private _prioritise: PredicatePrioritise;
  private _upgrade: PredicateUpgrade;
  private _upgradeChain: Array<PredicateUpgrade | string> | null;
  
  init: (context: SimulationContext) => void;
  finalise: (context: SimulationContext) => void;
  initYear: (year: number, context: SimulationContext, metrics?: Metrics) => void;
  finaliseYear: (year: number, context: SimulationContext, metrics?: Metrics) => void;
  
  private _entities: Entity[] | null;
  simulatedFacet: any | null;

  constructor(name: string, opts: InterventionOptions = {}) {
    this.name = name;
    this.description = opts.description ?? "";
    this.facet = opts.facet;
    this.startYear = opts.startYear ?? null;
    this.endYear = opts.endYear ?? null;
    this.propertySpec = opts.propertySpec;
    this.setupEntity = opts.setupEntity;
    
    this._filter = opts.filter ?? (() => true);
    this._prioritise = opts.prioritise ?? (() => 0);
    this._upgrade = opts.transform ?? opts.apply ?? opts.upgrade ?? (() => ({}));
    this._upgradeChain =
      Array.isArray(opts.upgradeChain) && opts.upgradeChain.length > 0 ? opts.upgradeChain : null;
    
    this.init = opts.init ?? (() => {});
    this.finalise = opts.finalise ?? (() => {});
    this.initYear = opts.initYear ?? (() => {});
    this.finaliseYear = opts.finaliseYear ?? (() => {});
    
    this._entities = null;
    this.simulatedFacet = null;
  }

  /**
   * Backward compatible getter for entities.
   */
  get entities(): Entity[] | null { return this._entities; }
  set entities(v: Entity[] | null) { this._entities = v; }

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

  private isNonEmptyUpgradeDelta(delta: any) {
    if (!delta || typeof delta !== "object") return false;
    return Object.keys(delta).some((k) => k !== "year" && k !== "step");
  }

  get filter(): PredicateFilter { return this._filter; }
  set filter(v: PredicateFilter) { this._filter = v; }
  get prioritise(): PredicatePrioritise { return this._prioritise; }
  set prioritise(v: PredicatePrioritise) { this._prioritise = v; }
  get upgrade(): PredicateUpgrade { return this._upgrade; }
  set upgrade(v: PredicateUpgrade) { this._upgrade = v; }
  get transform(): PredicateTransform { return this._upgrade; }
  set transform(v: PredicateTransform) { this._upgrade = v; }
  get apply(): PredicateTransform { return this._upgrade; }
  set apply(v: PredicateTransform) { this._upgrade = v; }

  isSeed() {
    return !(Number.isFinite(this.startYear as number) && Number.isFinite(this.endYear as number));
  }

  update(opts: Partial<InterventionOptions>) {
    Object.assign(this, opts);
    if (opts.setupEntity !== undefined) this.setupEntity = opts.setupEntity;
    if (opts.filter !== undefined) this._filter = opts.filter;
    if (opts.prioritise !== undefined) this._prioritise = opts.prioritise;
    if (opts.transform !== undefined) this._upgrade = opts.transform;
    else if (opts.apply !== undefined) this._upgrade = opts.apply;
    else if (opts.upgrade !== undefined) this._upgrade = opts.upgrade;
    if (opts.upgradeChain !== undefined) {
      this._upgradeChain =
        Array.isArray(opts.upgradeChain) && opts.upgradeChain.length > 0 ? opts.upgradeChain : null;
    }
    return this;
  }

  simulate(entitiesInput: Entity[] | null = null, sharedResources: any = null) {
    if (this.isSeed()) {
      console.warn(`Intervention "${this.name}" is a seed; simulate() skipped.`);
      return { state: {}, metrics: {}, entities: [], columns: new Set<string>() };
    }

    const spec = this.propertySpec?.() ?? { columns: [], entityProperties: [], stateProperties: [], metrics: [] };

    // Prepare entities
    let entities: Entity[] = [];
    if (!entitiesInput) {
      const count = this.facet?.getRowCount?.() ?? 0;
      entities = new Array(count);
      for (let i = 0; i < count; i++) {
        const row = this.facet.getRow(i);
        entities[i] = this.setupEntity ? this.setupEntity(row) : { ...row };
      }
    } else {
      entities = entitiesInput.slice();
      const byId = new Map(entities.filter(e => e && (e.id !== undefined || e.uprn !== undefined)).map(e => [String(e.id ?? e.uprn), e]));
      const count = this.facet?.getRowCount?.() ?? 0;
      for (let i = 0; i < count; i++) {
        const row = this.facet.getRow(i);
        const id = row?.id ?? row?.uprn ?? row?.UPRN;
        if (id !== undefined && id !== null) {
          const hit = byId.get(String(id));
          if (hit && this.setupEntity) this.setupEntity(row, hit);
        }
      }
    }

    this.entities = entities;

    let order = 0;
    const state: State = {};
    const metrics: Metrics = {};

    // Use shared resources or create a local one
    const resourcesMap = sharedResources instanceof Map ? sharedResources : new Map(Object.entries(sharedResources || {}));
    const resources: SimulationContext['resources'] = {
      get: (key) => resourcesMap.get(key),
      set: (key, val) => { resourcesMap.set(key, val); },
      has: (key, amount) => (resourcesMap.get(key) ?? 0) >= amount,
      consume: (key, amount) => {
        const current = resourcesMap.get(key) ?? 0;
        if (current >= amount) {
          resourcesMap.set(key, current - amount);
          return true;
        }
        return false;
      }
    };

    // Create persistent context
    const context: SimulationContext = {
      year: this.startYear!,
      step: this.startYear!,
      state,
      resources,
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
    const upgradeFn = this._upgradeChain?.length ? null : this.resolvePredicate(this._upgrade);
    const prioritiseFn = this._prioritise === "random" ? "random" : this.resolvePredicate(this._prioritise);

    const start = this.startYear ?? 0;
    const end = this.endYear ?? 0;

    for (let stepVal = start; stepVal <= end; stepVal++) {
      const stepKey = String(stepVal);
      metrics[stepKey] = [];
      context.year = stepVal; // for backward compatibility
      context.step = stepVal;
      this.initYear(stepVal, context, metrics as any);

      // filter
      const eligibleIdx: number[] = [];
      for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        if (!e) continue;
        try {
          if (filterFn && filterFn(e, context)) eligibleIdx.push(i);
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
            return prioritiseFn(entities[ia], entities[ib], context) || 0;
          } catch (e) {
            context.logger.error("Prioritise error:", e);
            return 0;
          }
        });
      }

      // upgrade (transform)
      for (const idx of eligibleIdx) {
        const e = entities[idx];
        if (!e) continue;
        let delta: any = {};
        try {
          if (this._upgradeChain?.length) {
            for (const step of this._upgradeChain) {
              const fn = this.resolvePredicate(step as any);
              if (!fn) continue;
              delta = fn(e, context) || {};
              if (this.isNonEmptyUpgradeDelta(delta)) break;
            }
          } else if (upgradeFn) {
            delta = upgradeFn(e, context) || {};
          }
        } catch (e) {
          context.logger.error("Transformation error:", e);
        }
        if (delta && Object.keys(delta).length > 0) {
          const stats = { ...delta };
          if (stats.entity === undefined) {
            stats.entity = e.id ?? e.uprn ?? e.UPRN;
          }
          if (stats.entity === undefined) stats.entity = stats.entity;
          if (stats.year === undefined) stats.year = stepVal;
          if (stats.step === undefined) stats.step = stepVal;
          if (stats.order === undefined) stats.order = ++order;
          metrics[stepKey].push({ entity: stats.entity, building: stats.entity, stats });
        }
      }

      this.finaliseYear(stepVal, context, metrics as any);
    }

    this.finalise(context);

    const columns = new Set((spec.columns || []).map((c: any) => typeof c === 'string' ? c : c.name));
    this.simulatedFacet = buildSimulatedDataFacet(columns, this.facet, metrics);

    return { state, metrics, entities: entities, columns };
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