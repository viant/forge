# Phase

Calculated Fields, Table Calculations, and Ad Hoc Exploration

This document is the detailed implementation plan for adding analyst-grade
derived calculations and scratchpad-style exploration to the current Forge
reporting foundation.

## Why This Phase Matters

This phase is what makes the system feel like an analyst tool rather than a
guided reporting builder:

- users can define local derivations without waiting on engineering
- table calculations can answer common follow-up questions quickly
- exploration lets users fork from an existing chart/report and iterate

This is also the phase most at risk of overreach. If not constrained, it
becomes a greenfield BI engine effort.

## What Exists Today

Forge already has:

- report builder state and chart editor
- explicit field selection
- persisted report definitions
- datasource dependency plumbing
- current result-set handling and chart/table rendering
- limited computed-measure support in the current report builder
  (`computedMeasures`, currently simple ratio-style derivations)

It does **not** yet have:

- an expression grammar
- a calculated field runtime
- table calculations
- an exploration session model

## Detailed Implementation Plan

### Workstream A: Calculated fields and table calculations

#### Step 1: Closed expression grammar

Add a tightly scoped expression language for **local/ad hoc** calculations:

- arithmetic
- comparison
- boolean logic
- `case` / `if`
- null handling
- a curated function library

Pushback:

- no user-defined functions in MVP
- no cross-datasource expressions in MVP
- no open-ended SQL snippets in report definitions

Required delegation detail:

- the grammar must be specified, not described loosely
- JS and Go implementations must share a conformance corpus

Suggested MVP operator set:

- arithmetic:
  `+`, `-`, `*`, `/`, `%`
- comparison:
  `=`, `!=`, `>`, `>=`, `<`, `<=`
- boolean:
  `and`, `or`, `not`
- branching:
  `if(condition, a, b)`, `case(...)`
- null helpers:
  `coalesce`, `isNull`, `nullIf`

Suggested MVP function set:

- `abs`
- `round`
- `floor`
- `ceil`
- `min`
- `max`
- `least`
- `greatest`
- `concat`
- `lower`
- `upper`

Important exclusions:

- no arbitrary string regex library in MVP
- no user-defined lambdas/functions
- no SQL fragments
- no backend pushdown syntax in the local grammar

Suggested expression contract shape:

```json
{
  "id": "ctr",
  "kind": "rowCalc",
  "dataType": "number",
  "label": "CTR",
  "format": "percent",
  "expr": "if(impressions = 0, null, round((clicks / impressions) * 100, 2))"
}
```

Evaluation semantics that must be pinned in the doc and test corpus:

- `null` in arithmetic yields `null` unless handled explicitly
- divide-by-zero yields `null`, not exception and not `Infinity`
- boolean comparisons against `null` yield `false` unless using `isNull`
- string comparisons are case-sensitive by default
- numeric formatting happens after evaluation, never inside the evaluator

#### Step 2: Two evaluation tiers

Support two generic calculation classes:

1. row-level calculated fields
2. post-aggregation table calculations

Row-level calculated fields may be evaluated by Forge only for the
client-visible rowset that Forge already has in hand.

Important constraint:

- if a calculation needs pre-aggregation datasource semantics or pushdown into
  physical query execution, that belongs to the semantic/backend layer from
  Phase 1, not to a new Forge-side execution path

Table calculations should remain pure functions over the result grid:

- running total
- percent of total
- rank
- period delta
- moving average

Table calculations need explicit partition/order contracts.

Suggested table-calc shape:

```json
{
  "id": "runningSpend",
  "kind": "tableCalc",
  "label": "Running Spend",
  "sourceField": "spend",
  "function": "runningTotal",
  "partitionBy": ["channel"],
  "orderBy": [
    { "field": "eventDate", "direction": "asc" }
  ]
}
```

Minimum MVP table-calc catalog:

- `runningTotal`
- `percentOfTotal`
- `rank`
- `deltaFromPrevious`
- `movingAverage`

Pinned semantics that must not be left to implementation guesswork:

- rank tie behavior
- null handling in windows
- ordering requirement when the source rowset has no explicit order
- whether percent-of-total uses filtered total or original fetched total

#### Step 3: Builder/editor integration

Add:

- “Add calculated field”
- local calculated field grouping in the field palette
- quick table-calculation menu for suitable measures

The chart editor should treat local calculated fields as ordinary output fields.

