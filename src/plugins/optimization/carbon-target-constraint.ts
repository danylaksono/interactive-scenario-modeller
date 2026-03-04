import type { PluginRegistration } from "../../plugin";
import type { Entity, SimulationContext } from "../../types";

export type CarbonTargetConstraintOptions = {
  name?: string;
  version?: string;
  annualTargetKey?: string;
  cumulativeTargetKey?: string;
  annualActualKey?: string;
  cumulativeActualKey?: string;
  projectedReductionField?: string;
  allowWhenMissingTarget?: boolean;
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readYearBucket(state: Record<string, any>, key: string, year: number): number {
  const raw = state[key];
  if (!raw || typeof raw !== "object") return 0;
  return toNumber(raw[year], 0);
}

export function createCarbonTargetConstraintPlugin(
  options: CarbonTargetConstraintOptions = {},
): PluginRegistration {
  const name = options.name ?? "optimization-carbon-target-constraint";
  const version = options.version ?? "1.0.0";
  const annualTargetKey = options.annualTargetKey ?? "carbonTargetByYear";
  const cumulativeTargetKey = options.cumulativeTargetKey ?? "carbonTargetCumulative";
  const annualActualKey = options.annualActualKey ?? "currentCarbonReducedByYear";
  const cumulativeActualKey = options.cumulativeActualKey ?? "currentCarbonReducedCumulative";
  const projectedReductionField = options.projectedReductionField ?? "carbonReductionPotential";
  const allowWhenMissingTarget = options.allowWhenMissingTarget ?? true;

  const constraint = (_entity: Entity, context: SimulationContext) => {
    const state = context.state as Record<string, any>;
    const year = context.year;
    const reservedAnnualKey = `__reservedCarbonByYear_${name}`;
    const reservedCumulativeKey = `__reservedCarbonCumulative_${name}`;

    const annualTarget = readYearBucket(state, annualTargetKey, year);
    const annualActual = readYearBucket(state, annualActualKey, year);
    const annualReserved = readYearBucket(state, reservedAnnualKey, year);

    const cumulativeTarget = toNumber(state[cumulativeTargetKey], 0);
    const cumulativeActual = toNumber(state[cumulativeActualKey], 0);
    const cumulativeReserved = toNumber(state[reservedCumulativeKey], 0);

    const entity = _entity as Entity;
    const projectedReduction = Math.max(
      0,
      toNumber((entity as any)?.[projectedReductionField], 0),
    );

    const hasAnnualTarget = annualTarget > 0;
    const hasCumulativeTarget = cumulativeTarget > 0;

    if (!hasAnnualTarget && !hasCumulativeTarget) {
      return allowWhenMissingTarget;
    }

    if (hasAnnualTarget && annualActual + annualReserved >= annualTarget) {
      return false;
    }

    if (hasCumulativeTarget && cumulativeActual + cumulativeReserved >= cumulativeTarget) {
      return false;
    }

    if (projectedReduction > 0) {
      if (hasAnnualTarget) {
        state[reservedAnnualKey] = state[reservedAnnualKey] ?? {};
        state[reservedAnnualKey][year] = toNumber(state[reservedAnnualKey][year], 0) + projectedReduction;
      }
      if (hasCumulativeTarget) {
        state[reservedCumulativeKey] = toNumber(state[reservedCumulativeKey], 0) + projectedReduction;
      }
    }

    return true;
  };

  return {
    manifest: {
      name,
      version,
      kind: ["constraint"],
      description: "Blocks additional upgrades once carbon reduction targets are reached",
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
