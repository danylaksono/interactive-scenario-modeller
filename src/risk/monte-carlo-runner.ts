import type { Intervention } from "../intervention";

export type MonteCarloRun<TSummary = any> = {
  id: string;
  seed: number;
  summary: TSummary;
  raw?: any;
};

export type MonteCarloAggregate = {
  runs: number;
  totalSelected: {
    min: number;
    max: number;
    mean: number;
  };
};

export type MonteCarloAnalysisResult<TSummary = any> = {
  runs: MonteCarloRun<TSummary>[];
  aggregate: MonteCarloAggregate;
};

export type MonteCarloAnalysisOptions<TSummary = any> = {
  runs: number;
  createIntervention: () => Intervention;
  baseState?: Record<string, any>;
  sampleState?: (ctx: { runIndex: number; seed: number }) => Record<string, any>;
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

function defaultSummary(result: any) {
  let totalSelected = 0;
  for (const year of Object.keys(result?.metrics ?? {})) {
    totalSelected += Array.isArray(result.metrics[year]) ? result.metrics[year].length : 0;
  }
  return { totalSelected };
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

export function runMonteCarloAnalysis<TSummary extends { totalSelected?: number } = any>(
  options: MonteCarloAnalysisOptions<TSummary>,
): MonteCarloAnalysisResult<TSummary> {
  const {
    runs,
    createIntervention,
    baseState = {},
    sampleState,
    summarise,
    includeRaw = false,
  } = options;

  const summaryFn = (summarise ?? defaultSummary) as (result: any) => TSummary;

  const runResults: MonteCarloRun<TSummary>[] = [];

  for (let i = 0; i < runs; i++) {
    const seed = i + 1;
    const sampled = sampleState?.({ runIndex: i, seed }) ?? {};

    const intervention = createIntervention();
    const originalInit = intervention.init;

    intervention.init = (context) => {
      originalInit?.(context);
      deepMerge(context.state as Record<string, any>, cloneValue(baseState));
      deepMerge(context.state as Record<string, any>, cloneValue(sampled));
      (context.state as Record<string, any>).__mcSeed = seed;
    };

    const result = intervention.simulate();
    const summary = summaryFn(result);

    runResults.push({
      id: `run-${i + 1}`,
      seed,
      summary,
      ...(includeRaw ? { raw: result } : {}),
    });
  }

  const totals = runResults.map((run) => toNumber((run.summary as any)?.totalSelected, 0));
  const min = totals.length ? Math.min(...totals) : 0;
  const max = totals.length ? Math.max(...totals) : 0;
  const mean = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;

  return {
    runs: runResults,
    aggregate: {
      runs,
      totalSelected: { min, max, mean },
    },
  };
}
