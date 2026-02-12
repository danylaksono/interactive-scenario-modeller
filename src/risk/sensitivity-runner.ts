import type { Intervention } from "../intervention";

export type SensitivityParameter = {
  key: string;
  values: any[];
};

export type SensitivityScenario<TSummary = any> = {
  id: string;
  parameters: Record<string, any>;
  summary: TSummary;
  raw?: any;
};

export type SensitivityAnalysisOptions<TSummary = any> = {
  parameters: SensitivityParameter[];
  createIntervention: () => Intervention;
  baseState?: Record<string, any>;
  summarise?: (result: any) => TSummary;
  includeRaw?: boolean;
};

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map((entry) => cloneValue(entry)) as T;
  if (isPlainObject(value)) {
    const out: Record<string, any> = {};
    for (const [key, entry] of Object.entries(value)) out[key] = cloneValue(entry);
    return out as T;
  }
  return value;
}

function deepMerge(target: Record<string, any>, source: Record<string, any>) {
  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value) && isPlainObject(target[key])) {
      deepMerge(target[key], value);
      continue;
    }
    target[key] = cloneValue(value);
  }
}

function setByPath(target: Record<string, any>, path: string, value: any) {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return;

  let current: Record<string, any> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!isPlainObject(current[part])) current[part] = {};
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

function buildCombinations(parameters: SensitivityParameter[]): Record<string, any>[] {
  if (parameters.length === 0) return [{}];

  const [head, ...rest] = parameters;
  const tail = buildCombinations(rest);
  const out: Record<string, any>[] = [];

  for (const value of head.values) {
    for (const combo of tail) {
      out.push({ [head.key]: value, ...combo });
    }
  }

  return out;
}

function defaultSummary(result: any) {
  const years = Object.keys(result?.metrics ?? {});
  const selectedByYear: Record<string, number> = {};
  let totalSelected = 0;

  for (const year of years) {
    const count = Array.isArray(result.metrics[year]) ? result.metrics[year].length : 0;
    selectedByYear[year] = count;
    totalSelected += count;
  }

  return { years, selectedByYear, totalSelected };
}

export function runSensitivityAnalysis<TSummary = any>(
  options: SensitivityAnalysisOptions<TSummary>,
): SensitivityScenario<TSummary>[] {
  const {
    parameters,
    createIntervention,
    baseState = {},
    summarise,
    includeRaw = false,
  } = options;

  const summaryFn = (summarise ?? defaultSummary) as (result: any) => TSummary;
  const combinations = buildCombinations(parameters);

  return combinations.map((combo, idx) => {
    const intervention = createIntervention();
    const originalInit = intervention.init;

    intervention.init = (context) => {
      originalInit?.(context);
      deepMerge(context.state as Record<string, any>, cloneValue(baseState));
      for (const [path, value] of Object.entries(combo)) {
        setByPath(context.state as Record<string, any>, path, value);
      }
    };

    const result = intervention.simulate();

    return {
      id: `scenario-${idx + 1}`,
      parameters: combo,
      summary: summaryFn(result),
      ...(includeRaw ? { raw: result } : {}),
    };
  });
}
