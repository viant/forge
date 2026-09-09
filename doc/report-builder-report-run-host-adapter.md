# Report Builder durable run host adapter

Forge synthesizes `builderContext.handlers.reportRuns` only when a reporting endpoint is configured and the host has not supplied every method. Existing host methods always win over synthesized methods.

The adapter targets Agently Core's authenticated, host-only HTTP boundary at `/v1/api/report-runs`. It does not use model-visible reporting tools. In particular, `reporting:record_report_run` only updates a saved report's most-recent successful execution time, while `reporting:get_active_report_run` is a read-only, conversation-scoped model tool.

| Forge method | Core request | Exact successful response |
| --- | --- | --- |
| `begin` | `POST /begin` with `conversationId`, `origin`, `builderRef`, `presetId`, `sourceKind`, `sourceId`, `requestedParams`, `effectiveParams`, and required `uiRunRequestId` | `{run, context?}`; `run` must contain a non-empty server `reportRunId`, status `running`, and a positive integer `revision` |
| `complete` | `POST /{reportRunId}/complete` with `conversationId`, `expectedRevision`, `reportSpec`, `reportFill`, and `reportPrint` | The same `reportRunId`, status `completed`, and a positive integer `revision` |
| `fail` | `POST /{reportRunId}/fail` with `conversationId`, `expectedRevision`, `failureCode`, and `failureText` | The same `reportRunId`, status `failed`, and a positive integer `revision` |
| `activate` | `POST /{reportRunId}/activate` with required `conversationId`, `expectedRunRevision`, `expectedContextRevision`, and `source` | Context with the requested `conversationId`, the same `activeReportRunId`, and a positive integer `revision` |
| `getContext` | `GET /context/{conversationId}` | `{enabled: true, context}` after validating the exact conversation and positive context revision |
| `adopt` | `POST /{reportRunId}/adopt` with the activation fields | Completed manual run and context carrying the exact requested run and conversation identities |

Core owns run IDs, revisions, owner scope, trusted-conversation authorization, idempotency by `uiRunRequestId`, immutable terminal snapshots, and compare-and-swap transition semantics. Forge never creates or repairs an ID or revision. It drops Forge-only correlation fields (`turnId` and `windowId`) because Core rejects unknown JSON fields.

A plain-text 404 from `begin`, `getContext`, or `adopt` means the default-closed route is not mounted. Structured JSON errors from a mounted route, including scoped 404 and stale-revision 409 responses, are preserved. A structured context 404 maps to an enabled service with no current context so an authorized adoption attempt can perform Core's authoritative owner/conversation check.

Backend enablement remains explicit: Core mounts the route only when reporting is enabled, `transitionalWithUI.admission` is `open`, and `transitionalWithUI.persistence` is `enabled`. Manual-run adoption additionally requires `transitionalWithUI.conversationAdoption: enabled`; the read-only active-run tool additionally depends on orchestration wiring. Forge does not open any of these backend gates.
