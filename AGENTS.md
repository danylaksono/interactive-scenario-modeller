# Agent Development Instructions

These instructions apply to AI-agent and LLM tool-calling contributions in this repository.

## Primary Objective

Maintain a stable JSON Schema contract for tool-calling workflows (OpenRouter-compatible), while preserving the core modelling API.

## Source Of Truth

- Runtime and tool schemas: `src/llm-tools.ts`
- Contract documentation: `docs/llm-tool-calling-contract.md`

## Required Rules

1. Add all new LLM-facing tools in `src/llm-tools.ts`.
2. Every LLM-facing tool must have:
- an OpenRouter function definition in `getLlmToolDefinitions()`
- a runtime handler in `LlmToolRuntime`
- JSON-serializable inputs and outputs
3. Tool args must be explicitly schema-bound (`required`, `additionalProperties` policy).
4. Runtime handlers must return structured success/error payloads and not rely on uncaught throws.
5. Do not require executable JS snippets in tool args.
6. Keep UI/render tools (e.g. map styling/layer creation) outside this package. Only expose simulation and data-output tools here.

## Backward Compatibility

- Avoid renaming existing LLM tool names once published.
- If behavior changes, add new tool names and deprecate old ones with clear docs.
- Keep responses additive where possible.

## Validation Checklist For PRs

- Build passes: `npm run build`
- Tool schemas are valid JSON Schema object shapes
- New tool has docs update in `docs/llm-tool-calling-contract.md`
- No non-JSON-safe values in tool results
