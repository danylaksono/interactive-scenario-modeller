import type { PluginRegistration } from "../../plugin";
import type { Entity, SimulationContext } from "../../types";

export type SequentialEnablementPluginOptions = {
  name?: string;
  version?: string;
  requiredInterventionField?: string;
  completedInterventionsField?: string;
  stateCompletionsKey?: string;
  entityIdField?: string;
  defaultRequiredIntervention?: string;
  allowIfNoRequirement?: boolean;
};

function toStringArray(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (Array.isArray(value)) {
    return value
      .filter((entry) => typeof entry === "string" && entry.trim())
      .map((entry) => String(entry).trim());
  }
  return [];
}

function hasCompletionOnEntity(
  entity: Entity,
  required: string,
  completedInterventionsField: string,
): boolean {
  const completed = (entity as any)?.[completedInterventionsField];

  if (Array.isArray(completed)) return completed.includes(required);
  if (completed && typeof completed === "object") return Boolean((completed as any)[required]);

  return false;
}

function hasCompletionInState(
  state: Record<string, any>,
  required: string,
  stateCompletionsKey: string,
  entityId: string,
): boolean {
  const store = state[stateCompletionsKey];
  if (!store || typeof store !== "object") return false;

  const bucket = store[required];
  if (!bucket) return false;
  if (bucket === true) return true;

  if (Array.isArray(bucket)) return bucket.includes(entityId);
  if (typeof bucket === "object") return Boolean(bucket[entityId]);

  return false;
}

export function createSequentialEnablementPlugin(
  options: SequentialEnablementPluginOptions = {},
): PluginRegistration {
  const name = options.name ?? "grid-sequential-enablement";
  const version = options.version ?? "1.0.0";
  const requiredInterventionField = options.requiredInterventionField ?? "requiresIntervention";
  const completedInterventionsField = options.completedInterventionsField ?? "completedInterventions";
  const stateCompletionsKey = options.stateCompletionsKey ?? "completedInterventionsByName";
  const entityIdField = options.entityIdField ?? "uprn";
  const defaultRequiredIntervention = options.defaultRequiredIntervention;
  const allowIfNoRequirement = options.allowIfNoRequirement ?? true;

  const constraint = (entity: Entity, context: SimulationContext) => {
    const requirements = toStringArray(
      (entity as any)?.[requiredInterventionField] ?? defaultRequiredIntervention,
    );

    if (requirements.length === 0) return allowIfNoRequirement;

    const entityIdRaw = (entity as any)?.[entityIdField] ?? (entity as any)?.uprn;
    const entityId =
      entityIdRaw === undefined || entityIdRaw === null ? "" : String(entityIdRaw);

    if (!entityId) return false;

    const state = context.state as Record<string, any>;

    return requirements.every((required) => {
      if (hasCompletionOnEntity(entity, required, completedInterventionsField)) {
        return true;
      }

      return hasCompletionInState(state, required, stateCompletionsKey, entityId);
    });
  };

  return {
    manifest: {
      name,
      version,
      kind: ["constraint"],
      description: "Gates upgrades based on completion of prerequisite interventions",
      entry: "internal:plugin",
      compat: {
        package: "interactive-scenario-modeller",
        minVersion: "0.1.0",
      },
      trusted: true,
      exports: {
        constraint: "constraint",
      },
    },
    constraint,
  };
}
