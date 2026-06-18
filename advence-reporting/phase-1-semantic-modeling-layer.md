# Phase

Semantic Modeling Layer for Forge Advanced Reporting

This document is a detailed phase implementation plan for introducing a
generic semantic modeling layer into Forge. It is based on a Claude phase draft
and then reconciled against the current repo boundaries.

## Why This Phase Matters

The current report builder binds directly to physical datasource outputs. That
works for report construction, but it does not create a governed vocabulary for
business metrics and dimensions.

Without a semantic layer:

- every report re-encodes business meaning locally
- consistent drill and calculation behavior are harder to guarantee
- governance and certification cannot scale cleanly
- later features like exploration and sharing rely on unstable field-level contracts

This phase is the biggest Looker-style gap and is the foundation for the rest
of advanced reporting.

## What Exists Today

Current Forge already provides the right lower-level substrate:

- report builder state and field selection in
  [ReportBuilder.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/ReportBuilder.jsx)
- chart field validation and chart-family rules in
  [reportBuilderUtils.js](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/reportBuilderUtils.js)
  and
  [reportBuilderChartRules.js](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/reportBuilderChartRules.js)
- datasource dependency and parameter propagation in
  [dataSource.js](/Users/awitas/go/src/github.com/viant/forge/src/hooks/dataSource.js)
  and
  [parameters.js](/Users/awitas/go/src/github.com/viant/forge/src/hooks/parameters.js)
- scoped contexts in
  [Context.jsx](/Users/awitas/go/src/github.com/viant/forge/src/core/context/Context.jsx)
- dashboard/report composition in
  [DashboardBlocks.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/DashboardBlocks.jsx)

What does not exist is a reusable semantic abstraction above raw datasource
fields.

## Detailed Implementation Plan

### Step 1: Semantic schema and reference model

Define a Forge-generic semantic model contract:

- `SemanticModel`
- `SemanticEntity`
- `SemanticDimension`
- `SemanticMeasure`
- `SemanticParameter`
- `SemanticRelationship`

Key property groups:

- identity: `id`, `name`, `version`
- display metadata: `label`, `description`, `format`, `category`
- typing: `dataType`, `aggregation`, `timeGrainSupport`
- governance metadata: `ownerRef`, `certification`, `deprecation`, `classification`
- opaque execution references: `definitionRef`, `sourceRef`, `relationshipRef`

Important boundary choice:

- Forge should not hold business formula bodies as the system of record.
- Forge should hold references and generic display metadata.
- Steward (or a semantic backend owned by Steward) should own the actual semantic
  definitions and execution logic.

### Step 2: Semantic model provider contract

Introduce a generic provider interface in Forge:

- `listModels`
- `getModel`
- `getEntity`
- `validateSelection`
- `listGovernanceAnnotations`

Forge should only know the provider contract, not the implementation shape.

Agently should wire the provider to a host service, but the semantic service
itself should remain a Steward/backend concern.

Pushback:

- Query planning from semantic selection to physical execution should not live
  in Agently.
- Doing so would make Agently the semantic/reporting engine, which violates the
  separation model.

Required delegation detail:

- provider method names alone are not enough
- request/response payloads, diagnostics, auth propagation, and pagination
  rules must be written explicitly before parallel implementation starts

### Step 3: Semantic binding mode in report definitions

Extend report definitions so they can bind in one of two modes:

- raw datasource mode
- semantic model mode

Suggested structure:

```json
{
  "binding": {
    "mode": "semantic",
    "modelRef": "model://steward/forecasting/line_inventory@v1",
    "entity": "line_inventory",
    "selectedDimensions": ["event_date", "channel"],
    "selectedMeasures": ["avails", "hh_uniques"]
  }
}
```

This must be backward-compatible:

- existing raw reports remain unchanged
- semantic reports use the new binding envelope

### Step 4: Builder integration

Update the current builder surface so semantic mode becomes a first-class
authoring path:

- model picker
- entity picker where required
- curated dimension/measure palette
- approved / deprecated / draft status badges
- descriptions/tooltips from model metadata

The current report-builder modules are still the right place to host this:

- `ReportBuilder.jsx`
- `reportBuilderComponents.jsx`
- `reportBuilderPersistence.js`
- `reportBuilderHooks.js`

The semantic mode should still flow through the same generic:

