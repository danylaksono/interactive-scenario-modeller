import { registerPredicate } from './registry';
import { safeEval } from './utils';

export type MigrationOptions = {
  register?: boolean;        // whether to register compiled predicates in the registry
  prefix?: string;           // prefix for generated predicate names
  compile?: boolean;         // whether to attempt compiling sources
  safeEvalFn?: (code: string) => any; // optional evaluator (for tests or alternate sandbox)
};

function sanitizeName(s: string) {
  return String(s).replace(/[^a-zA-Z0-9_.:\-]/g, '_');
}

/**
 * Migrate an array of saved interventions that may contain `predicateSources` (e.g. `filterSource`).
 *
 * Returns an array of migration reports with mapping information for each predicate found.
 */
export function migrateSavedInterventions(savedInterventions: any[], opts: MigrationOptions = {}) {
  const { register = true, prefix = 'migrated', compile = true, safeEvalFn } = opts;
  const report: any[] = [];

  for (const it of savedInterventions || []) {
    const name = it?.name ?? 'unnamed';
    const entry: any = { name, predicates: {} };
    const ps = it?.predicateSources ?? {};

    if (!ps || typeof ps !== 'object') {
      report.push(entry);
      continue;
    }

    for (const [k, v] of Object.entries(ps)) {
      if (typeof k !== 'string') continue;
      if (!k.endsWith('Source')) continue;
      const predName = k.slice(0, -6);
      const source = typeof v === 'string' ? v : '';
      const predicateEntry: any = { source: source, registered: false, predicateName: null, error: null };

      if (!source.trim()) {
        predicateEntry.error = 'empty_source';
        entry.predicates[predName] = predicateEntry;
        continue;
      }

      const generated = sanitizeName(`${prefix}:${name}:${predName}`);

      if (register && compile) {
        try {
          const evaluator = safeEvalFn ?? safeEval;
          // wrap in parentheses is handled by safeEval which already does it; but protect double-wrap
          const compiled = evaluator(source);
          if (typeof compiled !== 'function') {
            predicateEntry.error = 'compiled_not_function';
          } else {
            // Wrap the compiled function to match the new (building, context) signature
            // while passing context.state as the second argument for backward compatibility.
            const wrapped = (arg1: any, arg2: any, arg3: any) => {
              // arg1 is building, arg2 is context
              // old prioritise: (b1, b2, state)
              // new prioritise: (b1, b2, context)
              // old filter/upgrade: (b, state)
              // new filter/upgrade: (b, context)
              
              if (arg3 !== undefined) {
                // likely prioritise(b1, b2, context)
                return compiled(arg1, arg2, arg3.state);
              } else {
                // likely filter(b, context) or upgrade(b, context)
                return compiled(arg1, arg2.state);
              }
            };
            registerPredicate(generated, wrapped);
            predicateEntry.registered = true;
            predicateEntry.predicateName = generated;
          }
        } catch (e: any) {
          predicateEntry.error = String(e?.message ?? e);
        }
      } else {
        predicateEntry.error = 'not_compiled';
      }

      entry.predicates[predName] = predicateEntry;
    }

    report.push(entry);
  }

  return report;
}
