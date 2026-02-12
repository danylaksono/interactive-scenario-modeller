import type { PluginRegistration } from "../../plugin";
import type { Building, SimulationContext } from "../../types";

export type PolicyTimelineValidatorPluginOptions = {
  name?: string;
  version?: string;
  policyStateKey?: string;
  requiredYearsStateKey?: string;
  strictCoverage?: boolean;
  requireCurrentYearPolicy?: boolean;
};

type PolicyRecord = {
  enabledBuildingTypes?: string[];
  minEfficiencyStandard?: number;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseYearKey(key: string): number | null {
  const parsed = Number(key);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function validateTimelineShape(
  timeline: unknown,
  pluginName: string,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isPlainObject(timeline)) {
    return {
      valid: false,
      errors: [`${pluginName}: timeline must be an object keyed by year`],
    };
  }

  for (const [yearKey, policy] of Object.entries(timeline)) {
    const parsedYear = parseYearKey(yearKey);
    if (parsedYear === null) {
      errors.push(`${pluginName}: invalid year key "${yearKey}" in policy timeline`);
      continue;
    }

    if (!isPlainObject(policy)) {
      errors.push(`${pluginName}: policy for year ${parsedYear} must be an object`);
      continue;
    }

    const record = policy as PolicyRecord;

    if (
      record.enabledBuildingTypes !== undefined &&
      (!Array.isArray(record.enabledBuildingTypes) ||
        record.enabledBuildingTypes.some((type) => typeof type !== "string"))
    ) {
      errors.push(
        `${pluginName}: enabledBuildingTypes for year ${parsedYear} must be an array of strings`,
      );
    }

    if (
      record.minEfficiencyStandard !== undefined &&
      (typeof record.minEfficiencyStandard !== "number" ||
        !Number.isFinite(record.minEfficiencyStandard))
    ) {
      errors.push(
        `${pluginName}: minEfficiencyStandard for year ${parsedYear} must be a finite number`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateCoverage(
  timeline: unknown,
  requiredYears: unknown,
  pluginName: string,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(requiredYears)) {
    return {
      valid: false,
      errors: [`${pluginName}: requiredYears must be an array when strictCoverage is enabled`],
    };
  }

  if (!isPlainObject(timeline)) {
    return {
      valid: false,
      errors: [`${pluginName}: timeline must be an object keyed by year`],
    };
  }

  const timelineYears = new Set(Object.keys(timeline));

  for (const year of requiredYears) {
    if (typeof year !== "number" || !Number.isFinite(year)) {
      errors.push(`${pluginName}: required year value "${String(year)}" is not a finite number`);
      continue;
    }
    if (!timelineYears.has(String(year))) {
      errors.push(`${pluginName}: missing policy definition for required year ${year}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function createPolicyTimelineValidatorPlugin(
  options: PolicyTimelineValidatorPluginOptions = {},
): PluginRegistration {
  const name = options.name ?? "policy-timeline-validator";
  const version = options.version ?? "1.0.0";
  const policyStateKey = options.policyStateKey ?? "activePolicies";
  const requiredYearsStateKey = options.requiredYearsStateKey ?? "requiredPolicyYears";
  const strictCoverage = options.strictCoverage ?? false;
  const requireCurrentYearPolicy = options.requireCurrentYearPolicy ?? false;

  const constraint = (_building: Building, context: SimulationContext) => {
    const markerKey = `__validated_${name}`;
    const state = context.state as Record<string, unknown>;

    if (state[markerKey] === true) return true;

    const timeline = state[policyStateKey];
    const shapeValidation = validateTimelineShape(timeline, name);

    if (!shapeValidation.valid) {
      throw new Error(shapeValidation.errors.join("; "));
    }

    if (strictCoverage) {
      const coverageValidation = validateCoverage(
        timeline,
        state[requiredYearsStateKey],
        name,
      );
      if (!coverageValidation.valid) {
        throw new Error(coverageValidation.errors.join("; "));
      }
    }

    if (requireCurrentYearPolicy && isPlainObject(timeline) && !timeline[String(context.year)]) {
      throw new Error(`${name}: missing policy definition for current year ${context.year}`);
    }

    state[markerKey] = true;
    return true;
  };

  return {
    manifest: {
      name,
      version,
      kind: ["constraint"],
      description: "Validates policy timeline schema and optional year coverage",
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