- filter UX
- chart editor
- result pane
- persistence
- compact/mobile behavior

### Step 5: Query execution model

Semantic execution should be split cleanly:

- Forge builds a generic semantic selection payload
- Steward/backend resolves the semantic selection to real execution
- Agently only wires the provider, auth, and request transport

That means:

- no business-expression compiler inside Forge
- no domain-specific query planner inside Agently
- no duplication of datasource dependency logic

Forge may still validate that a selection is structurally valid against the
resolved model. It should not decide what `revenue`, `net margin`, or
`household reach` means.

Required execution contract:

- Forge emits a semantic selection payload
- Steward resolves it into a concrete dataset execution plan
- the returned dataset contract must be explicit enough for:
  - current web rendering
  - future `ReportFill`
  - backend export

### Step 6: Governance surfacing

Forge should generically render governance annotations:

- certified / approved
- deprecated
- owner / steward
- description / help text

But those should remain purely presentational:

- Forge renders what it is told
- Steward decides what badges and statuses exist

### Step 7: Migration path

Add migration support for existing reports:

- suggest semantic equivalents for raw field selections
- flag unresolved fields
- preserve raw mode when mapping is incomplete

Pushback:

- do not make migration a hard prerequisite for semantic MVP
- migrate progressively, not in one bulk rewrite

## Forge Responsibilities

- semantic model types and validation
- provider interface definitions
- semantic binding state model
- semantic-aware report-builder UX
- generic rendering of governance annotations
- chart/editor integration with semantic display metadata
- backward-compatible persistence support

## Steward Responsibilities

- semantic model authoring
- semantic execution service
- governance metadata and lifecycle
- validation of semantic definitions against physical schemas
- model versioning and deprecation policy

## Agently Responsibilities

- provider wiring only
- auth, caching, and transport between Forge and the semantic service
- no semantic planning logic
- no business-definition ownership

## Likely Modules and New Abstractions

New Forge areas:

- `src/semantic/modelSchema.js`
- `src/semantic/modelRef.js`
- `src/semantic/modelProvider.js`
- `src/semantic/modelValidation.js`
- `src/components/dashboard/semanticFieldPalette.jsx`
- `src/components/dashboard/semanticBindingState.js`
- `src/components/dashboard/semanticGovernanceBadges.jsx`

Likely touched current modules:

- `src/components/dashboard/ReportBuilder.jsx`
- `src/components/dashboard/reportBuilderHooks.js`
- `src/components/dashboard/reportBuilderPersistence.js`
- `src/components/dashboard/reportBuilderResultData.js`

## Metadata / API / State Model

### Metadata

Steward-owned semantic model payloads should include:

- model identity
- entity list
- dimensions / measures
- governance annotations
- relationship metadata
- version metadata

Suggested semantic model payload:

```json
{
  "modelRef": "model://steward/performance/ad_delivery@v1",
  "version": 1,
  "label": "Ad Delivery",
  "entities": [
    {
      "id": "line_delivery",
      "label": "Line Delivery",
      "dimensions": [
        {
          "id": "event_date",
          "label": "Date",
          "dataType": "date",
          "timeGrainSupport": ["day", "week", "month"],
          "format": "date"
        }
      ],
      "measures": [
        {
          "id": "spend",
          "label": "Spend",
          "dataType": "number",
          "aggregation": "sum",
          "format": "currency",
          "governance": {
            "status": "certified",
            "ownerRef": "team://steward/performance"
          },
          "definitionRef": "semantic://steward/performance/spend"
        }
      ]
    }
  ]
}
```

### API

Generic provider shape:

- `listModels(namespace)`
- `getModel(modelRef)`
- `validateSelection(modelRef, selection)`

Required request/response contracts:

#### `listModels`

Request:

```json
{
  "namespace": "performance",
  "cursor": "",
  "limit": 50
}
```

Response:

```json
{
  "rows": [
    {
      "modelRef": "model://steward/performance/ad_delivery@v1",
      "label": "Ad Delivery",
      "version": 1,
      "status": "active"
    }
  ],
  "nextCursor": ""
}
```

#### `getModel`

Request:

```json
{
  "modelRef": "model://steward/performance/ad_delivery@v1"
}
```

Response:

- complete semantic model payload
- stable enough for offline report authoring within one session

#### `validateSelection`

Request:

