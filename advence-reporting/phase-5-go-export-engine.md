# Phase

Go Export Engine and Deterministic Production PDF

This document is the detailed implementation plan for a Go-backed export phase
that turns the advanced reporting system into a production-grade artifact
generator rather than only an interactive reporting surface.

## Why This Phase Matters

Presentation polish alone is not enough for professional reporting delivery.

High-quality multi-page PDF output requires:

- deterministic backend rendering
- async export jobs
- paginated table layout
- repeated headers/footers
- embedded charts/fonts
- immutable snapshot export
- artifact persistence and auditability

Those requirements are a distinct engineering phase, not a small extension of
web-side export polish.

## Why This Is Separate From Phase 4

Phase 4 improves shareability, governance, and web-facing export fidelity.

This phase is different because it introduces:

- a backend-owned render pipeline
- a paginated print model
- a deterministic PDF engine
- export job orchestration and artifact storage

If this work is hidden inside generic export polish, the path of least
resistance is browser-driven PDF capture. That would violate the current
architecture direction:

- one reporting brain
- no browser-only canonical export path
- no hidden layout/data logic coupling

## Current Foundation

Forge already has useful authoring/runtime surfaces:

- dashboard grammar and block taxonomy in
  [dashboardCapabilities.js](/Users/awitas/go/src/github.com/viant/forge/src/core/ui/dashboardCapabilities.js)
- interactive report builder in
  [report-builder.md](/Users/awitas/go/src/github.com/viant/forge/docs/report-builder.md)
- dashboard/report rendering in
  [DashboardBlocks.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/DashboardBlocks.jsx)
- current HTML/export primitives in
  [dashboard.md](/Users/awitas/go/src/github.com/viant/forge/docs/dashboard.md)

JasperReports is a useful architectural reference because it separates:

1. compile
2. fill
3. export

but we are explicitly not adopting:

- JRXML/XML complexity
- expression compilation to host language code
- Java/AWT/OpenPDF coupling

## Canonical Model

This phase depends on one canonical reporting pipeline:

1. `ReportSpec`
2. `ReportFill`
3. `ReportPrint`

### ReportSpec

`ReportSpec` is the strict compiled AST.

It contains:

- spec version
- identity and provenance
- closed block tree
- resolved labels/formats
- typed parameters
- dataset declarations
- layout intent
- refinement semantics

It does not contain:

- Steward-only metadata indirection
- browser state
- exporter-specific branches
- business heuristics

### ReportFill

`ReportFill` is the layout-free filled result.

It contains:

- `ReportSpec` identity/hash
- exact parameter values used
- executed dataset requests
- row/aggregate payloads
- provenance/truncation metadata
- resolved block content
- resolved chart/table/geo payloads
- resolved table-cell visual payloads such as:
  - data-bar values/ranges
  - matched tone/color rules
  - badge/tone labels

It is the correct basis for:

- published snapshot reproducibility
- backend export
- cross-engine conformance testing

### ReportPrint

`ReportPrint` is the paginated print model.

It is the export-oriented analogue of Jasper’s page-level print object.

It contains:

- page list
- page geometry
- absolutely-positioned primitive elements
- text blocks
- lines/rectangles
- images/SVG payloads
- header/footer placements
- page-number/bookmark structures
- table-cell visual primitives such as:
  - horizontal bar fills
  - conditional tone backgrounds
  - inline badge/tone markers

It contains no datasource logic and no semantic logic.

## One Brain, Two Engines

We may have two render engines:

- web engine for interactive rendering/preview
- Go engine for backend PDF/export

But we must not have two reporting brains.

That means:

- compile is canonical
- fill is canonical
- web renders canonical models
- Go exports canonical models

The Go engine must not:

- interpret dashboard YAML directly
- read `windowForm` directly
- re-resolve business semantics
- invent its own report grammar

The web engine must not become the production export truth.

### Interactive preview vs canonical execution

There are two acceptable rendering modes:

1. lightweight interactive preview during editing
2. canonical compile/fill-backed preview and export

The boundary must be explicit:

- Forge may keep lightweight local preview behavior for editing responsiveness
- canonical save/publish/export must use backend-owned compile/fill
- any preview state that cannot lower into canonical artifacts is invalid

This prevents the backend phase from becoming a second reporting engine while
still allowing responsive authoring UX.

## Responsibilities

### Forge responsibilities

Forge owns:

- `ReportSpec` schema
- `ReportFill` schema
- `ReportPrint` schema
- conformance fixtures
- authoring-side compile expectations
- web render contracts

Forge does not own:

- export job orchestration
- artifact storage
- PDF writer internals

### Steward responsibilities

Steward owns:

- business templates
- semantic bindings and labels
- governance state
- export branding tokens
- publish/snapshot policy

Steward does not own:

- pagination logic
- generic print layout semantics

### Agently responsibilities

Agently responsibilities are split between:

- `agently-core`:
  compile/fill/export service hosting, async jobs, auth propagation,
  principal-scoped persistence, download routing, MCP server hosting, and audit
  event wiring
- `agently` app:
  deployment/runtime integration and UI-facing route wiring

Agently does not own:

- semantic/business logic
- exporter-specific report grammar

