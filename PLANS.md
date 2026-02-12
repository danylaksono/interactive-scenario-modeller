# PLANS for interactive-scenario-modeller

High priority
- Finish TypeScript typing for PropertySpec and Metrics. ✅
- Implement adapter for DecarbV2 Facet/DataTable shape and add example using live data from DecarbV2 (read-only). ✅
- Replace any remaining eval usage with opt-in sandboxed evaluation.
- Add serialization helpers and migration tool to convert existing DecarbV2 intervention sources into registry references.

Medium priority
- Add rich examples showing common decarbonisation predicates (budget-limited rollout, cost-optimal selection, grid-limited adoption etc.)
- Add a small UI consumer example (React + Vite) showing visuals built from simulatedFacet

Low priority
- Publish to npm; add changelog and release process
- Add optional plugin manager with versioning

## Plugin Development Roadmap (Next)

### Phase 1: Solidify first-party scenario pack (in progress)
- Keep built-ins production-ready and stable:
  - budget constraint
  - planning constraint
  - phased rollout
  - multi-objective prioritization
  - policy evolution
- Ensure each has:
  - deterministic behavior
  - minimal required state shape
  - dedicated tests for registry + plugin-export resolution

### Phase 2: Financial plugins
1. **Budget Spend Tracker Plugin**
	- Purpose: centralize yearly spend updates in one reusable upgrade function
	- Inputs: `estimatedPVCost`, `context.state.budgetSpent`
	- Outputs: `{ cost, cumulativeCost, year }`
2. **Financing Model Plugin (cash/lease/PPA)**
	- Purpose: normalize financing assumptions into annualized economics
	- Inputs: capex, term, discount/interest
	- Outputs: annual payment + NPV-ready metrics

### Phase 3: Policy and social-targeting plugins
1. **Fuel Poverty Priority Plugin**
	- Blend fuel-poverty score with carbon potential in a tunable threshold predicate
2. **Policy Timeline Validator Plugin**
	- Validate that yearly policy states are complete before simulation

### Phase 4: Grid/system plugins
1. **Substation Capacity Gate Plugin**
	- Block upgrades when projected feeder/substation constraints are exceeded
2. **Sequential Enablement Plugin**
	- Allow intervention B only where intervention A completed (cross-scenario dependency)

### Delivery standards for every new plugin
- Define manifest + compatibility range
- Add README cookbook example
- Add unit tests + one end-to-end intervention simulation test
- Keep plugin pure where possible (state writes only in explicit upgrade plugins)
- Avoid external runtime dependencies unless strictly required

## Missing Plugins Implementation Plan

### Wave A (start now): Target and prioritisation foundations
1. **Cost-Benefit Prioritiser Plugin**
	- Purpose: rank upgrades by benefit-per-cost ratio
	- Default fields: `carbonSavingPotential` / `estimatedPVCost`
	- Kind: `prioritiser`
2. **Carbon Target Constraint Plugin**
	- Purpose: stop/limit selection when annual or cumulative carbon target is reached
	- Default state keys: `carbonTarget`, `currentCarbonReduced`
	- Kind: `constraint`
3. **Top-Percent Potential Constraint Plugin**
	- Purpose: select top percentile candidates by precomputed rank
	- Default fields: `potentialRank`, `potentialRankCount`
	- Kind: `constraint`

### Wave B: Geographic and deployment strategy plugins
1. **Spatial Cluster Priority Plugin**
	- Prioritize dense clusters for infrastructure efficiency
2. **Urban/Rural Strategy Plugin**
	- Apply location-dependent weighting and constraints
3. **Region Budget Split Plugin**
	- Enforce region-specific budget envelopes

### Wave C: Time-series and demand profile plugins
1. **Seasonal Demand Gate Plugin**
	- Gate upgrades against season-specific demand/capacity windows
2. **Load Profile Scoring Plugin**
	- Rank candidates by peak-reduction contribution
3. **Technology Coupling Plugin**
	- Adjust effective demand/benefit with battery or heat-pump uptake assumptions

### Wave D: Risk and uncertainty plugins
1. **Sensitivity Runner Helper** ✅
	- Run parameter sweeps over named scenario variables
2. **Monte Carlo Runner Helper** ✅
	- Repeat scenarios across random draws with summary statistics
3. **Volatility Scenario Plugin** ✅
	- Inject price volatility multipliers by year/season

### Wave E: Transport and integrated system plugins
1. **EV Load Interaction Plugin** ✅
	- Add EV charging demand projections to capacity checks
2. **Transport Corridor Constraint Plugin** ✅
	- Prioritize/limit by corridor charging requirements

### Delivery sequence and checkpoints
1. Implement Wave A + tests + docs + bundle installer entries
2. Release minor version and validate with scenario-template example
3. Implement Wave B/C incrementally with one plugin per PR-sized change
4. Add risk helpers (Wave D) only after deterministic baseline plugin set is stable

Notes
- Keep library small and dependency-free where possible
- Tests should validate parity with original DecarbV2 outputs for a few representative seeds
- Additional grid modelling plugins implemented:
	- generation headroom allocation (utility-scale renewables export gating)
	- grid energy balance reporting (total demand/generation requirement and remaining headroom)
