import type { PluginRegistration } from "../../plugin";
import type { Entity, SimulationContext } from "../../types";

export type ArchetypeConstraintRule = {
  /** If set, entity archetype must be one of these strings */
  archetypes?: string[];
  /** If set, entity intervention / measure type must match one */
  interventionTypes?: string[];
  /** If set, listed status must be truthy (non-empty, not "none") when true, or falsy when false */
  listed?: boolean;
  /** If set, conservation-area flag must match */
  inConservationArea?: boolean;
  /** When the rule matches, this is the constraint result (true = eligible) */
  allow: boolean;
};

export type ArchetypeConstraintOptions = {
  name?: string;
  version?: string;
  archetypeField?: string;
  interventionField?: string;
  listedField?: string;
  conservationField?: string;
  /** First matching rule wins. If none match, defaultAllow is used. */
  rules?: ArchetypeConstraintRule[];
  defaultAllow?: boolean;
};

function toBoolConservation(value: unknown): boolean | null {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "y" || s === "yes" || s === "true") return true;
    if (s === "n" || s === "no" || s === "false") return false;
  }
  return null;
}

function isListed(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value === null || value === undefined) return false;
  const s = String(value).trim().toLowerCase();
  if (!s || s === "none" || s === "n/a" || s === "false" || s === "no") return false;
  return true;
}

function matchesRule(entity: Entity, rule: ArchetypeConstraintRule, fields: Required<Pick<ArchetypeConstraintOptions, "archetypeField" | "interventionField" | "listedField" | "conservationField">>) {
  if (rule.archetypes?.length) {
    const a = String((entity as any)[fields.archetypeField] ?? "");
    if (!rule.archetypes.includes(a)) return false;
  }

  if (rule.interventionTypes?.length) {
    const t = String((entity as any)[fields.interventionField] ?? "");
    if (!rule.interventionTypes.includes(t)) return false;
  }

  if (rule.listed !== undefined) {
    const listed = isListed((entity as any)[fields.listedField]);
    if (listed !== rule.listed) return false;
  }

  if (rule.inConservationArea !== undefined) {
    const c = toBoolConservation((entity as any)[fields.conservationField]);
    if (c === null || c !== rule.inConservationArea) return false;
  }

  return true;
}

/**
 * Declarative eligibility rules for building archetypes, listed-building status,
 * conservation areas, and intervention types. Use as an intervention `filter`
 * (constraint plugins are boolean predicates on a single entity).
 */
export function createArchetypeConstraintPlugin(options: ArchetypeConstraintOptions = {}): PluginRegistration {
  const name = options.name ?? "laep-archetype-constraint";
  const version = options.version ?? "1.0.0";
  const archetypeField = options.archetypeField ?? "buildingArchetype";
  const interventionField = options.interventionField ?? "interventionType";
  const listedField = options.listedField ?? "listedStatus";
  const conservationField = options.conservationField ?? "inConservationArea";
  const rules = options.rules ?? [];
  const defaultAllow = options.defaultAllow ?? true;
  const fields = { archetypeField, interventionField, listedField, conservationField };

  const constraint = (entity: Entity, _context: SimulationContext) => {
    for (const rule of rules) {
      if (matchesRule(entity, rule, fields)) {
        return rule.allow;
      }
    }
    return defaultAllow;
  };

  return {
    manifest: {
      name,
      version,
      kind: ["constraint"],
      description:
        "Blocks or allows interventions based on archetype, listed-building, conservation, and intervention type rules",
      entry: "internal:plugin",
      compat: { package: "interactive-scenario-modeller", minVersion: "0.1.0" },
      trusted: true,
      exports: { constraint: "constraint" },
    },
    constraint,
  };
}
