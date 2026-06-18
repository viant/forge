# Forecasting Report Builder Implementation Plan

## Purpose

This document is the final reconciled implementation plan for improving the
Forecasting report builder across:

- desktop web / embedded browser use
- mobile / compact-touch use
- generic framework behavior in Forge
- domain-specific metadata and preset ownership in Steward

This plan is implementation-oriented. It is not a design brainstorm.

## Inputs

Primary evidence and prior reviews:

- Current QA matrix:
  [RESULTS.md](/Users/awitas/go/src/github.com/viant/agently/ui/test-results/forecasting-chart-matrix/RESULTS.md)
- Current UI screenshot:
  [forecasting-report-builder-current.png](/Users/awitas/go/src/github.com/viant/agently/ui/test-results/claude-review/forecasting-report-builder-current.png)
- Claude implementation review:
  [CLAUDE_IMPLEMENTATION_PLAN_fable_5_1m.md](/Users/awitas/go/src/github.com/viant/agently/ui/test-results/claude-review/CLAUDE_IMPLEMENTATION_PLAN_fable_5_1m.md)
- Claude functionality + visual review:
  [CLAUDE_FUNCTIONAL_AND_VISUAL_PLAN_fable_5_1m.md](/Users/awitas/go/src/github.com/viant/agently/ui/test-results/claude-review/CLAUDE_FUNCTIONAL_AND_VISUAL_PLAN_fable_5_1m.md)
- Claude reconciled mobile + architecture review:
  [CLAUDE_RECONCILED_MOBILE_ARCH_PLAN_fable_5_1m.md](/Users/awitas/go/src/github.com/viant/agently/ui/test-results/claude-review/CLAUDE_RECONCILED_MOBILE_ARCH_PLAN_fable_5_1m.md)

Primary implementation surfaces:

- Forge report builder UI:
  [ReportBuilder.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/ReportBuilder.jsx)
- Forge chart renderer:
  [Chart.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/Chart.jsx)
- Forge report builder utilities:
  [reportBuilderUtils.js](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/reportBuilderUtils.js)
- Forge dashboard blocks and error boundary:
  [DashboardBlocks.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/DashboardBlocks.jsx)
- Forge dashboard styles:
  [Dashboard.css](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/Dashboard.css)
- Steward forecasting metadata:
  [forecasting_report_builder.yaml](/Users/awitas/go/src/github.vianttech.com/viant/steward_ai/deployment/steward/shared/forecasting_report_builder.yaml)

## Scope

In scope:

- generic chart correctness inside Forge
- generic report-builder preset behavior inside Forge
- desktop information architecture and visual hierarchy
- mobile-specific interaction model for compact/touch screens
- explicit ownership boundaries between Steward, Forge, and Agently
- test and verification coverage for current known failures

Out of scope:

- Forecasting-specific workarounds in Forge
- Agently shell hacks to mask Forge defects
- silent fallbacks or heuristics that make incorrect charts appear to work
- committing domain semantics into Agently

## Architecture Boundaries

### Steward responsibilities

Steward owns domain-specific concerns:

- chart preset catalog
- preset grouping / labels / descriptions / icons
- domain-specific copy and notices
- workflow semantics
- hook behavior
- policy flags for preset behavior where domain cost/meaning matters

Steward should express intent through metadata, not implementation logic.

### Forge responsibilities

Forge owns all generic UI and state behavior:

- chart data shaping and rendering
- preset dependency resolution
- chart spec validation and sanitization
- report-builder layout and styling
- error and empty states
- responsive/mobile behavior
- generic crash recovery
- generic state synchronization and persistence

Forge must remain data-driven and domain-agnostic.

### Agently responsibilities

Agently owns shell/runtime concerns only:

- embedded browser host
- generic app shell
- asset serving
- parity verification between dev UI and embedded UI

Agently should not contain Forecasting report-builder logic.

## Red Lines

The following are explicitly not allowed:

