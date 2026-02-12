import type { PluginRegistration } from "../../plugin";
import type { Building, SimulationContext } from "../../types";

export type GridEnergyBalanceReportingPluginOptions = {
  name?: string;
  version?: string;
  substationIdField?: string;
  demandRequirementField?: string;
  generationRequirementField?: string;
  headroomStateKey?: string;
  balanceStateKey?: string;
  outputDemandKey?: string;
  outputGenerationKey?: string;
  outputTotalRequirementKey?: string;
  outputRemainingHeadroomKey?: string;
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function resolveHeadroom(
  source: unknown,
  year: number,
  substationId: string,
): number | null {
  if (!source || typeof source !== "object") return null;

  const map = source as Record<string, any>;
  const yearly = map[String(year)];
  if (yearly && typeof yearly === "object") {
    const value = toNumber(yearly[substationId], Number.NaN);
    if (Number.isFinite(value)) return value;
  }

  const flat = toNumber(map[substationId], Number.NaN);
  if (Number.isFinite(flat)) return flat;

  return null;
}

export function createGridEnergyBalanceReportingPlugin(
  options: GridEnergyBalanceReportingPluginOptions = {},
): PluginRegistration {
  const name = options.name ?? "grid-energy-balance-reporting";
  const version = options.version ?? "1.0.0";
  const substationIdField = options.substationIdField ?? "substationId";
  const demandRequirementField = options.demandRequirementField ?? "projectedDemandIncreaseKw";
  const generationRequirementField = options.generationRequirementField ?? "generationExportKw";
  const headroomStateKey = options.headroomStateKey ?? "substationGenerationHeadroom";
  const balanceStateKey = options.balanceStateKey ?? "gridEnergyBalance";
  const outputDemandKey = options.outputDemandKey ?? "demandRequirementKw";
  const outputGenerationKey = options.outputGenerationKey ?? "generationRequirementKw";
  const outputTotalRequirementKey = options.outputTotalRequirementKey ?? "totalEnergyRequirementKw";
  const outputRemainingHeadroomKey = options.outputRemainingHeadroomKey ?? "remainingHeadroomKw";

  const upgrade = (building: Building, context: SimulationContext) => {
    const state = context.state as Record<string, any>;
    const year = context.year;

    const substationIdRaw = (building as any)?.[substationIdField];
    const substationId =
      substationIdRaw === undefined || substationIdRaw === null
        ? ""
        : String(substationIdRaw);

    const demandRequirement = Math.max(0, toNumber((building as any)?.[demandRequirementField], 0));
    const generationRequirement = Math.max(0, toNumber((building as any)?.[generationRequirementField], 0));
    const totalRequirement = demandRequirement + generationRequirement;

    state[balanceStateKey] = state[balanceStateKey] ?? {};
    state[balanceStateKey][year] = state[balanceStateKey][year] ?? {
      totalDemandKw: 0,
      totalGenerationKw: 0,
      totalRequirementKw: 0,
      remainingHeadroomKw: 0,
      bySubstation: {},
    };

    const yearBalance = state[balanceStateKey][year] as {
      totalDemandKw: number;
      totalGenerationKw: number;
      totalRequirementKw: number;
      remainingHeadroomKw: number;
      bySubstation: Record<string, any>;
    };

    if (substationId) {
      yearBalance.bySubstation[substationId] = yearBalance.bySubstation[substationId] ?? {
        demandKw: 0,
        generationKw: 0,
        totalRequirementKw: 0,
        headroomKw: 0,
        remainingHeadroomKw: 0,
      };

      const bucket = yearBalance.bySubstation[substationId];
      const headroom = Math.max(0, toNumber(resolveHeadroom(state[headroomStateKey], year, substationId), 0));

      bucket.demandKw += demandRequirement;
      bucket.generationKw += generationRequirement;
      bucket.totalRequirementKw += totalRequirement;
      bucket.headroomKw = headroom;
      bucket.remainingHeadroomKw = headroom - bucket.totalRequirementKw;
    }

    yearBalance.totalDemandKw += demandRequirement;
    yearBalance.totalGenerationKw += generationRequirement;
    yearBalance.totalRequirementKw += totalRequirement;

    yearBalance.remainingHeadroomKw = Object.values(yearBalance.bySubstation).reduce(
      (sum, entry: any) => sum + toNumber(entry.remainingHeadroomKw, 0),
      0,
    );

    const remainingHeadroomForSubstation = substationId
      ? toNumber(yearBalance.bySubstation[substationId]?.remainingHeadroomKw, 0)
      : 0;

    return {
      [outputDemandKey]: demandRequirement,
      [outputGenerationKey]: generationRequirement,
      [outputTotalRequirementKey]: totalRequirement,
      [outputRemainingHeadroomKey]: remainingHeadroomForSubstation,
      substationId,
      year,
    };
  };

  return {
    manifest: {
      name,
      version,
      kind: ["upgrade"],
      description: "Calculates demand+generation requirements and tracks remaining substation headroom",
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