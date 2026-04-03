# LLM Tool Calling Contract

This document defines a stable, JSON-safe tool-calling contract for using `interactive-scenario-modeller` with LLMs (for example via OpenRouter function tools).

## Current Alignment Assessment

### What already aligns well

- The library already has modular, composable primitives suitable for tool workflows:
  - `Intervention`
  - plugin registry (`registerPlugin`, `listPlugins`)
  - predicate registry (`registerPredicate`, `listPredicates`)
  - install helpers (`installAllPlugins`, `installScenarioModellerPresets`)
- Plugin/predicate references are string-addressable (`pluginName:exportName`), which is ideal for LLM-generated arguments.
- Output can be converted to GeoJSON (`toGeoJSON`) for downstream map/render tools.

### Gaps for direct LLM function calling

- The core APIs are object/function-oriented, while LLM tool calls are JSON-only.
- There was no first-class runtime that:
  - stores intermediate state by IDs,
  - accepts validated JSON args,
  - returns JSON-serializable responses.
- There was no single source of truth for OpenRouter-compatible tool schemas.

### What is now added

- `src/llm-tools.ts` introduces:
  - `getLlmToolDefinitions()` for function tool schema definitions,
  - `createLlmToolRuntime()` / `LlmToolRuntime` for stateful execution,
  - `executeToolCall({ name, args })` switch-based dispatcher.

## Canonical Tool Set

These tools are now the recommended LLM-facing interface for this library.

1. `createFacetFromRows`
2. `installAllPlugins`
3. `installScenarioModellerPresets`
4. `createInterventionFromRefs`
5. `simulateIntervention`
6. `getSimulationResult`
7. `toGeoJSON`
8. `listPredicates`
9. `listPlugins`

## OpenRouter Integration Pattern

```ts
import {
  createLlmToolRuntime,
  getLlmToolDefinitions,
} from "interactive-scenario-modeller";

const runtime = createLlmToolRuntime();
const tools = getLlmToolDefinitions();

// pass `tools` to OpenRouter request
// when the model returns tool call JSON:
const result = runtime.executeToolCall({
  name: toolName,
  args: parsedArgs,
});
```

## Example Schema (same shape as OpenRouter function tools)

```ts
{
  type: "function",
  function: {
    name: "toGeoJSON",
    description: "Convert the simulated facet of an intervention to GeoJSON FeatureCollection.",
    parameters: {
      type: "object",
      properties: {
        interventionId: { type: "string" },
        stringify: { type: "boolean", default: false }
      },
      required: ["interventionId"],
      additionalProperties: false
    }
  }
}
```

## Design Rules For New Tools

To keep this contract stable, all future LLM-facing tools should follow these rules:

1. JSON-only args and responses
- No executable code in args.
- No class instances/functions in return payloads.

2. Explicit IDs for state
- Use `facetId`, `interventionId`, etc.
- Avoid hidden implicit state transitions.

3. Strict schema boundaries
- Include `required` fields.
- Set `additionalProperties: false` unless intentionally extensible.

4. Deterministic behavior
- Same args should produce same behavior unless explicitly stochastic.
- If stochastic, expose seed/strategy explicitly.

5. Structured errors
- Return `{ success: false, error }` instead of throwing unhandled exceptions.

6. Keep map rendering separate
- Mapbox/Deck/WebGL actions (like `addH3Layer`) should remain host-app tools.
- This library should provide simulation + GeoJSON outputs consumed by those UI tools.

## Notes About `addH3Layer`

`addH3Layer` is an application/UI tool, not a core simulation-library tool. The expected flow is:

1. call modelling tools in this library (`simulateIntervention`, `toGeoJSON`)
2. pass returned GeoJSON to host map tools (`addH3Layer`)

This separation keeps `interactive-scenario-modeller` platform-neutral and easier to test.
