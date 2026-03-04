type PredicateFn = (...args: any[]) => any;
const predicateRegistry = new Map<string, PredicateFn>();

/**
 * Registers a reusable predicate function in the global registry.
 * 
 * Registered predicates can be referenced by name in interventions,
 * making it easier to share common logic across multiple interventions.
 * 
 * @param name - Unique name for the predicate
 * @param fn - The predicate function to register
 * @throws Error if name is not a string or fn is not a function
 * 
 * @example
 * ```typescript
 * // Register a cost-effectiveness prioritizer
 * registerPredicate('costEffectiveness', (b1, b2) => {
 *   const ratio1 = b1.emissionsReduction / b1.cost;
 *   const ratio2 = b2.emissionsReduction / b2.cost;
 *   return ratio2 - ratio1;
 * });
 * 
 * // Use in intervention
 * const intervention = new Intervention('Test', {
 *   prioritise: getPredicate('costEffectiveness')
 * });
 * ```
 */
export function registerPredicate(name: string, fn: PredicateFn) {
  if (typeof name !== 'string' || typeof fn !== 'function') throw new Error('Invalid predicate registration');
  predicateRegistry.set(name, fn);
}

/**
 * Retrieves a registered predicate function by name.
 * 
 * @param name - Name of the registered predicate
 * @returns The predicate function, or `null` if not found
 * 
 * @example
 * ```typescript
 * const fn = getPredicate('costEffectiveness');
 * if (fn) {
 *   const result = fn(entity1, entity2, state);
 * }
 * ```
 */
export function getPredicate(name: string) {
  return predicateRegistry.get(name) ?? null;
}

/**
 * Lists all registered predicate names.
 * 
 * @returns Array of registered predicate names
 * 
 * @example
 * ```typescript
 * const names = listPredicates();
 * console.log('Available predicates:', names);
 * ```
 */
export function listPredicates() { return Array.from(predicateRegistry.keys()); }

// Exported for tests or migration helpers
export const _registry = predicateRegistry;