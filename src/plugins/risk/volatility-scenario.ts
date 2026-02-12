import type { PluginRegistration } from "../../plugin";
import type { Building, SimulationContext } from "../../types";

export type VolatilityScenarioPluginOptions = {
  name?: string;
  version?: string;
  inputPriceField?: string;
  outputPriceField?: string;
  outputMultiplierField?: string;
  yearStateKey?: string;
  seasonStateKey?: string;
  fallbackMultiplier?: number;
  volatilityMapStateKey?: string;
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function resolveMultiplier(
  source: unknown,
  year: number,
  season: string | null,
  fallback: number,
): number {
  if (!source || typeof source !== "object") return fallback;
  const map = source as Record<string, any>;

  const yearEntry = map[String(year)];
  if (yearEntry !== undefined) {
    if (typeof yearEntry === "number") return toNumber(yearEntry, fallback);
    if (typeof yearEntry === "string") return toNumber(yearEntry, fallback);
    if (yearEntry && typeof yearEntry === "object" && season) {
      const seasonal = toNumber((yearEntry as Record<string, any>)[season], Number.NaN);
      if (Number.isFinite(seasonal)) return seasonal;
    }
  }

  if (season) {
    const seasonalFlat = toNumber(map[season], Number.NaN);
    if (Number.isFinite(seasonalFlat)) return seasonalFlat;
  }

  const global = toNumber(map.default, Number.NaN);
  if (Number.isFinite(global)) return global;

  return fallback;
}

export function createVolatilityScenarioPlugin(
  options: VolatilityScenarioPluginOptions = {},
): PluginRegistration {
  const name = options.name ?? "risk-volatility-scenario";
  const version = options.version ?? "1.0.0";
  const inputPriceField = options.inputPriceField ?? "energyPrice";
  const outputPriceField = options.outputPriceField ?? "volatilityAdjustedPrice";
  const outputMultiplierField = options.outputMultiplierField ?? "volatilityMultiplier";
  const yearStateKey = options.yearStateKey ?? "volatilityYear";
  const seasonStateKey = options.seasonStateKey ?? "volatilitySeasonByYear";
  const fallbackMultiplier = options.fallbackMultiplier ?? 1;
  const volatilityMapStateKey = options.volatilityMapStateKey ?? "priceVolatilityMultipliers";

  const upgrade = (building: Building, context: SimulationContext) => {
    const state = context.state as Record<string, any>;
    const basePrice = toNumber((building as any)?.[inputPriceField], 0);

    const configuredYear = toNumber(state[yearStateKey], context.year);
    const year = Number.isFinite(configuredYear) ? configuredYear : context.year;

    const seasonRaw = state[seasonStateKey]?.[year] ?? state[seasonStateKey]?.[String(year)];
    const season = seasonRaw === undefined || seasonRaw === null ? null : String(seasonRaw);

    const multiplier = resolveMultiplier(
      state[volatilityMapStateKey],
      year,
      season,
      fallbackMultiplier,
    );

    return {
      [outputPriceField]: basePrice * multiplier,
      [outputMultiplierField]: multiplier,
      volatilityYear: year,
      volatilitySeason: season,
    };
  };

  return {
    manifest: {
      name,
      version,
      kind: ["upgrade"],
      description: "Applies year/season volatility multipliers to building price metrics",
      entry: "internal:plugin",
      compat: {
        package: "interactive-scenario-modeller",
        minVersion: "0.1.0",
      },
      trusted: true,
      exports: {
        upgrade: "upgrade",
      },
    },
    upgrade,
  };
}