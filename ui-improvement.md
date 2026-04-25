# Chat UI Active-Turn Rendering — Implementation Plan

Status: implementation-ready
Scope: `viant/agently/ui/src` · `viant/agently-core/sdk` · `viant/agently-core/sdk/ts` · `viant/forge/src/components/chat`

## Core principle (non-negotiable)

The client reuses the backend's two existing contracts directly. No third semantic model is introduced between them.

- **Live deltas.** `applyEvent(event: streaming.Event)` consumes the backend SSE shape as defined in `agently-core/runtime/streaming/event.go`. No repackaging, no client-side normalisation layer, no "stream events" intermediate type.
- **Persisted snapshots.** `applyTranscript(state: api.ConversationState)` consumes the backend canonical transcript shape as defined in `agently-core/sdk/api/canonical.go`. No `TurnState[]` slice, no row-shaped payload, no diff, no reshape.
- **No transcript-to-synthetic-events conversion.** Transcript is merged structurally into canonical client state. It is never re-expressed as synthetic SSE events.
- **No new "segment protocol" or alternate client wire model.** The client state mirrors the backend canonical shape — same names, same nesting, same field semantics — adding only a local `renderKey` for stable React identity and local provenance metadata for the merge rule. Nothing else.
- **Projection reads merged canonical state only.** The renderer-facing projector is a pure read over the one canonical client state. No second pipeline, no post-hoc normalisation step.

These five clauses are the architectural floor. Anything elsewhere in this plan that appears to contradict them is a wording bug in that section, not a design alternative.

---

## 1. Problem

For the latest turn, the UI must be deterministic:

- one user task row
- one execution-details card
- in-place live updates
- lifecycle-driven card status
- no transcript interference while the turn is live

Observed bugs:

1. Duplicate user prompt row on submit
2. Empty `Execution details (0)` shell
3. Missing intake despite `v1` config enabling it
4. Header flips blue/running to green/completed mid-turn
5. Group count/title flapping for the same turn
6. Delayed visible handoff after async child progress
7. Lifecycle-only shells temporarily replace the real execution block

---

## 2. Foundational decisions

1. **One client canonical state shape.**
   The client keeps one in-memory conversation state shaped like backend canonical transcript:
   `ConversationState -> TurnState -> Execution.Pages`.

2. **SSE mutates canonical state; transcript hydrates canonical state.**
   Both inputs target the same client state object. There is no second reducer state and no synthetic event conversion from transcript.
   More explicitly:
   - `applyEvent(event: streaming.Event)` consumes the backend SSE shape directly.
   - `applyTranscript(state: api.ConversationState)` consumes the backend canonical transcript shape directly.
   - neither input is first rewritten into a client-invented semantic protocol.

3. **Latest turn is SSE-owned.**
   While a turn is the latest live-owned turn, transcript may fill missing stable data but may not replace or shrink that turn.

4. **Older turns are transcript-owned.**
   Once a turn is no longer the latest turn, transcript is authoritative for it.

5. **Lifecycle is visible inside execution details.**
   `turn_started`, terminal turn events, and other lifecycle markers remain visible as entries inside execution details. They are not hidden just because they carry no assistant text.

6. **Phase is a tag, not lifecycle.**
   `intake`, `sidecar`, `summary`, `main` are execution/page phase tags. Turn lifecycle is only:
   `pending | running | completed | failed | cancelled`.

7. **Real ids win, stable local render identity stays stable.**
   Each logical row/entity has one immutable local render identity. Backend ids (`messageId`, `pageId`, `toolCallId`, `turnId`) are attached as data and may fill in later, but do not replace the render identity.

---

## 3. Contract 1 — Identity

### 3.1 Stable render identity

Every client-side logical entity has:

```ts
interface EntityIdentity {
  readonly renderKey: string;   // immutable, opaque
  messageId?: string;
  pageId?: string;
  toolCallId?: string;
  turnId?: string;
  clientRequestId?: string;
}
```

Rules:

- `renderKey` is allocated once, never changed
- `renderKey` is opaque; no prefixes, no encoded semantics
- consumers key React rows on `renderKey`, never on `messageId` / `turnId`
- backend ids are data for matching and enrichment only

Forbidden:

- reassigning `renderKey`
- keying UI rows on `messageId`, `turnId`, `pageId`, `toolCallId`
- “promote local id to server id” as a key rewrite operation

