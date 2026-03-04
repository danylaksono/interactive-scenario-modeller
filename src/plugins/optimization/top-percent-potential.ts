import type { PluginRegistration } from "../../plugin";
import type { Entity, SimulationContext } from "../../types";

export type TopPercentPotentialOptions = {
  name?: string;
  version?: string;
  rankField?: string;
  rankCountField?: string;
  percentile?: number;
  statePercentileKey?: string;
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function createTopPercentPotentialPlugin(
  options: TopPercentPotentialOptions = {},
): PluginRegistration {
  const name = options.name ?? "optimization-top-percent-potential";
  const version = options.version ?? "1.0.0";
  const rankField = options.rankField ?? "potentialRank";
  const rankCountField = options.rankCountField ?? "potentialRankCount";
  const percentile = options.percentile ?? 0.01;
  const statePercentileKey = options.statePercentileKey ?? "topPercentile";

  const constraint = (entity: Entity, context: SimulationContext) => {
    const rank = toNumber((entity as any)?.[rankField], Number.NaN);
    const rankCount = toNumber((entity as any)?.[rankCountField], Number.NaN);
    if (!Number.isFinite(rank) || !Number.isFinite(rankCount) || rankCount <= 0) return false;

    const statePercentile = toNumber((context.state as any)?.[statePercentileKey], percentile);
    const effectivePercentile = Math.min(1, Math.max(0, statePercentile));
    const maxAllowedRank = Math.max(1, Math.ceil(rankCount * effectivePercentile));

    return rank <= maxAllowedRank;
  };

  return {
    manifest: {
      name,
      version,
      kind: ["constraint"],
      description: "Selects entities within top percentile using precomputed potential rank",
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