- Forecasting-specific field names or behavior branches in Forge
- Steward hook logic copied into Forge or Agently
- Agently-side band-aids for Forge render or state bugs
- silent fallback from invalid chart state to a different chart state
- silent no-op quick presets
- heuristics that guess business meaning from field names
- mobile implemented as a scaled-down desktop clone
- disabling or debouncing errors instead of removing the underlying loop

## Current Problems

### Functional problems

1. Dotted display keys are not handled consistently between table and chart
   paths.
2. Some quick presets silently no-op when their required dimensions are not
   selected.
3. Forge mutates some single-measure presets by implicitly injecting a
   `seriesField`.
4. Rapid quick-chart switching can trigger a render loop and crash the whole
   Forecasting block.
5. Pie/donut currently does not reliably aggregate by category.
6. Charts are currently built from the same paginated collection slice as the
   table, which is a correctness risk even when rendering works.

### Desktop visual problems

1. The top toolbar mixes too many concerns with equal visual weight.
2. Chart presets are presented as a flat select control rather than a curated
   analytical action surface.
3. The required Date Range control sits below the chart instead of next to the
   Run action it scopes.
4. The chart is not visually dominant enough for a BI/reporting surface.
5. Empty and error states are too weak and sometimes misleading.
6. Too many nested cards/borders/shadows create unnecessary visual noise.

### Mobile problems

1. The current two-column report-builder layout is not viable on phone-sized
   screens.
2. Too much chrome would be shown simultaneously on mobile.
3. Current control density and target sizing are too desktop-oriented.
4. Mobile currently lacks a dedicated setup/run/chart interaction model.

## Design Target

The target feel should be closer to mature BI/reporting tools such as Tableau,
Looker, Jasper, or Excel in these ways:

- clear action hierarchy
- chart-first result presentation
- disciplined control density
- stronger analytical affordances
- grouped preset workflows
- explicit scope summary
- high trust in rendered outputs

This does not mean copying those tools literally.

## Desired Product Behavior

### Desktop / embedded browser behavior

Desktop should use a zoned layout:

- top run bar for required scope and execution actions
- left rail for measures, breakdowns, and optional filters
- result card for chart/table display
- chart actions in the result card header, not mixed with Run

Quick presets should be:

- grouped
- explicit about applicability
- one-click to apply
- never silent on failure

### Mobile / compact behavior

Mobile should not show the full desktop surface all at once.

Mobile should use:

- compact sticky summary header
- full-height setup sheet for scope/data/filter editing
- bottom-sheet chart preset gallery
- sticky bottom action bar with the minimum primary actions
- one chrome layer at a time

Required scope and run actions must stay close together on mobile.

## Implementation Plan

### Phase 1: Chart Render Correctness

Goal:

- make the current data render correctly in generic Forge chart paths
- stop mutating metadata-declared specs

#### Changes

1. Add a generic chart row projection step in Forge.
   - Project nested/display-path values into flat, alias-safe row keys before
     they reach the chart renderer.
   - This should be reusable for any report builder using display-key-style
     dimensions.

2. Update chart container builders to reference projected chart keys.
   - Prefer explicit alias-safe chart keys over raw dotted paths.

3. Aggregate pie/donut rows by category before rendering.

4. Split chart-spec handling into:
   - materialize stored/default specs without invention
   - suggest draft defaults only for interactive chart creation

#### Likely files

- [reportBuilderUtils.js](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/reportBuilderUtils.js)
- [Chart.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/Chart.jsx)
- [ReportBuilder.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/ReportBuilder.jsx)

#### Acceptance criteria

- `Overview · Avails by Date (line)` renders a real line chart
- `Overview · Avails by Date and Channel (area)` renders a real grouped chart
- manual line chart with `Date + Channel + Avails` renders correctly
- manual `horizontal_bar` with `Channel + Avails` renders correctly
- manual and preset pie/donut produce one slice per category, not one per raw row
- no current passing cases regress

### Phase 2: Quick Preset Application Semantics

Goal:

- make preset application explicit, deterministic, and metadata-driven

#### Changes

1. Introduce a generic chart-spec dependency resolver in Forge.
   - Determine required dimensions from `xField` and `seriesField`.

2. Apply quick presets in one atomic state write.
   - Do not let dimensions and chart spec update in separate transient states.

3. Add visible failure surfacing for preset apply.
   - If a preset cannot apply, explain why.

4. Allow Steward to control whether presets may auto-provision missing
   dimensions.
   - Example metadata flag under result/preset configuration.

5. Ensure default specs round-trip unchanged from metadata.

#### Likely files

- [ReportBuilder.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/ReportBuilder.jsx)
- [reportBuilderUtils.js](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/reportBuilderUtils.js)
- [forecasting_report_builder.yaml](/Users/awitas/go/src/github.vianttech.com/viant/steward_ai/deployment/steward/shared/forecasting_report_builder.yaml)

#### Acceptance criteria

- shipped Forecasting presets either render or visibly explain why they cannot
  apply
- no quick preset silently no-ops
- preferably, all Forecasting-shipped presets render from default state
- applying a preset that needs a missing dimension performs at most one state
  write and one logical request transition

### Phase 3: Stability and Crash Hardening

Goal:

- remove the render/update loop and make chart failures recoverable

#### Changes

1. Remove effect-driven `chartReady` state in Forge chart rendering.
2. Make embedded/compact chart height stable and not dependent on
   render-selection state.
3. Remount chart instances on chart-spec identity changes.
4. Add a retry/reset path to the generic dashboard error boundary.
5. Audit report-builder state normalization/persist loops for idempotency.

#### Likely files

- [Chart.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/Chart.jsx)
- [ReportBuilder.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/ReportBuilder.jsx)
- [DashboardBlocks.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/DashboardBlocks.jsx)
- [reportBuilderUtils.js](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/reportBuilderUtils.js)

#### Acceptance criteria

- the known stress sequence no longer crashes
- no `Maximum update depth exceeded` console error during preset switching
- an induced block render failure is recoverable from the UI

### Phase 4: Desktop UX Redesign

Goal:

- make the desktop/embedded experience feel chart-first and BI-grade

#### Changes

1. Split the top area into a run bar and a result action bar.
2. Move required Date Range and required scope controls near Run.
3. Move chart-specific actions into the result card header.
4. Replace flat quick-chart select with a grouped preset gallery/menu.
5. Demote destructive actions like Remove Chart into overflow.
6. Hide pagination in chart mode.
7. Flatten nested chrome and raise typography/control quality.
8. Give the chart a larger visual share of the result frame.

#### Likely files

- [ReportBuilder.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/ReportBuilder.jsx)
- [Dashboard.css](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/Dashboard.css)
- [forecasting_report_builder.yaml](/Users/awitas/go/src/github.vianttech.com/viant/steward_ai/deployment/steward/shared/forecasting_report_builder.yaml) for preset grouping metadata

#### Acceptance criteria

- one clear primary action
- no required filter placed below the chart
- grouped preset UX
- chart visually dominates the result area
- clearer result-frame empty/error states

### Phase 5: Mobile / Compact Interaction Model

Goal:

- create a real touch-first Forge report-builder mode

#### Changes

1. Add a compact responsive mode in Forge based on container width.
2. Introduce a sticky compact summary header.
3. Move setup into a full-height sheet with tabs such as:
   - Scope
   - Data
   - Filters
4. Use a bottom-sheet chart preset gallery.
5. Add a sticky bottom action bar with:
   - Filters
   - Chart
   - Run
6. Prevent simultaneous display of desktop chrome regions on phone screens.
7. Ensure touch target sizes and spacing follow touch-first guidelines.

#### Likely files

- [ReportBuilder.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/ReportBuilder.jsx)
- [Dashboard.css](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/Dashboard.css)
- optional Steward metadata preferences if needed for mobile defaults

#### Acceptance criteria