### 3.2 Matching incoming observations

Matching is **per entity kind**, not one flat cross-kind lookup.

| Observation kind | Match order |
|---|---|
| user message | `messageId` -> `clientRequestId` -> constrained fuzzy match |
| execution page | `pageId` |
| tool call | `toolCallId` |
| model step | stable page-local identity |
| lifecycle entry | stable page-local identity |
| linked conversation | `linkedConversationId` |

If no match succeeds for the relevant kind, create a new entity.

Special case for locally-submitted user rows before echo:

- if there is no `messageId` yet, a locally submitted user entity may be matched by:
  - same conversation
  - same role = `user`
  - same normalized content
  - submit timestamp window of **± 500 ms**
- this fuzzy path is allowed **only** for unresolved local-origin user entities
- if more than one candidate matches, no collapse occurs; create a new entity and emit telemetry

### 3.3 Bootstrap consequence

The user message created by local submit and the later server echo must resolve to the same logical entity whenever the match rules succeed.

That means:

- `renderKey` is stable from local submit through SSE echo and transcript hydration
- backend ids fill in on the existing entity
- no duplicate prompt row is rendered

---

## 4. Contract 2 — Canonical client state

The client state mirrors backend canonical transcript shape closely.

```ts
interface ClientConversationState {
  conversationId: string;
  turns: ClientTurnState[];
}

interface ClientTurnState {
  renderKey: string;
  turnId: string; // '' allowed during pending bootstrap
  lifecycle: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  users: ClientUserMessage[];
  pages: ClientExecutionPage[];
  assistantFinal?: ClientAssistantFinal | null;
  elicitation?: ClientElicitation | null;
  createdAt?: string;
  updatedAt?: string;
}

interface ClientUserMessage extends EntityIdentity {
  role: 'user';
  content: string;
  createdAt?: string;
}

interface ClientExecutionPage extends EntityIdentity {
  phase?: 'intake' | 'sidecar' | 'summary' | 'main';
  status?: string;
  preamble?: string;
  content?: string;
  finalResponse?: boolean;
  modelSteps: ClientModelStep[];
  toolCalls: ClientToolCall[];
  lifecycleEntries: ClientLifecycleEntry[];
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
}
```

### 4.1 Pending bootstrap is the same turn

A turn exists as soon as local submit happens:

- `turnId = ''`
- `lifecycle = 'pending'`
- one user message already present
- zero or more pages

When `turn_started` arrives later:

- fill in `turnId`
- set lifecycle to `running`
- keep the same `renderKey`

There is no separate bootstrap row/path.

### 4.2 Transcript-created turns derive lifecycle from transcript state

If a turn is first observed from transcript:

- initialize lifecycle from transcript turn status immediately
- do not default transcript-created terminal turns to `running`

### 4.3 Phase vs lifecycle

- page/round `phase` comes from backend `Phase`
- turn lifecycle is derived only from submit + turn terminal events/status
- `assistant_preamble`, `assistant_final`, `model_*`, `tool_call_*` do not make the turn terminal

### 4.4 Latest turn is strictly monotonic

For the latest SSE-owned turn:

- page count never decreases
- tool/model/lifecycle entries never disappear because of transcript replay

Definition:

- A turn is **latest SSE-owned** while its lifecycle is `pending` or `running`.
- A turn stops being SSE-owned the moment its lifecycle becomes terminal:
  - `completed`
  - `failed`
  - `cancelled`

This is the only ownership rule used by merge.

---

## 5. Contract 3 — Merge

### 5.0 Input boundaries

There are exactly three mutation entrypoints:

- `applyEvent(event: streaming.Event)`
- `applyTranscript(state: api.ConversationState)`
- `applyLocalSubmit(submit: LocalSubmit)`

`applyEvent` consumes the backend SSE shape directly.

`applyTranscript` consumes the full backend canonical conversation state directly.

No transcript rows, no normalized rows, no synthetic events, and no intermediate client-only semantic protocol.

### 5.1 Provenance

Every leaf field and every collection element carries provenance:

- `event`
- `transcript`
- `local`
- `null`

Provenance is tracked per leaf/per element, not just per top-level field.

Structural containers are merged per entity kind:

