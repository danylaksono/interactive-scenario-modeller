# LAEP seven-stage process and Interactive Scenario Modeller

This document maps a typical UK Local Area Energy Plan (LAEP) workflow to library primitives. It is descriptive guidance, not a regulatory claim.

## Stage overview

| Stage | LAEP intent | ISM mapping |
|-------|-------------|-------------|
| 1. Evidence / baseline | Assemble stock, demand, emissions, socio-economic context | **Facet adapters** ([`arrayAdapter`](../src/facet-adapter.ts)), optional UK normalisers (`interactive-scenario-modeller/adapters/uk`), `setupEntity` to normalise fields |
| 2. Ambition / targets | Carbon, equity, grid, cost envelopes | `context.state` keys consumed by **constraints** (e.g. carbon target, policy timeline), `resources` for budgets |
| 3. Focus zones / targeting | Spatial prioritisation, “who first” | **Prioritisers** (MCDA, cost–benefit, fuel poverty, spatial cluster), **filters** (top % potential, archetype rules) |
| 4. Interventions / pathways | Technology choices and phasing | **`Intervention`**: Filter → Prioritise → Transform per timestep; multiple interventions for parallel tracks |
| 5. Infrastructure / vectors | Grid, heat networks, transport | **Grid plugins** (substation gate, headroom), **transport** plugins, **heat-network economics** plugin for notional DHN costs |
| 6. Flexibility / operation | Peak reduction, DSR, coupling | **Flexibility demand adjustment** (prepare effective demand before grid gate), **technology coupling** |
| 7. Appraisal / reporting | Costs, carbon, co-benefits, GIS outputs | **Upgrade metrics** (co-benefits tracker), `metrics` aggregation, **`outputBuilder`** on simulated facet ([`SimulatedFacetOptions`](../src/types.ts)), `toGeoJSON` |

## Runner-based multi-vector workflows

For “whole system” style sequencing (e.g. air-source heat pumps first, then district heat for remaining eligible stock), use **`SimulationRunner`** ([`src/runner.ts`](../src/runner.ts)):

1. Run intervention A with shared `resources` / initial `entities`.
2. Pass returned `entities` into intervention B (`runner.run()` does this automatically).
3. Optionally use **`upgradeChain`** on a single intervention to try transforms in order until one produces a non-empty delta (see [`examples/laep-fallback-runner.ts`](../examples/laep-fallback-runner.ts)).

## Substation capacity and DFES-style scenarios

Configure **`createSubstationCapacityGatePlugin`** with `activeScenarioKey` and `capacityByScenarioKey` so `context.state` can switch capacity tables by named scenario (e.g. Distribution Future Energy Scenarios). See [`docs/substation-capacity-modeling.md`](substation-capacity-modeling.md).

## Client-side limits

Large stocks with **8760 hourly** profiles should be **pre-aggregated** (e.g. peak kW, seasonal factors) before loading into the browser. The engine is designed for annual or coarse timesteps plus vectorised entity loops.
