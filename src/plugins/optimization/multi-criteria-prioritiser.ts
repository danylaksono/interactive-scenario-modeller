import type { PluginRegistration } from "../../plugin";
import type { Entity, SimulationContext } from "../../types";

export type Criterion = {
    /** Name of the criterion for logging/config */
    name: string;
    /** Relative weight (usually derived from AHP pairwise comparison) */
    weight: number;
    /** Function to extract the numeric value from the entity */
    getValue: (entity: Entity) => number;
    /** 1 for "higher is better" (benefit), -1 for "lower is better" (cost/risk) */
    direction?: 1 | -1;
};

export type MultiCriteriaOptions = {
    name?: string;
    version?: string;
    criteria?: Criterion[];
    /** Key in context.state where weights might be overridden dynamically */
    stateWeightsKey?: string;
};

/**
 * A general-purpose Multi-Criteria Prioritiser.
 * Works with any entity type (Entitys, H3, Parcels) by using getValue getters.
 */
export function createMultiCriteriaPrioritiserPlugin(
    options: MultiCriteriaOptions = {},
): PluginRegistration {
    const name = options.name ?? "optimization-multi-criteria";
    const version = options.version ?? "1.0.0";
    const defaultCriteria = options.criteria ?? [];
    const stateWeightsKey = options.stateWeightsKey ?? "mcdaWeights";

    const prioritise = (a: Entity, b: Entity, context: SimulationContext) => {
        // Merge default weights with any dynamic weights in state
        const dynamicWeights = (context.state?.[stateWeightsKey] || {}) as Record<string, number>;

        const getScore = (e: Entity) => {
            let total = 0;
            for (const criterion of defaultCriteria) {
                const weight = dynamicWeights[criterion.name] ?? criterion.weight;
                const val = criterion.getValue(e);
                const direction = criterion.direction ?? 1;

                // Simple Weighted Sum. 
                // Note: For advanced AHP, values should ideally be normalized first.
                total += val * weight * direction;
            }
            return total;
        };

        const scoreA = getScore(a);
        const scoreB = getScore(b);

        // Optional: Store the score in context logic if needed elsewhere
        // (Pairwise sort makes global normalization hard, but simple weighting is fine)

        return scoreB - scoreA;
    };

    return {
        manifest: {
            name,
            version,
            kind: ["prioritiser"],
            description: "Ranks entities using weighted multi-criteria logic",
            entry: "internal:plugin",
            compat: {
                package: "interactive-scenario-modeller",
                minVersion: "0.1.0",
            },
            trusted: true,
            exports: {
                prioritise: "prioritise",
            },
        },
        prioritise,
    };
}