- user messages: `messageId` -> `clientRequestId` -> constrained fuzzy match
- execution pages: `pageId`
- tool calls: `toolCallId`
- model steps: stable page-local identity
- lifecycle entries: stable page-local identity
- linked conversations: `linkedConversationId`

### 5.2 Effective writes

A write is effective only if it carries meaningful data for that field.
Empty/blank partial values do not block later repair.

### 5.3 One merge rule

- local/event writes always win over transcript for the latest SSE-owned turn
- transcript may fill fields that are unset or transcript-owned
- transcript may not shrink collections
- transcript may not replace event-owned/latest-turn content with stale values

For the same matched entity:

- `event` supersedes `local`
- `local` is bootstrap state only
- once an effective event write lands on a field, provenance becomes `event`
- transcript may not overwrite an `event`-owned field

If the server-normalized value differs from local bootstrap data, event wins.

### 5.4 Latest-turn ownership rule

If a turn is the latest live-owned turn:

- SSE/local writes are authoritative
- transcript is fill-only
- transcript cannot:
  - replace content
  - replace lifecycle
  - replace phase
  - shrink pages/tool/model entries

If a turn is not the latest turn:

- transcript is authoritative for filling and refinement of transcript-owned or unset fields
- event-owned fields remain authoritative even after the turn becomes historical
- transcript may not overwrite an event-owned field
- transcript still may not shrink collections or remove known entities

### 5.5 No synthetic replay from transcript

Transcript is merged structurally into canonical state.
It is never re-expressed as synthetic SSE events.

### 5.6 No shrink

No shrink is allowed anywhere.

- transcript may add missing entities/elements
- transcript may fill missing fields
- transcript may not remove existing turns, users, pages, tool calls, model steps, lifecycle entries, or linked conversations

If a transcript snapshot contains less structure than current client state, the client keeps the richer known structure and logs telemetry.

---

## 6. Rendering contract

Terminology bridge:

- `ClientExecutionPage` is the canonical client-state unit of execution detail.
- `IterationBlock` is the React component that renders one turn's execution-details card.
- A page becomes one visible entry/round inside that card.

### 6.1 One user row per user message entity

Each user message entity renders once.
No optimistic duplicate row outside canonical state.

### 6.2 One execution-details card per turn

Each turn renders one execution-details card.
The card is stable from pending through terminal.

### 6.3 Card mount rule

Execution details mounts when the turn has at least one renderable execution entry:

- lifecycle entry
- model step
- tool call
- elicitation
- linked conversation
- assistant preamble/content/final

`Execution details (0)` is invalid and must never render.

Header text/count rule:

- the card mounts when the turn has at least one renderable execution entry
- the count `(N)` includes only non-lifecycle renderable entries:
  - model steps
  - tool calls
  - elicitations
  - linked conversations
  - assistant preamble/content/final
- lifecycle entries do not contribute to `(N)`
- if `N = 0`, the header is descriptive only and never renders `(0)`

Examples:

- lifecycle-only `turn_started` -> `Starting turn…`
- lifecycle + pure `model_started` -> `Execution details (1)`
- terminal lifecycle-only cancelled turn -> `Cancelled`

### 6.4 Lifecycle visibility

Lifecycle entries always render inside the execution-details card once present.
No separate lifecycle pill row.

### 6.5 Pure model-start turns are visible

A turn with only `model_started` / thinking state is still a valid execution-details card.
Thinking is not hidden behind a placeholder rule.

### 6.6 Header status

The execution-details card status is a total function of turn lifecycle first:

- `pending` -> running tone
- `running` -> running tone
- `completed` -> success tone
- `failed` -> danger tone
- `cancelled` -> neutral tone

Sub-step completion may not flip the card to completed while lifecycle is still running.

### 6.7 Duplicate-prompt rule

The UI may not render a second visible row whose only purpose is to repeat the user’s prompt before real execution detail exists.

Legitimate assistant text may equal the user prompt in value, but it must come from a distinct assistant entity/page/segment with real execution evidence.

The forbidden case is duplicate projection of one logical submit/echo path, not equal string value.

### 6.8 Steering placement

For turns with multiple user messages:

- first user row
- then execution-details card
- then later user injections in order
- the same card persists and grows

The card is never duplicated or split.

---

## 7. Rollout

### 7.1 Deployment precondition

PR-0 can ship on the current backend canonical shape.

