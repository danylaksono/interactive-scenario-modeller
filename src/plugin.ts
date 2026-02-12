import { SimulationContext } from "./types";
import { validatePluginRegistration } from "./manifestValidator";

export type PluginKind =
  | 'predicate'
  | 'prioritiser'
  | 'upgrade'
  | 'constraint'
  | 'adapter'
  | 'outputBuilder'
  | 'composite';

export interface PluginCompat {
  package: string; // e.g. 'interactive-scenario-modeller'
  minVersion?: string; // semver
  maxVersion?: string;
}

export interface PluginManifest {
  name: string;
  version: string; // semver
  kind: PluginKind | PluginKind[];
  description?: string;
  entry: string; // module entrypoint (relative path or package entry)
  exports?: Record<string, string>; // map logical export -> exported identifier
  compat?: PluginCompat;
  configSchema?: any; // JSON Schema (light typing here)
  author?: string;
  repository?: string;
  license?: string;
  trusted?: boolean; // whether plugin is vetted/trusted
}

/**
 * Minimal plugin runtime context passed to plugin functions.
 * Now alias to SimulationContext for consistency.
 */
export type PluginContext = SimulationContext;

// Signature shapes for common plugin types
export type PredicateFn<T = any> = (a: T, b: T, ctx: SimulationContext) => number | boolean;
export type PrioritiseFn<T = any> = (a: T, b: T, ctx: SimulationContext) => number;
export type UpgradeFn<T = any> = (building: T, ctx: SimulationContext) => Record<string, any> | Promise<Record<string, any>>;
export type ConstraintFn<T = any> = (building: T, ctx: SimulationContext) => boolean;
export type AdapterFn = (data: any, opts?: any) => any;
export type OutputBuilderFn = (columns: string[], rows: any[], facet: any, opts?: any) => any;

// A plugin package may export multiple functions; this type models a typical registration
export interface PluginRegistration {
  manifest: PluginManifest;
  prioritise?: PrioritiseFn;
  predicate?: PredicateFn;
  upgrade?: UpgradeFn;
  constraint?: ConstraintFn;
  adapter?: AdapterFn;
  outputBuilder?: OutputBuilderFn;
}

// Registry API (lightweight stub)
const pluginRegistry = new Map<string, PluginRegistration>();

export function registerPlugin(reg: PluginRegistration) {
  if (!reg?.manifest?.name) throw new Error('Plugin manifest must include name');
  const validation = validatePluginRegistration(reg);
  if (!validation.valid) throw new Error(`Invalid plugin registration: ${validation.errors.join('; ')}`);
  pluginRegistry.set(reg.manifest.name, reg);
}

export function getPlugin(name: string) {
  return pluginRegistry.get(name);
}

export function listPlugins(): PluginRegistration[] {
  return Array.from(pluginRegistry.values());
}

export type { PluginRegistration as Plugin };