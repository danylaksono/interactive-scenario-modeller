import { Intervention } from "./intervention";

/**
 * Runs multiple interventions in sequence.
 * 
 * Useful for scenarios where multiple interventions need to be executed,
 * potentially building on each other's results.
 * 
 * @example
 * ```typescript
 * const runner = new SimulationRunner();
 * runner.add(intervention1);
 * runner.add(intervention2);
 * const results = runner.run();
 * 
 * for (const { name, result } of results) {
 *   console.log(`${name}: ${Object.keys(result.metrics).length} years`);
 * }
 * ```
 */
export class SimulationRunner {
  interventions: Intervention[] = [];
  
  /**
   * Creates a new SimulationRunner.
   * 
   * @param interventions - Optional initial array of interventions
   */
  constructor(interventions: Intervention[] = []) { this.interventions = interventions; }
  
  /**
   * Adds an intervention to the runner.
   * 
   * @param inter - Intervention to add
   */
  add(inter: Intervention) { this.interventions.push(inter); }
  
  /**
   * Runs all interventions in sequence.
   * 
   * Interventions are executed one by one, with the resulting building state
   * from each intervention passed as input to the next. This allows multiple
   * phases of a scenario to be modeled sequentially.
   * 
   * @returns Array of results, each containing the intervention name and simulation result
   */
  run() {
    const results = [];
    let buildings = null;
    for (const i of this.interventions) {
      const res = i.simulate(buildings);
      results.push({ name: i.name, result: res });
      buildings = res.buildings;
    }
    return results;
  }
}