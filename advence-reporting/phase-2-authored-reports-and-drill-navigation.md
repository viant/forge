# Phase

Authored Multi-Block Reports/Dashboards and Drill Navigation

This document is the detailed implementation plan for turning the current
single-report builder plus dashboard blocks into an authored, saveable report
document model with generic drill/refinement mechanics.

## Why This Phase Matters

The current Forge surface is strong for building one report at a time and for
rendering dashboards, but it is still short of a mature BI/reporting authoring
experience:

- dashboards are not yet a first-class report authoring product
- multi-block report composition is not yet a saved document workflow
- chart/table interactions do not yet become a visible refinement trail

This phase closes the “author -> refine -> save -> revisit” loop.

## What Exists Today

Current Forge already has reusable building blocks:

- dashboard blocks and report blocks in
  [DashboardBlocks.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/DashboardBlocks.jsx)
- report builder as a generic block editor in
  [ReportBuilder.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/ReportBuilder.jsx)
- dashboard/report rendering patterns already present in `dashboard.report`
- chart/table selection and filter plumbing
- export/report scaffolding in the dashboard/report block system

What is missing is a persisted document model and a generic refinement system.

## Detailed Implementation Plan

### Workstream A: Authored multi-block reports

#### Step 1: Report document model

Define `ReportDocument` as a persisted authored artifact:

- identity
- title / subtitle / description
- layout model
- shared scope / parameters
- block list
- view metadata

`ReportDocument` is an authoring-layer artifact, not the final internal
advanced-reporting AST.

It must lower losslessly into the canonical compiled report model introduced in
the main proposal:

- `ReportSpec`
- `ReportFill`
- engine-specific render/export plans

Each block should remain generic:

- chart block
- table block
- KPI block
- markdown/narrative block
- filter bar block
- report-builder block

Table blocks should support richer analytical cell presentation without
becoming business-specific widgets. At minimum the generic table block model
should support:

- horizontal data bars inside numeric cells
- rule-based coloring/tone based on explicit criteria
- badge/tone rendering for level/status-like fields

Important pushback:

- do not invent Forecasting-specific report block types in Forge
- block behavior must remain capability-driven and metadata-driven
- `ReportDocument` persistence must wrap and extend the current
  report-builder/report persistence patterns rather than creating a second
  parallel reporting persistence system
- saving a `ReportDocument` should be gated on compile-cleanliness once the
  canonical compiler service exists; invalid authored documents should produce
  structured diagnostics rather than silently persisting an invalid shape

#### Step 2: Composer surface

Build `ReportComposer` on top of the existing dashboard/report rendering stack:

- add block
- remove block
- duplicate block
- resize/reorder block
- edit block configuration using existing surfaces where possible

The composer should not create a second rendering system. It should orchestrate
existing block rendering and block editing.

#### Step 3: Shared scope and bindings

Promote shared report scope into a first-class model:

- document-level filters/parameters
- block-level bindings into those filters
- shared updates across blocks

This is the foundation for drill/refinement behavior too.

#### Step 4: Template instantiation

Allow Steward-provided templates to hydrate a `ReportDocument`:

- initial layout
- initial blocks
- initial parameter bindings
- initial titles/copy

Forge should validate document shape, but Steward should own template content.

#### Step 5: Inline table visuals

Add generic table-cell visualization support so authored reports can express:

- `dataBar` visuals for numeric comparisons
- conditional tone/color rules for thresholds or enum values
- shared rule references reused across related report tables

These visuals must remain metadata-driven:

- Forge owns rendering semantics
- Steward may supply the thresholds, value buckets, or enum labels
- the table block must not hardcode workspace-specific business meaning

Recommended generic shape:

- per-column `cellVisual`
- supported visual kinds:
  - `dataBar`
  - `tone`
  - `badge`
- optional `rules[]`
- explicit `valueField`, `range`, `palette`, and `nullBehavior`

Pushback:

- do not hide criteria evaluation inside ad hoc formatter callbacks
- do not make this browser-only; authored semantics must be exportable
- do not infer “level” logic from labels; require explicit rule definitions

### Workstream B: Drill / keep-only / exclude / detail navigation

#### Step 1: Refinement model

Define a generic refinement object:

- `keep`
- `exclude`
- `drill`
- `detail`

Refinements should be independent from business meaning:

- field
- value(s)
- source block
- display label

#### Step 2: Action surfaces

Add generic interaction menus from:

- chart selections
- table row/cell selections
- legend interactions where appropriate

Core actions:

- keep only
- exclude
- drill into
- show details

#### Step 3: Visible refinement trail

Add a refinement chip/breadcrumb bar:

- shows active refinements
- remove individual refinement
- clear all
- optionally undo/redo

This is important for trust and discoverability.

#### Step 4: Detail navigation

Treat detail targets as opaque host-resolved references:

- Forge emits generic navigation intents
- Steward decides target semantics
- Agently routes target opening

Pushback:

- do not define business drill hierarchies in Forge
- do not hardcode detail destinations in Forge

#### Step 5: Drill metadata provider

Add an explicit generic drill metadata provider contract instead of assuming
drill metadata arrives informally:

- `getDrillHierarchy(fieldRef)`
- `getDetailTarget(targetRef)`
- `listAvailableRefinements(blockKind, fieldRef)`

This provider may be backed by:

- the semantic model provider from Phase 1 when a report is in semantic mode
- a Steward drill metadata service for raw-mode reports

Forge should consume the provider contract the same way in both cases.

## Forge Responsibilities

- report document schema
- composer UI
- shared scope/filter binding mechanics
- refinement model and predicate composition
- generic chart/table action surfaces
- generic table-cell visual semantics
- document persistence interface

## Steward Responsibilities

- authored report templates
- drill hierarchy metadata
- detail target metadata
- business labels and copy
- policy around which drill actions are valid

## Agently Responsibilities

- host composer windows
- route detail targets
- wire persistence and template providers
- wire drill metadata providers
- no business drill logic

## Likely Modules and New Abstractions

- `src/reporting/reportDocumentModel.js`
- `src/reporting/reportDocumentStore.js`
- `src/components/dashboard/ReportComposer.jsx`
- `src/components/dashboard/BlockPalette.jsx`
- `src/components/dashboard/refinementModel.js`
- `src/components/dashboard/RefinementBar.jsx`
- `src/components/dashboard/detailNavigation.js`
- `src/reporting/drillMetadataProvider.js`
- `src/reporting/tableVisualSpec.js`

Likely existing surfaces to extend:

- `DashboardBlocks.jsx`
- `DashboardSurface.jsx`
- `ReportBuilder.jsx`

## Metadata / API / State Model

Suggested document shape:

```json
{
  "id": "doc_123",
  "title": "Quarterly Performance",
  "scope": {
    "params": []
  },
  "layout": {
    "type": "grid",
    "items": []
  },
  "blocks": []
}
```

Suggested table visual shape:

```json
{
  "kind": "tableBlock",
  "columns": [
    {
      "key": "spend",
      "label": "Spend",
      "cellVisual": {
        "kind": "dataBar",
        "valueField": "spend",
        "range": { "mode": "columnMax" },
        "palette": ["#dbeafe", "#2563eb"]
      }
    },
    {
      "key": "status",
      "label": "Status",
      "cellVisual": {
        "kind": "tone",
        "rules": [
          { "value": "healthy", "tone": "success" },
          { "value": "watch", "tone": "warning" },
          { "value": "critical", "tone": "danger" }
        ]
      }
    }
  ]
}
```

Suggested refinement shape:

```json
{
  "id": "ref_1",
  "op": "keep",
  "field": "region",
  "values": ["EMEA"],
  "sourceBlockId": "b_7"
}
```

Suggested drill metadata provider shape:

```ts
interface DrillMetadataProvider {
  getDrillHierarchy(fieldRef: string): Promise<DrillHierarchy | null>;
  getDetailTarget(targetRef: string): Promise<DetailTarget | null>;
  listAvailableRefinements(blockKind: string, fieldRef: string): Promise<RefinementAction[]>;
}
```

Required delegation detail:

- these provider types must be concretely specified before parallel
  implementation

Suggested payloads:

```json
{
  "drillHierarchy": {
    "fieldRef": "stateCode",
    "levels": [
      { "id": "state", "field": "stateCode", "label": "State" },
      { "id": "dma", "field": "dma", "label": "DMA" },
      { "id": "city", "field": "city", "label": "City" }
    ]
  }
}
```

```json
{
  "detailTarget": {
    "targetRef": "target://steward/performance/order-detail",
    "navigationMode": "hostRoute",
    "parameters": {
      "orderId": "$row.adOrderId"
    }
  }
}
```

```json
{
  "actions": [
    { "id": "keep", "label": "Keep only", "kind": "keep" },
    { "id": "exclude", "label": "Exclude", "kind": "exclude" },
    { "id": "drill", "label": "Drill into", "kind": "drill" }
  ]
}
```

### Persistence interface

`ReportDocument` persistence needs explicit CRUD contracts, not only a model
name.

Recommended implementation home:

- interface/types in Forge
- principal-scoped persistence implementation in `agently-core`
- Steward remains the source of templates, drill metadata, and governance policy

Suggested interface:

- `createReportDocument(payload)`
- `getReportDocument(reportRef)`
- `updateReportDocument(reportRef, payload, version)`
- `listReportDocuments(scope, cursor, limit)`
- `deleteReportDocument(reportRef)`

Suggested optimistic-concurrency rule:

- every saved document carries a monotonic `version`
- updates must include the expected `version`
- conflicting updates return a structured conflict diagnostic

## UX Impact

Users gain:

- true authored report pages
- saveable, revisitable report documents
- visible refinement history
- more natural analytical navigation

This is the shift from “report builder widget” to “report authoring surface.”

## Risks and Pushback

### Risks

- report document model complexity
- collisions between shared scope and local block state
- confusing drill/refinement layering if not made visible

### Pushback

- do not create a second parallel reporting runtime
- do not let report templates become executable business logic in Forge
- do not ship implicit drill rules without explicit Steward metadata

## Verification and Acceptance Criteria

- users can create, save, and reload a multi-block report
- blocks respond correctly to shared scope changes
- drill/keep/exclude actions create visible refinements
- refinements can be removed and cleared
- detail navigation routes through host-provided targets
- no existing dashboard/report blocks regress

## Effort Notes

- authored reports/dashboards: `4-8 weeks`
- drill-down / keep-only / exclude / detail navigation: `3-6 weeks`

The lower end assumes strong reuse of current dashboard/report surfaces. The
upper end assumes more document editing polish and better refinement history UX.