```json
{
  "modelRef": "model://steward/performance/ad_delivery@v1",
  "entity": "line_delivery",
  "dimensions": ["event_date", "channel"],
  "measures": ["spend", "impressions"],
  "parameters": {
    "dateRange": {
      "start": "2026-06-01",
      "end": "2026-06-07"
    }
  }
}
```

Response:

```json
{
  "valid": true,
  "normalizedSelection": {
    "entity": "line_delivery",
    "dimensions": ["event_date", "channel"],
    "measures": ["spend", "impressions"]
  },
  "diagnostics": []
}
```

### Diagnostics

All semantic-provider responses that validate or compile user choices should
share one structured diagnostics envelope:

```json
{
  "code": "unknownMeasure",
  "severity": "error",
  "path": "selection.measures[1]",
  "message": "Measure 'gross_margin' is not available in model version 1.",
  "suggestedFix": "Choose a certified measure or migrate the report to v2."
}
```

Minimum diagnostic requirements:

- `code`
- `severity`
- `path`
- `message`
- optional `suggestedFix`

Forge should surface these diagnostics directly rather than translating them
into heuristic UI messages.

### Semantic Selection / Execution Contract

The semantic layer should separate validation from execution planning.

Suggested selection payload:

```json
{
  "modelRef": "model://steward/performance/ad_delivery@v1",
  "entity": "line_delivery",
  "selection": {
    "dimensions": ["event_date", "channel"],
    "measures": ["spend", "impressions"]
  },
  "refinements": [],
  "parameters": {
    "dateRange": {
      "start": "2026-06-01",
      "end": "2026-06-07"
    }
  }
}
```

Suggested execution-plan response:

```json
{
  "datasetRef": "dataset://steward/performance/line_delivery",
  "request": {
    "dimensions": {
      "event_date": true,
      "channel": true
    },
    "measures": {
      "spend": true,
      "impressions": true
    },
    "filters": {
      "From": "2026-06-01",
      "To": "2026-06-07"
    },
    "limit": 1000,
    "offset": 0
  },
  "resultContract": {
    "rowset": "tabular",
    "truncationMarkerField": "_truncated",
    "rowCountField": "_rowCount"
  }
}
```

This makes the handoff between semantic selection and concrete dataset
execution explicit without putting business planning into Forge or Agently.

### State

Report state should add semantic-binding metadata without breaking raw mode:

- `binding.mode`
- `binding.modelRef`
- `binding.entity`
- semantic field IDs

### Transport and Auth

Implementation decision for MVP:

- Forge calls provider interfaces through Agently-hosted REST endpoints
- Agently proxies requests to Steward-backed services
- Agently propagates delegated user/session identity
- Steward enforces capability/policy checks

Required auth context fields propagated by Agently:

- `userRef`
- `workspaceRef`
- `sessionId`
- `conversationId` when available
- `requestId` for audit tracing

Caching rules:

- `listModels` may be cached per `workspaceRef` + `userRef` for a short TTL
- `getModel` may be cached by `modelRef` + version
- `validateSelection` must not be cached

Invalidation rules:

- model-version change invalidates `getModel`
- workspace publish/deprecation events invalidate model-list caches

## UX Impact

Users get:

- curated business fields instead of raw physical columns
- less duplicated setup per report
- more stable labels and formats
- governance signals in the builder itself

This should make the system feel more like Looker’s governed field selection
while keeping the current Forge report-builder interaction model.

## Risks and Pushback

### Risks

- planner complexity if semantic execution is not kept out of Forge
- governance metadata drift if there is no clear provider contract
- migration friction for raw reports

### Pushback

- reject any design that turns Forge into a semantic query engine
- reject any design that puts business metric expressions into Agently
- reject multi-model join orchestration in the MVP unless a clean backend
  service already exists

## Verification and Acceptance Criteria

- a semantic-bound report can be authored and rendered end to end
- semantic labels/formats flow into charts and tables
- deprecated or removed semantic fields surface explicit errors
- raw-mode reports continue to work unchanged
- Forge remains free of business-specific semantic logic
- provider contract tests pass against at least one host implementation

## Effort Notes

- usable MVP: `6-10 weeks`
- stronger version: `3-6 months`

MVP assumptions:

- single semantic provider
- single model per report
- no cross-model joins in Forge
- incremental migration from raw mode