- full report-builder flow is usable at phone width
- no horizontal layout overflow
- setup and charting are achievable without juggling multiple simultaneous
  panels
- compact mode is generic and not Forecasting-specific

### Phase 6: Structural Refactor

Goal:

- reduce fragility and improve long-term maintainability

#### Changes

1. Split oversized Forge report-builder component responsibilities.
2. Extract chart-spec rule logic into one shared module.
3. Extract chart data prep/projection into pure helper modules.
4. Reduce duplicated rule logic between builder, utils, and chart renderer.

#### Likely files

- [ReportBuilder.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/ReportBuilder.jsx)
- [reportBuilderUtils.js](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/reportBuilderUtils.js)
- [Chart.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/Chart.jsx)
- new extracted modules

#### Acceptance criteria

- component responsibilities are clear
- a single source of truth exists for chart-family rules
- no regressions versus prior matrix and visual baselines

## Desktop Design Detail

### Top-level structure

Desktop should be reorganized into:

1. Run bar
   - required filters
   - Run
   - CSV

2. Left data/filter rail
   - measures
   - breakdowns
   - optional filters

3. Result card
   - chart/table title
   - grouped chart actions
   - chart canvas or table body

### Preset UX

The quick preset control should become:

- grouped by metadata-defined category
- visually richer than a flat select
- explicit about chart type and applicability
- one click to apply

### Empty and error states

Every result state should use a strong, reusable pattern:

- icon or visual cue
- headline
- short explanatory copy
- corrective action when appropriate

### Visual simplification

Forge should reduce:

- repeated rounded containers
- stacked shadows
- tiny type
- excessive toolbar density

Forge should increase:

- chart prominence
- control readability
- rail width where needed
- analytical clarity

## Mobile Design Detail

### Mobile principles

- one layer of chrome at a time
- progressive disclosure
- chart-first
- thumb-friendly actions
- explicit scope summary

### Mobile structure

1. Sticky compact summary header
2. Main chart/result surface
3. Sticky bottom action bar
4. Setup sheets/drawers for:
   - Scope
   - Data
   - Filters
5. Chart preset bottom sheet

### What should not remain from desktop

Do not show these simultaneously on phone:

- left rail
- full toolbar
- inline filter body
- chart controls row
- desktop pagination behavior for charts

### Generic vs configurable

Forge should own:

- compact breakpoint behavior
- mobile sheet/drawer patterns
- sticky action bars
- chart-first layout logic

Steward may own:

- preset grouping labels
- copy
- default starting tab or preferences if truly needed

## Verification Plan

### Unit coverage

- dotted path chart field projection
- chart row projection alias behavior
- pie aggregation by category
- non-mutating default spec materialization
- preset dependency resolution
- report-builder state normalizer idempotency

### Integration coverage

- iterate Steward default chart specs against representative nested rows
- verify one-write preset application
- verify no silent quick-preset failures

### Browser coverage

- codify all current failures from [RESULTS.md](/Users/awitas/go/src/github.com/viant/agently/ui/test-results/forecasting-chart-matrix/RESULTS.md)
- codify all current critical passing paths
- stress-switch scenario
- reload persistence
- rerun persistence

### Dev vs embedded parity

For each critical scenario:

- run on dev UI (`:5175`)
- run on embedded UI (`:9191`)

No release should ship on dev-only confidence.

### Desktop vs mobile parity

At minimum verify:

- large desktop viewport
- embedded narrow desktop shell
- phone-sized viewport
- rotation / resize behavior

## Suggested PR Sequence

1. Forge render correctness
2. Forge preset semantics + minimal Steward metadata additions
3. Forge crash hardening
4. Forge desktop redesign + Steward preset grouping metadata
5. Forge mobile compact mode
6. Forge structural refactor

## Final Recommendation

Implement this plan with the following priority order:

1. correctness
2. preset semantics
3. stability
4. desktop BI-grade redesign
5. mobile compact mode
6. structural cleanup

Do not start with cosmetic work before the chart contract and crash behavior are fixed.
