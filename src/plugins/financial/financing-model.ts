import type { PluginRegistration } from "../../plugin";
import type { Entity, SimulationContext } from "../../types";

export type FinancingModelType = "cash" | "lease" | "ppa";

export type FinancingScenario = {
  modelType?: FinancingModelType;
  interestRate?: number;
  discountRate?: number;
  termYears?: number;
  ppaRatePerKwh?: number;
  expectedAnnualGenerationKwh?: number;
  escalationRate?: number;
};

export type FinancingModelPluginOptions = {
  name?: string;
  version?: string;
  capexField?: string;
  scenarioStateKey?: string;
  scenarioField?: string;
  outputAnnualPaymentKey?: string;
  outputNpvCostKey?: string;
  outputModelTypeKey?: string;
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function annuityPayment(principal: number, rate: number, years: number): number {
  if (years <= 0) return principal;
  if (rate <= 0) return principal / years;
  const factor = rate / (1 - Math.pow(1 + rate, -years));
  return principal * factor;
}

function npvOfEscalatingSeries(
  initialPayment: number,
  years: number,
  discountRate: number,
  escalationRate: number,
): number {
  let npv = 0;
  for (let year = 1; year <= Math.max(1, years); year++) {
    const payment = initialPayment * Math.pow(1 + escalationRate, year - 1);
    npv += payment / Math.pow(1 + discountRate, year);
  }
  return npv;
}

export function createFinancingModelPlugin(
  options: FinancingModelPluginOptions = {},
): PluginRegistration {
  const name = options.name ?? "financial-financing-model";
  const version = options.version ?? "1.0.0";

  const capexField = options.capexField ?? "estimatedPVCost";
  const scenarioStateKey = options.scenarioStateKey ?? "financing";
  const scenarioField = options.scenarioField ?? "financing";

  const outputAnnualPaymentKey = options.outputAnnualPaymentKey ?? "annualPayment";
  const outputNpvCostKey = options.outputNpvCostKey ?? "npvCost";
  const outputModelTypeKey = options.outputModelTypeKey ?? "modelType";

  const upgrade = (entity: Entity, context: SimulationContext) => {
    const capex = toNumber((entity as any)?.[capexField], 0);

    const stateScenario = (context.state as any)?.[scenarioStateKey] ?? {};
    const entityScenario = (entity as any)?.[scenarioField] ?? {};

    const modelType =
      (entityScenario.modelType as FinancingModelType | undefined) ??
      (stateScenario.modelType as FinancingModelType | undefined) ??
      "cash";

    const termYears = toNumber(
      entityScenario.termYears ?? stateScenario.termYears,
      20,
    );
    const interestRate = toNumber(
      entityScenario.interestRate ?? stateScenario.interestRate,
      0.05,
    );
    const discountRate = toNumber(
      entityScenario.discountRate ?? stateScenario.discountRate,
      0.035,
    );
    const escalationRate = toNumber(
      entityScenario.escalationRate ?? stateScenario.escalationRate,
      0,
    );

    let annualPayment = 0;
    let npvCost = 0;

    if (modelType === "lease") {
      annualPayment = annuityPayment(capex, interestRate, termYears);
      npvCost = npvOfEscalatingSeries(annualPayment, termYears, discountRate, escalationRate);
    } else if (modelType === "ppa") {
      const ratePerKwh = toNumber(
        entityScenario.ppaRatePerKwh ?? stateScenario.ppaRatePerKwh,
        0,
      );
      const expectedAnnualGenerationKwh = toNumber(
        entityScenario.expectedAnnualGenerationKwh ??
          stateScenario.expectedAnnualGenerationKwh,
        0,
      );

      annualPayment = expectedAnnualGenerationKwh * ratePerKwh;
      npvCost = npvOfEscalatingSeries(annualPayment, termYears, discountRate, escalationRate);
    } else {
      annualPayment = capex;
      npvCost = capex;
    }

    return {
      [outputAnnualPaymentKey]: annualPayment,
      [outputNpvCostKey]: npvCost,
      [outputModelTypeKey]: modelType,
      year: context.year,
    };
  };

  return {
    manifest: {
      name,
      version,
      kind: ["upgrade"],
      description: "Computes financing outputs for cash, lease, and PPA models",
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