Current-state nuance:

- we already support simple computed measures today
- this phase formalizes that into a closed grammar and a broader but still
  constrained runtime
- do not regress current computed-measure support while introducing the new spec

#### Step 4: Governed formula promotion path

Steward-governed formulas should **not** be authored as business logic inside
Forge.

Recommended separation:

- local/ad hoc formulas can exist inside Forge report definitions
- governed formulas in Steward are referenced by ID/name and resolved as part
  of the semantic layer from Phase 1

Pushback:

- do not let Forge become the source of truth for approved business formulas
- do not let governed formulas and local formulas share the same storage model
  without provenance

### Workstream B: Ad hoc exploration

#### Step 1: Exploration session model

Define an ephemeral exploration session:

- source report/chart reference
- forked report definition
- local history / undo
- session TTL

This should reuse the current report-builder state model as much as possible.

#### Step 2: Explore-from-here entry points

Add entry points from:

- dashboard blocks
- report views
- chart/table interactions

These should fork current state into an exploration session without mutating
the source artifact.

#### Step 3: Exploration workspace

Build a more fluid workspace around existing report-builder mechanics:

- faster field pivots
- lightweight chart switching
- undo/redo
- clear unsaved state indicator

Pushback:

- no greenfield freeform analysis canvas in the MVP
- no collaborative exploration in the MVP

#### Step 4: Save-as-report and discard

Allow users to:

- discard an exploration
- save it as a new report
- optionally submit local formulas for Steward review/promotion

## Forge Responsibilities

- local expression grammar and evaluator
- table-calc runtime
- calculated field authoring UX
- exploration session model and workspace
- local formula dependency tracking

## Steward Responsibilities

- governed formula registry
- review/approval workflow for promoted formulas
- business metadata for approved formulas

## Agently Responsibilities

- host/workspace wiring only
- runtime hosting and transport for saved report execution
- no governance or formula authoring ownership

## Likely Modules and New Abstractions

- `src/expr/*`
- `src/reporting/calcFieldSpec.js`
- `src/reporting/tableCalcSpec.js`
- `src/reporting/explorationSession.js`
- `src/components/dashboard/CalculatedFieldEditor.jsx`
- `src/components/dashboard/ExplorationWorkspace.jsx`
- `src/reporting/calcConformanceFixtures/*`

## Metadata / API / State Model

Suggested additions:

- `calculatedFields[]`
- `tableCalcs[]`
- `explorationSession { sourceRef, reportDef, history, ttl }`

Suggested table-calc examples:

```json
[
  {
    "id": "pctTotalSpend",
    "kind": "tableCalc",
    "sourceField": "spend",
    "function": "percentOfTotal",
    "format": "percent"
  },
  {
    "id": "rankBySpend",
    "kind": "tableCalc",
    "sourceField": "spend",
    "function": "rank",
    "orderBy": [
      { "field": "spend", "direction": "desc" }
    ]
  }
]
```

Important separation:

- local formulas store formula bodies
- governed formulas store references into the Steward semantic/governance layer

## Conformance Requirement

Because local calculations are expected to appear in both interactive/web and
backend/export flows, this phase must define a shared conformance corpus:

- expression string
- input rows
- expected output rows
- error/null cases

Both JS and Go runtimes must pass the same fixtures. Without this, exports and
interactive views will drift.

## UX Impact

Users gain:

- local derived metrics
- quick calculations in tables
- “explore” from existing views
- saveable scratchpad analysis

## Risks and Pushback

### Risks

- expression-language scope creep
- divergence between local and governed formula semantics
- performance costs on large result sets
- accidental creation of a second hidden query engine through row-level
  pre-aggregation calculation support

### Pushback

- reject proposals that turn this into a new BI engine
- reject governed business formula storage inside Forge
- reject collaborative exploration until the single-user path is solid

## Verification and Acceptance Criteria

- local calculated fields work in chart/table/report contexts
- supported table calculations produce correct results and survive persistence
- exploration preserves context and can be saved as a new report
- governed formulas can enter the builder through Steward references
- existing report-builder flows do not regress

## Effort Notes

- calculated fields and table calculations MVP: `8-14 weeks`
- ad hoc exploration workflow: `2-4 months` for a good-enough first version

The lower end requires tight scope control:

- local formulas only for MVP
- limited function set
- no collaboration
- no cross-source formulas
