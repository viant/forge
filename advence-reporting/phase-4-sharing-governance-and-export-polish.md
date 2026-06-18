# Phase

Sharing, Saved Views, Publishing/Governance, and Export/Presentation Polish

This document is the detailed implementation plan for turning the advanced
reporting system from an authoring tool into a real shared reporting platform.

This phase assumes the canonical compile/fill/reporting contracts from the main
proposal exist and that production-grade backend export is treated as a
dedicated follow-on phase:

- [phase-5-go-export-engine.md](/Users/awitas/go/src/github.com/viant/forge/advence-reporting/phase-5-go-export-engine.md)

## Why This Phase Matters

Even strong authored reports are still private drafts unless the platform can:

- save shared views
- publish stable versions
- express trust/certification
- enforce share/publish capabilities
- export polished deliverables

This phase is where governance and presentation quality become first-class.

## What Exists Today

Current Forge already has:

- persisted report/report-builder state
- dashboard/report block rendering
- current export/report demos and block-level export primitives
- shell/runtime hosting via Agently

It does not yet have:

- shareable reporting artifacts
- saved views
- publish lifecycle
- governance badges and policy hooks
- high-fidelity presentation/export pipeline

Important boundary:

- this phase improves sharing, publish semantics, and web-side export/polish
- the deterministic Go PDF/export backend is not hidden here; it is separated
  into Phase 5

## Detailed Implementation Plan

### Workstream A: Sharing and saved views

#### Step 1: Shareable artifact envelope

Define a generic `Shareable` envelope for persisted reporting artifacts:

- owner reference
- lifecycle state
- version
- opaque policy reference
- badge metadata

Forge should understand the shape, but not the policy semantics.

Persistence note:

- artifact bytes and rows should be stored by `agently-core`
- Steward should remain the governance/policy authority, not the artifact store

#### Step 2: Saved views

Add saved views as overlays on top of base reports:

- filters
- parameters
- local presentation/sort deltas

Saved views should not duplicate the full report artifact unless explicitly
promoted to a new report.

Required delegation detail:

- the owning persistence service for each artifact class must be explicit
- overlay merge semantics must be specified before parallel implementation

#### Step 3: Share UI and catalogs

Add generic Forge surfaces for:

- share dialog
- “shared with me”
- published catalog

All capability checks must come from provider interfaces, not from Forge policy
logic.

### Workstream B: Publishing and governance

#### Step 4: Lifecycle state machine

Implement generic reporting lifecycle states:

- draft
- published
- archived

Published versions should be rendered and handled in Forge as immutable
snapshots, but the actual immutability guarantee must be enforced by
`agently-core` persistence plus a Steward-backed lifecycle/policy decision
service.

#### Step 5: Governance badges and trust

Render generic governance badges from metadata:

- certified
- reviewed
- deprecated
- owner/steward

Forge renders them; Steward defines them.

#### Step 6: Audit and compliance hooks

Emit structured events for:

- share
- revoke
- publish
- archive
- export
- view creation

Forge emits; Steward/host stores and interprets.

Minimum audit event shape:

```json
{
  "eventType": "report.publish",
  "artifactRef": "report://doc_123",
  "version": 7,
  "actorRef": "user://awitas",
  "occurredAt": "2026-06-12T00:00:00Z",
  "metadata": {
    "workspace": "steward",
    "source": "reportComposer"
  }
}
```

### Workstream C: Export and presentation polish

#### Step 7: Export fidelity

Upgrade export to support:

- high-fidelity report snapshots
- print-safe HTML/report snapshots
- preserved chart/table styling

Pushback:

- professional paginated PDF is intentionally not treated as a small extension
  of export polish
- browser-side export and preview quality should improve here, but backend-owned
  PDF and print layout belong to Phase 5

#### Step 8: Theming and presentation templates

Introduce generic export themes and branding tokens:

- cover page slots
- header/footer template
- brand color/logo tokens

These tokens should be supplied by the host, not hardcoded into Forge.

#### Step 9: Published snapshot export

Exports should support:

- current draft
- saved view
- exact published snapshot

This matters for governance and reproducibility.

Published snapshot export should be defined so it can delegate to the Phase 5
backend when the target format requires canonical backend rendering.

#### Step 10: Headless render hooks

Expose a generic render/export operation for the host to schedule or route.

In this phase, that operation should be defined as an interface boundary. The
production implementation for deterministic PDF/export is provided by Phase 5.

#### Step 11: mcp-ui projection of published artifacts

Treat `viant/mcp-ui` as a downstream consumption surface for:

- published reports
- saved views
- export-ready report projections

This should be implemented as a projection of already-saved artifacts:

- Forge defines which document/view state is renderable
- Agently hosts and routes the projection
- `mcp-ui` carries the remote `ui://...` presentation contract

Pushback:

- do not add report authoring to `mcp-ui`
- do not let `mcp-ui` become a second persistence path
- do not block core reporting MVP on full MCP projection parity if the authoring
  and governance platform is not yet finished

Pushback:

- do not build report scheduling/distribution inside Forge MVP
- do not implement email/distribution policy inside Forge
- do not turn `viant/mcp-ui` into a second authoring surface; it should only
  project saved views or published artifacts remotely

## Forge Responsibilities

- shareable document abstractions
- saved-view overlay model
- lifecycle UI and generic state machine
- generic capability-driven sharing/publish UI
- presentation templates and export delegation hooks
- audit sink interface

## Steward Responsibilities

- sharing policy
- permissions metadata
- publish/certification rules
- badges and trust metadata
- storage and approval workflows
- audit retention

## Agently Responsibilities

- wire provider implementations
- host headless render operations
- route catalog/shared-report surfaces
- host `viant/mcp-ui` projection of saved views or published reporting artifacts
- runtime hosting only

## Likely Modules and New Abstractions

- `src/reporting/sharing/*`
- `src/reporting/views/*`
- `src/reporting/lifecycle/*`
- `src/reporting/audit/*`
- `src/reporting/export/*`
- downstream `mcp-ui` projection adapters in Agently/runtime integration

## Metadata / API / State Model

Suggested generic additions:

- `ownerRef`
- `lifecycle`
- `version`
- `policyRef`
- `badges[]`
- `savedView.overlay`

Provider/API concepts:

- capabilities
- grants
- lifecycle transitions
- badge lookup
- audit sink

Required delegation detail:

- these provider concepts need concrete payloads comparable to the semantic
  provider contract from Phase 1

Suggested capability/grant payload:

```json
{
  "artifactRef": "report://doc_123",
  "capabilities": {
    "view": true,
    "edit": true,
    "share": true,
    "publish": false,
    "export": true
  },
  "grants": [
    { "principalRef": "team://analytics", "role": "viewer" }
  ]
}
```

Suggested lifecycle transition payload:

```json
{
  "artifactRef": "report://doc_123",
  "from": "draft",
  "to": "published",
  "reason": "quarterly release"
}
```

Suggested badge lookup payload:

```json
{
  "artifactRef": "report://doc_123",
  "badges": [
    { "id": "certified", "tone": "success", "label": "Certified" },
    { "id": "owner", "tone": "info", "label": "Owned by Performance" }
  ]
}
```

### Persistence ownership matrix

The following ownership rules should be explicit:

| Artifact | Owner | Stored payload | Notes |
|---|---|---|---|
| `ReportDocument` | `agently-core` reporting persistence | authored document | source artifact for editing |
| saved view | `agently-core` reporting persistence | overlay only | must not silently fork the full document |
| published snapshot | `agently-core` storage, lifecycle gated by Steward policy | immutable `ReportSpec` ref plus persisted `ReportFill` or equivalent snapshot payload | basis for reproducible export |
| exploration session | Agently runtime or host session store | ephemeral state | TTL-bound, not a governed artifact |
| export artifact | `agently-core` export storage | produced file plus provenance | tied to audit trail |

### Saved-view overlay rules

Saved views should apply in this order:

1. base `ReportDocument`
2. published snapshot state when applicable
3. saved-view overlay

Overlay may change:

- filters
- parameters
- sort/order
- local presentation preferences

Overlay may not change:

- base block structure
- semantic model ownership
- published artifact identity

If the base document changes incompatibly:

- the saved view should surface a compatibility diagnostic
- it must not silently drop unknown fields or reinterpret them

### Snapshot policy

Published snapshot policy must define:

- whether `ReportFill` is persisted directly
- artifact retention limits
- maximum persisted fill size
- whether export of a published snapshot re-fills data or uses the stored fill

Recommended default:

- published export uses the stored `ReportFill` when reproducibility matters
- draft export may re-fill current data
- Steward decides whether a lifecycle transition is allowed
- `agently-core` stores the resulting artifact/snapshot rows

## UX Impact

Users gain:

- stable published reports
- shareable saved views
- visible trust/certification state
- polished exported deliverables

This is the phase that makes the system feel organization-ready.

## Risks and Pushback

### Risks

- policy leakage into Forge
- client-only permission checks
- export scope creep into scheduling/distribution
- lifecycle complexity if snapshot/version semantics are vague

### Pushback

- reject role and approval logic inside Forge
- reject client-only sharing enforcement
- reject scheduling/distribution MVP scope inside Forge
- reject branding logic that is hardcoded per workspace

## Verification and Acceptance Criteria

- sharing/publishing capabilities route through providers correctly
- published snapshots behave as immutable in the client, and the backing
  Steward lifecycle/persistence layer rejects mutation of published versions
- saved views round-trip cleanly
- badges update from Steward metadata without Forge logic changes
- exported output matches expected structure and branding tokens
- audit events are emitted for all major actions

## Effort Notes

- sharing / governance MVP: `6-12 weeks`
- export / presentation polish: `3-6 weeks`

`mcp-ui` projection should be treated as a bounded downstream slice of this
phase, not as a separate authoring program.

The lower end assumes:

- web-facing export fidelity only
- published snapshot/export delegation hooks only
- production PDF/export implementation deferred to Phase 5

The upper end includes:

- better lifecycle UX
- richer catalogs
- more polished theme/template support