Later backend improvements unlock cleaner behavior:

- multi-user transcript echo for steering
- more consistent phase emission

But they are not blockers for fixing the current active-turn UI bugs.

Bounded compatibility note:

- The client intentionally supports the existing canonical backend shape.
- Two narrow compatibility fallbacks are allowed during rollout:
  - `turn.Users ?? [turn.User]`
  - `Phase ?? 'main'`
- No broader legacy-shape shim or synthetic conversion layer is introduced.

### 7.2 PR-0 — Real user-visible path first

**PR-0 may refactor client ownership and rendering, but it must not invent a new data contract.** It operates only over the existing backend SSE shape (`streaming.Event`) and the existing backend canonical transcript shape (`api.ConversationState`). Any PR-0 change that introduces a new intermediate wire type, a new "segment" protocol, a transcript-to-event converter, or a second canonical model violates the core principle at the top of this document and is rejected at review.

PR-0 must migrate the actual chat feed path end-to-end:

- Forge submit path
- agently chat service submit path
- SSE handling (consumes `streaming.Event` directly)
- transcript application (consumes `api.ConversationState` directly)
- main chat feed rendering
- `IterationBlock`

Legacy files may remain on disk after PR-0, but:

- they are no longer fed for the main chat surface
- they are no longer read by any main-chat consumer
- they are not written to by the main chat runtime after PR-0

### 7.3 Side-consumer ownership

PR-0 must explicitly enumerate and migrate any consumer of:

- `chatState.liveRows`
- `chatState.transcriptRows`
- `chatState.renderRows`

No hidden side readers/writers are allowed after PR-0 for the main chat path.

### 7.4 PR-1

Harden reducer/projection completeness and tests.

### 7.5 PR-2

Mechanical follow-up only if any non-main-chat runtime writer/reader remains after PR-0.
If PR-0 already cuts all legacy writes/reads, PR-2 is collapsed into PR-0.

### 7.6 PR-3

Delete contingent legacy modules only after behavior is proven stable.
Deletion is cleanup, not the proof of success.

---

## 8. Tests

### Contract 1

- stable `renderKey` across local submit -> SSE echo -> transcript hydration
- no duplicate user row when match succeeds
- ambiguous fuzzy match does not silently collapse

### Contract 2

- pending turn renders once
- transcript-created completed turn initializes completed
- intake shows inside execution details
- pure model-start turn renders execution details
- lifecycle entries remain visible
- duplicate prompt row does not appear during bootstrap
- steering order is stable
- backend status mapping is explicit:
  - `queued` -> `pending`
  - `running` -> `running`
  - `waiting_for_user` -> `running`
  - `completed` -> `completed`
  - `failed` -> `failed`
  - `canceled` -> `cancelled`

### Contract 3

- transcript is idempotent
- latest live-owned turn cannot be shrunk by transcript
- transcript fills missing stable fields only
- live and transcript replay converge to the same canonical state when ids align
- local vs event precedence is explicit: event supersedes local for the same matched entity
- historical-turn overwrite rule is explicit: transcript may refine transcript-owned/unset fields only; it may not overwrite event-owned fields

### Header / lifecycle examples

- lifecycle-only `turn_started` -> header `Starting turn…`
- lifecycle + pure `model_started` -> header `Execution details (1)`
- lifecycle-only cancelled turn -> header `Cancelled`

### End-to-end

At least one application-boundary test must cover:

- Forge `Chat.jsx`
- submit
- local bootstrap
- first SSE event
- transcript poll
- execution-details render

Tracker-only tests are necessary but not sufficient.

---

## 9. Definition of done

Done means:

1. One user task row per logical user message
2. One stable execution-details card per turn
3. No `Execution details (0)`
4. No duplicate prompt on submit
5. Intake/sidecar visible inside execution details when present
6. Lifecycle visible inside execution details
7. Header status does not flap mid-turn
8. Latest turn is not reshaped by transcript
9. Real user-visible chat path runs on the new canonical client state

Physical file deletion is contingent cleanup after those behaviors are true.

---

## 10. Deliberately excluded

- new segment architecture
- synthetic transcript-to-event replay
- second canonical client state model
- identity prefixes (`lc:`, `sv:`, `crid:`)
- separate bootstrap row/path
- lifecycle pill row outside execution details
- status heuristics based on whichever sub-step completed last
