# Intervention Engine Idea Inventory

## Core insight
- The existing Filter → Prioritise → Upgrade trilogy already captures the workflow for any entity stock that evolves under constraints, which makes the modeller immediately usable outside energy; an intervention just needs a facet, three predicates, and a short property spec.
- Facet adapters, predicate registry, and plugins keep the core lean and data-agnostic, so the only energy-specific baggage is in names and documentation.

## Minimal, additive refinements
1. Rename outward-facing terms (`building` → `entity`/`feature`, `Upgrade` → `Apply` or `Transform`) so newcomers from planning, conservation, or transport instantly grok the contract while leaving internal identifiers untouched.
2. Treat geometries as first-class inputs/outputs (GeoJSON Feature in the entity interface, carry `geometry` through `simulatedFacet`) so filters/prioritisers can rely on spatial predicates without bespoke wiring.
3. Introduce a duckdb-wasm facet adapter that lets you run declarative SQL filters/aggregations before a scenario run, keeping the predicate API while enabling joins, grouping, and heavier analytics on large tables.
4. Publish a spatial predicate bundle (`within`, `buffer`, `intersects`, `nearest`, `distanceTo`, `area`, `centroid`, etc.) so GIS users can reuse Turf-style helpers via `registerPredicate`/plugins rather than copying logic into every scenario.
5. Make the timestep configurable (year, month, or custom events) and expose a lightweight global Resource/Constraint layer that prioritise predicates can query (e.g., budgets, installer headroom, spatial quotas like “max five upgrades per km²”).
6. Standardise outputs into a delta log plus an updated FeatureCollection/row table so dashboards can animate change layers, time sliders, and choropleths without manual joins.
7. Add a Web Worker wrapper + optional spatial index (rbush/kdbush) to keep large (>50k feature) runs responsive in-browser while keeping the worker API aligned with the existing intervention lifecycle.

## GIS-friendly use cases to prove the generality
1. **Urban & regional planning** — Entities become parcels/street segments; interventions add green roofs, rezoning, or transit improvements; filters use deprivation, density, proximity; outputs feed animated land-use maps and 3D extrusions.
2. **Biodiversity/conservation** — Entities are habitat patches; interventions reforest or create corridors; prioritisation leverages connectivity + carbon return; visualization shows restoration timelines and connectivity heatmaps.
3. **Sustainable agriculture** — Entities are fields; interventions switch cropping systems or irrigation; filters overlay soil type/climate; outputs produce crop rotation layers and yield forecasts.
4. **Public health programmes** — Entities are tracts/patient clusters; interventions deploy screening, vaccines, or air-quality actions; prioritisation balances case rates, equity, and access; results surface as evolving hotspots.
5. **Disaster risk reduction** — Entities become vulnerable infrastructure; interventions flood-proof, relocate, or build buffers; filters intersect hazard zones; outcomes feed risk reduction comparisons and evacuation planning UI.
6. **Transport & active mobility** — Entities are corridors or fleets; interventions add bike lanes, electrification, or rapid chargers; prioritisation considers emissions/equity/flow; dashboards show temporally coloured networks and isochrones.
7. **Other GIS-friendly fits** — Affordable housing allocation, renewable siting rollouts, development incentives, clinic or school placement can all reuse the same pattern.

## Urban Heat Island Modelling example
- **Dataset**: ingest municipal parcel/landcover GeoJSON (facet adapter handles geometry, `surfaceTemp`, `insolation`, `imperviousPct` columns) plus weather station mesh (duckdb-wasm SQL join on nearest grid cell for recent air temperature). Use the SQL helper to precook candidate surfaces that exceed a comfort threshold or lack vegetation.
- **Filter**: `filter` predicate combines spatial constraints (within heat island hotspot polygons via registered `intersects` helper) with attribute checks (impervious percentage > 65 %, roof temperature delta > 3 °C, and available budget for greening). Referential `geometry` stays on the building entity so the predicate can also check adjacency to existing tree canopy.
- **Prioritise**: comparator sorts by cost-effectiveness (Δ °C reduction per £) blended with equity weighting (higher priority for heat-vulnerable census tracts). It queries the global resource layer for parcel-level budget envelopes and respects spatial quotas such as “max 4 interventions per km²” using the new resource/constraint accessor.
- **Upgrade (Apply/Transform)**: each selected parcel applies a transformation that adds `canopyScore`, increments `greenRoofArea`, and emits metrics (`cost`, `coolingDelta`, `year`). The upgrade writes back to the in-memory building object so subsequent years see the updated `imperviousPct` and `surfaceTemp` baseline.
- **Outputs**: `simulatedFacet` emits a delta log (year, parcel id, metric columns) plus updated GeoJSON features that track new canopy/roof installations; dashboards can overlay yearly layers via the retained geometry, animate cooling curves, and drive a leaflet time slider.
- **Worker + scaling**: temperature fields are spatially indexed (rbush) before filtering; the entire workflow runs inside the Web Worker wrapper so large city datasets (e.g., 200k parcels) keep the UI responsive. DuckDB is used to pre-aggregate monthly climate normals and to compute nearest heat-vulnerable census tracts for prioritisation.

## Strategic packaging ideas
- Publish the lean core as `@intervene/core` and a spatial extension as `@intervene/geo` (optional plugin bundle + GeoJSON facet adapter) so downstream apps can cherry-pick functionality.
- Ship a `@intervene/sql` helper that bundles a duckdb-wasm worker, registry-aware adapters, and a simple API to sync SQL-filtered rows back into the intervention loop.
- Ship a small set of scenario packs (energy, urban planning, conservation, public health) plus a Leaflet/MapLibre demo with a time slider and metrics comparison to demonstrate the cross-domain story.
- Keep the predicate/plugin registry at the heart so teams can author shareable building blocks (budget guardrails, spatial filters, multi-objective prioritisation) without touching the simulation loop.

## Why this still wins on maps
- It is pure client-side JS, so dashboards are instantly interactive and embeddable in participatory planning tools, unlike desktop-heavy GIS suites.
- Predicate-based logic is transparent and auditable, so stakeholders can trace why a parcel was chosen in year X.
- Composable interventions let you layer multiple policies/interactions, making complex multi-stage analyses easier than black-box tools.
- With light spatial polish, it becomes a general-purpose intervention engine that happens to be perfect for maps and geovisualisation.

## Next experiments
1. Sketch a GeoJSON facet adapter + spatial predicate plugin and wire it into a sample intervention so dashboards can surface geometries alongside metrics without extra joins.
2. Document/apply the toolkit to a non-energy scenario (parcel zoning, restoration sequencing, or emergency resource allocation) to prove the domain-agnostic pitch to future npm consumers.
3. If you scale to large GIS datasets, drop in a spatial index + worker hook in the predicate layer so `filter`/`prioritise` can answer `nearest`/`within` quickly without touching the core loop.
4. Prototype a duckdb-backed facet + sync strategy so you can benchmark SQL filtering/joining before passing data into predicates and keep metrics/state in sync.