## Detailed Implementation Plan

### Workstream A: Canonical schemas and fixture corpus

Define and version:

- `ReportSpec`
- `ReportFill`
- `ReportPrint`

Add:

- closed enums
- explicit block payload shapes
- conformance fixtures
- migration/version policy

Likely locations:

- `src/reporting/schema/*`
- `src/reporting/fixtures/*`

Acceptance criteria:

- schemas are closed and versioned
- unknown fields fail validation
- existing authoring surfaces can lower into the new schema set
- first-draft schemas and seed fixtures land before JS and Go teams implement
  against them independently

### Workstream B: Go report runtime module

Introduce a standalone Go reporting runtime module/service with packages such
as:

- `spec/*`
- `compile/*`
- `fill/*`
- `layout/*`
- `print/*`
- `export/pdf/*`
- `export/csv/*`
- `export/xlsx/*`

Compile should:

- validate authoring input
- lower authoring artifacts to `ReportSpec`
- resolve semantic references via provider interfaces

Fill should:

- execute declared dataset requests
- apply closed calculation grammar
- produce `ReportFill`

Required dataset execution contract:

- `ReportSpec` dataset declarations must resolve to explicit request payloads
- Go fill must call existing datasource/services through Agently-hosted runtime
  transport
- returned dataset payloads must include:
  - rows or aggregate payload
  - row count metadata
  - truncation metadata
  - provenance

Layout should:

- paginate blocks and tables
- repeat headers/footers
- apply deterministic font/layout metrics
- preserve inline table visuals such as horizontal bars and conditional tones
- produce `ReportPrint`

Acceptance criteria:

- one `ReportSpec` can produce both web and backend output
- fill output is deterministic for identical inputs
- layout never performs semantic or query logic
- canonical compile/fill service is used by save/publish/export flows

### Workstream C: PDF and tabular exporters

Implement exporters that consume canonical models only.

PDF exporter:

- consumes `ReportPrint`
- embeds fonts/charts
- renders table data bars and conditional cell coloring deterministically
- produces deterministic PDF bytes

Tabular exporters:

- consume `ReportFill`
- bypass pagination
- preserve resolved values and formatting intent where appropriate

Acceptance criteria:

- PDF output is reproducible
- large tables paginate cleanly
- table data bars and rule-based coloring remain visible and stable across page
  breaks
- tabular export does not depend on browser rendering

### Workstream D: agently-core reporting service and jobs

Expose backend operations for:

- compile
- export request submission
- export status polling
- artifact retrieval

Recommended implementation home:

- `agently-core/service/reporting/*`
- Datly-backed persistence under `agently-core/pkg/agently/report*`
- MCP exposure through existing `agently-core` MCP service/exposure seams

Support:

- async jobs
- auth-scoped execution
- artifact retention
- audit hooks

Acceptance criteria:

- export can run without an active browser session
- artifacts are persisted and downloadable
- failed exports produce structured diagnostics
- artifact visibility is scoped by authorized principal

### Workstream E: Forge integration

Forge should delegate production export to the backend service while keeping
interactive preview local.

Add:

- export UI for draft/view/published snapshot
- compile diagnostics surfaced in authoring flows
- clear unsupported/export-unavailable signaling

Acceptance criteria:

- users can export authored reports from current surfaces
- backend export does not require a separate authoring flow

## Strict Invariants

The following are hard constraints:

- the Go phase must not define a second report grammar
- the Go phase must not read raw authoring metadata directly
- all business meaning must be resolved before layout/export
- `ReportSpec` and `ReportFill` must be exporter-agnostic
- layout must not change data meaning
- exporters must not perform query or semantic work
- unsupported constructs must fail visibly
- production PDF must not rely on headless browser capture as the canonical path

## Risks and Pushback

### Major risks

- professional multi-page table pagination complexity
- preserving horizontal data bars and conditional coloring consistently across
  pages and themes
- font metrics and deterministic text layout
- chart parity expectations between web and print
- auth/credential lifetime for long-running jobs
- large dataset export performance

### Pushback

- do not promise Jasper-level PDF fidelity immediately
- do not hide layout-engine work under “export polish”
- do not let temporary browser-PDF fallback become permanent architecture
- do not allow export-only report constructs

## Dependencies and Order

This phase depends on:

- Phase 2 authored report documents
- Phase 3 calculation semantics where exported calculations must match runtime behavior

It should be sequenced:

- after the canonical AST direction is established
- before production-grade PDF is treated as complete in governance/publish flows

This phase should feed back into Phase 4, especially for:

- published snapshot export
- reproducibility
- auditability

## Verification Plan

Required verification should include:

- schema fixture validation
- compile/fill determinism tests
- pagination golden tests
- PDF byte-stability or rasterized-page regression tests
- table-cell visual regression tests for:
  - horizontal data bars
  - threshold/enum-driven tones
- large-table export performance tests
- end-to-end Agently export job tests

## Effort Notes

Expected effort:

- `8-14 weeks` for a useful first deterministic backend export phase

That assumes:

- constrained initial print semantics
- one canonical AST/fill pipeline
- PDF first, with tabular exports as simpler siblings
