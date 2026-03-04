import type { SimulationContext } from "../types";
import {
  installAllPlugins,
  type AllBundleInstallOptions,
} from "../plugins/installers";

export type ScenarioTemplateStateDefaults = {
  budgetAllocation?: Record<number, number>;
  budgetSpent?: Record<number, number>;
  activePolicies?: Record<number, { enabledEntityTypes?: string[]; minEfficiencyStandard?: number }>;
  requiredPolicyYears?: number[];
  substationCapacities?: Record<string, number> | Record<number, Record<string, number>>;
  substationLoads?: Record<number, Record<string, number>>;
  fuelPovertyPriority?: {
    threshold?: number;
    weights?: {
      fuelPovertyScore?: number;
      carbonSavingPotential?: number;
    };
  };
  financing?: {
    modelType?: "cash" | "lease" | "ppa";
    interestRate?: number;
    discountRate?: number;
    termYears?: number;
    ppaRatePerKwh?: number;
    expectedAnnualGenerationKwh?: number;
    escalationRate?: number;
  };
  completedInterventionsByName?: Record<string, true | Record<string, boolean> | string[]>;
};

export type ScenarioTemplateOptions = {
  installPlugins?: boolean;
  pluginOptions?: AllBundleInstallOptions;
  stateDefaults?: ScenarioTemplateStateDefaults;
};

export type ScenarioTemplate = {
  pluginRefs: ReturnType<typeof installAllPlugins> | null;
  stateDefaults: ScenarioTemplateStateDefaults;
  applyStateDefaults: (state: Record<string, any>) => Record<string, any>;
  init: (context: SimulationContext) => void;
  withInit: (
    afterInit?: (context: SimulationContext) => void,
  ) => (context: SimulationContext) => void;
};

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map((entry) => cloneValue(entry)) as T;
  if (isPlainObject(value)) {
    const out: Record<string, any> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = cloneValue(entry);
    }
    return out as T;
  }
  return value;
}

function mergeDefaults(target: Record<string, any>, defaults: Record<string, any>) {
  for (const [key, defaultValue] of Object.entries(defaults)) {
    const targetValue = target[key];

    if (targetValue === undefined) {
      target[key] = cloneValue(defaultValue);
      continue;
    }

    if (isPlainObject(targetValue) && isPlainObject(defaultValue)) {
      mergeDefaults(targetValue, defaultValue);
    }
  }
}

function applyOverrides(target: Record<string, any>, overrides: Record<string, any>) {
  for (const [key, overrideValue] of Object.entries(overrides)) {
    if (isPlainObject(overrideValue) && isPlainObject(target[key])) {
      applyOverrides(target[key], overrideValue);
      continue;
    }
    target[key] = cloneValue(overrideValue);
  }
}

function buildStateDefaults(
  provided: ScenarioTemplateStateDefaults | undefined,
): ScenarioTemplateStateDefaults {
  const defaults: ScenarioTemplateStateDefaults = {
    budgetAllocation: {},
    budgetSpent: {},
    activePolicies: {},
    requiredPolicyYears: [],
    substationCapacities: {},
    substationLoads: {},
    fuelPovertyPriority: {
      threshold: 0.5,
      weights: {
        fuelPovertyScore: 0.6,
        carbonSavingPotential: 0.4,
      },
    },
    financing: {
      modelType: "cash",
      interestRate: 0.05,
      discountRate: 0.035,
      termYears: 20,
      escalationRate: 0,
    },
    completedInterventionsByName: {},
  };

  if (!provided) return defaults;

  const merged = cloneValue(defaults);
  applyOverrides(merged as Record<string, any>, provided as Record<string, any>);

  return merged;
}

export function createScenarioTemplate(
  options: ScenarioTemplateOptions = {},
): ScenarioTemplate {
  const installPlugins = options.installPlugins ?? true;
  const pluginRefs = installPlugins ? installAllPlugins(options.pluginOptions) : null;
  const stateDefaults = buildStateDefaults(options.stateDefaults);

  const applyStateDefaults = (state: Record<string, any>) => {
    mergeDefaults(state, stateDefaults as Record<string, any>);
    return state;
  };

  const init = (context: SimulationContext) => {
    applyStateDefaults(context.state as Record<string, any>);
  };

  const withInit = (afterInit?: (context: SimulationContext) => void) => {
    return (context: SimulationContext) => {
      init(context);
      afterInit?.(context);
    };
  };

  return {
    pluginRefs,
    stateDefaults,
    applyStateDefaults,
    init,
    withInit,
  };
}
