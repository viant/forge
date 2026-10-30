# Forge UI primitives

## Goal

Provide a domain-neutral, metadata-driven interaction vocabulary that replaces repeated host JavaScript while preserving authoritative datasource, authorization, validation, and transaction boundaries. Forge interprets presentation and interaction metadata; consuming applications supply data, capabilities, and optional domain-specific payload adapters. Business transactions never move into Forge.

The catalog contains twenty-two primitives: twelve workflow primitives and ten presentation/coordination primitives. The same contracts are intended for web and future native interpreters; renderer implementation details remain platform-specific.

## Shared command execution

Mutation behavior has three distinct concepts:

1. `MutationCommand` is the reusable metadata definition embedded by any mutating primitive.
2. `CommandExecutor` is the single runtime state machine that executes that definition.
3. `mutationCommand` is the optional standalone visual trigger. Other primitives embed the same definition and executor without needing a standalone button.

Every mutating primitive MUST dispatch through `CommandExecutor`. A primitive may own trigger-specific preconditions, input preparation, selection semantics, and presentation, but MUST NOT reimplement command validation, confirmation, active-invocation suppression, timeout classification, writer invocation, result handling, reconciliation, or dependent refresh.

Normative lifecycle:

```text
primitive precondition
  -> acquire command-instance guard
  -> resolve parameters
  -> command validation
  -> confirmation
  -> invoke exactly one writer
     |-> failed: publish failed; no synchronization
     |-> indeterminate: keep guarded; optional authoritative recovery; no result reconciliation
     `-> succeeded: attempt reconciliation and every configured refresh; publish writer/sync status
```

Primitive predicates control UX. Command validation protects client dispatch. The writer remains authoritative for authorization, concurrency, business validation, persistence, and transaction commit.

Writer and synchronization results are orthogonal: `writerStatus` is `succeeded|failed|indeterminate`, while `syncStatus` is `not_started|succeeded|partial_failure`. Reconciliation and refresh synchronize UI only after a committed writer result; they are not part of the business transaction. Every configured refresh is attempted even if local reconciliation fails. If the writer succeeds but reconciliation or refresh fails, the command remains `succeeded` with `syncStatus: partial_failure` and a stale-dependency warning. It MUST NOT report that the writer failed or encourage an unsafe retry. A client timeout is `indeterminate`, because the writer may still commit after the client stops waiting; it is not equivalent to failure. An indeterminate command remains guarded until an explicit authoritative recovery calls the executor resolution API. No result-based reconciliation occurs while outcome is unknown.

The runtime creates an invocation ID for correlation, carries it through the datasource request envelope/header, and exposes `invocationParameter` only for writers whose declared input contract accepts it. Correlation alone is not writer idempotency; future replay protection requires explicit writer support.

Two guards protect different concerns. A command-instance guard suppresses the same trigger while it is validating, confirming, pending, or indeterminate; it is scoped by concrete runtime context plus `commandId` (falling back to datasource ID). A datasource-transport guard prevents different commands from concurrently overwriting the same datasource input signal or sharing one control transition. Independent commands may run concurrently only when they use distinct target datasource instances, or when a future atomic request API provides isolated request snapshots. Neither guard performs semantic request-body deduplication. Validation failure and confirmation cancellation release the command guard without acquiring transport, invoking, reconciling, refreshing, or reporting writer failure. Indeterminate outcomes retain both relevant guards until explicit authoritative recovery.

Every mutation exposed by `editableCollection`, `assignmentPicker`, `statusWorkflow`, `treeEditor`, `wizard`, `uploadCollection`, `scheduleEditor`, `draftForm`, or mutation-capable actions in `resourceHeader` and `notificationRules` composes this executor. Specialized preparation such as file-byte encoding or timezone normalization occurs before the one writer call. Primitive shorthand such as a status transition's `confirm` is normalized into the embedded `MutationCommand`; the primitive never runs a second confirmation path.

An optional `prepare: Host.prepareParameters` handler supports asynchronous
staging before that writer call. After validation and confirmation, the executor
passes `{context, parameters, extras, signal}` to the handler and awaits a full
parameter map. `parameters` and `extras` are snapshots captured before confirmation;
changing the live draft during preparation does not silently change the submitted
request. The handler can stage attachments and replace their local file values
with returned references. It must return the complete final parameter map and
must not persist the resource itself. No business-specific upload contract is
built into Forge.

The command remains guarded in phase `preparing`. A preparation error, invalid
return value, or timeout does not invoke the writer and releases the guard for
retry. Preparation uses `timeoutMs` (default 30 seconds, minimum 1 second); its
AbortSignal is cancelled on timeout. Handlers should pass that signal to their
transport and avoid applying late results to live form state. Authorization is
checked again before writer invocation. A preparation timeout differs from a
writer timeout: the former has `writerStatus: not_invoked`; the latter retains
the existing indeterminate-outcome guard. Confirmation cancellation performs no
preparation or write.

Forge workflow primitives keep interaction mechanics in the runtime and business rules in datasource contracts. Metadata selects datasources, fields, permissions, transitions, reconciliation, and layout; it does not implement transactions. Mutation datasources should normally set `replayPendingFetchOnRestore: false`.

## Resource models and typed marshalling

Resource models are a shared data contract used by primitives; they are not an additional visual primitive and they do not replace ordinary form/datasource binding. Existing windows remain unchanged unless they explicitly declare `resourceModelRef` on a reader or `payload.modelRef` on a `MutationCommand`.

A schema defines the canonical client resource. A resource model maps that canonical shape to asymmetric reader and writer contracts:

```yaml
schemas:
  record:
    type: object
    identity: [id]
    required: [id, name]
    additionalProperties: false
    properties:
      id: {type: integer}
      name: {type: string, minLength: 1, maxLength: 255}
      cap: {type: integer, nullable: true, minimum: 1}
      rows: {type: array, items: {$ref: recordRow}}
  recordRow:
    type: object
    identity: [id]
    properties:
      id: {type: integer}
      amount: {type: number}

resourceModels:
  record:
    schemaRef: record
    read: {dataSourceRef: record_read}
    write: {dataSourceRef: record_patch, inputPath: Records, mode: overlayBaseline, collection: true}
    fields:
      id: {read: id, write: Id, codec: integer}
      name: {read: displayName, write: Name, codec: string}
      cap: {read: dailyCap, write: DailyCap, codec: integer, empty: null}
      rows: {read: rows, write: Rows, collection: {modelRef: recordRow, identity: [id], preserveOrder: true}}
  recordRow:
    schemaRef: recordRow
    fields:
      id: {read: id, write: Id, codec: integer}
      amount: {read: amount, write: Amount, codec: number}
```

Activate read unmarshalling on a datasource:

```yaml
id: record_read
resourceModelRef: record
```

Activate write marshalling on any embedded command:

```yaml
mutationCommand:
  dataSourceRef: record_patch
  payload:
    modelRef: record
    source: {scope: form, dataSourceRef: record_read}
    baseline: {scope: collection, dataSourceRef: record_read, selector: '0'}
    mode: overlayBaseline
  refresh: [{dataSourceRef: record_read, bypassCache: true}]
```

When one writer object is composed from several declarative sources, use
`payload.fields`. Each map key is a canonical model path. This is mutually
exclusive with the single `source` form:

```yaml
payload:
  modelRef: campaignEventMutation
  fields:
    operation: {scope: constant, value: unassign}
    campaignId: {scope: windowForm, selector: CampaignId.0, codec: integer}
    universalEventIds:
      scope: extras
      selector: selectedRows
      where: {field: eventKind, equals: universalEvent}
      mapSelector: id
      codec: integer
    conversionPixelIds:
      scope: extras
      selector: selectedRows
      where: {field: eventKind, equals: conversionPixel}
      mapSelector: id
      codec: integer
```

Supported source scopes are `constant`, `extras`, `form`, `collection`,
`selection`, and `windowForm`. `where` is intentionally bounded to one
`equals`, `notEquals`, or `in` comparison. `mapSelector` projects every
retained row to a scalar or nested value, and `codec` applies to the scalar or
every projected array entry. Field assignments are composed atomically before
validation, confirmation, and writer invocation. Prepared payloads deep-merge
with declarative command parameters so sibling nested routing values are not
discarded; prepared values win on an exact path collision.

`write.inputPath: '$'` declares that the marshalled model is the complete
writer argument object. Use it for contracts whose canonical root contains
several sibling arguments (for example `Flights` plus `Source`); ordinary
input paths continue to wrap the model under that path.

Supported field codecs are `integer`, `number`, `boolean`, and `string`. String bindings may set `trim: true`. `empty` accepts `preserve`, `null`, or `omit`; unquoted YAML `empty: null` is intentionally decoded as the `null` policy. Nested objects use `modelRef`; nested arrays use `collection.modelRef` plus identity fields.

Nested collections declare `mode: replace|merge`. `replace` treats the draft array as authoritative while still overlaying partial rows on identity-matched baselines. `merge` also retains baseline rows omitted by the draft. With `preserveOrder: true`, draft rows lead in draft order and retained baseline rows follow; with `false`, baseline ordering is retained and new draft identities are appended. Missing and duplicate identities fail before writer invocation. Collections that may contain several unsaved rows with the same server identity (commonly `id: 0`) declare `clientKey`; each new row must carry a unique value for that declared schema field. The client key participates only in local reconciliation and is omitted from the wire when its field binding uses `write: '-'`.

Write modes are:

- `full`: marshal the supplied canonical resource.
- `overlayBaseline`: overlay the draft on the retained canonical baseline, then marshal the complete declared writer shape.
- `changed` (default): emit only declared fields whose canonical draft value differs from the baseline. Schema identity fields are emitted automatically; additional routing fields may set `alwaysWrite: true`.

`changed` describes client serialization only. Forge does not model or expose a backend's field-presence markers, dirty flags, ORM state, or Datly-specific implementation. The destination writer remains responsible for interpreting omitted versus supplied fields. Authors must explicitly select `full` or `overlayBaseline` when the writer uses replace/complete-object semantics.

Schema identity is immutable whenever a baseline exists. A draft or marshal
hook that changes an identity value fails before writer invocation. Routing
fields outside schema identity use `alwaysWrite: true`; authors must derive
that requirement from the authoritative writer contract rather than padding a
sparse payload with guessed values.

The registry validates schema references, declared identity/required fields, model fields, nested model references, datasource references, and command model references before the effective window reaches a renderer. Runtime validation covers required values, nullability, scalar types, enums, bounds, lengths, array sizes, and additional-property policy.

Optional hooks exist only at whole-model boundaries:

```yaml
hooks:
  beforeUnmarshal: Models.beforeRead
  afterUnmarshal: Models.afterRead
  beforeMarshal: Models.beforeWrite
  afterMarshal: Models.afterWrite
```

Hooks receive a deeply cloned, frozen value snapshot and must return synchronously. Returning `undefined` preserves the input. Hooks cannot own transport, authorization, confirmation, reconciliation, refresh, or multi-call transactions. Forge deliberately provides no field-level executable callbacks or arbitrary expression language. If a hook needs to invoke a service or enforce authoritative business rules, that behavior belongs in the writer backend.

The intended round trip is:

```text
reader response -> optional read hooks -> canonical model -> form draft
form draft + canonical baseline -> validation -> optional write hooks
  -> typed writer payload -> CommandExecutor -> authoritative readback
```

Simple symmetric forms should continue using existing bindings and `parameters`. Resource models are for reusable canonical models, asymmetric contracts, nested resources, and whole-resource writers.

## Collection and mutation

```yaml
id: records
dataSourceRef: records
editableCollection:
  identityFields: [id]
  selection: {mode: multi, min: 1, max: 20}
  operations:
    - {id: edit, label: Edit, handler: Host.openEdit, requiresSelection: true, selection: {min: 1, max: 1, every: {source: row, field: editable, equals: true}}}
    - id: remove
      label: Remove
      intent: danger
      requiresSelection: true
      mutation:
        dataSourceRef: records_patch
        confirm: Remove the selected records?
        reconcile: {mode: remove, dataSourceRef: records, identityField: id}
        refresh: [{dataSourceRef: record_summary, bypassCache: true}]
table: {columns: [{id: id, name: ID}, {id: name, name: Name}]}
```

`mutationCommand` can also be placed directly on a container. It provides a standalone trigger and lifecycle presentation while delegating validation, confirmation, writer invocation, reconciliation, and refresh to `CommandExecutor`. `assignmentPicker` declares available/assigned datasources plus assign/unassign command definitions. `statusWorkflow` declares allowed `from` states, destination state, predicates, and command shorthand that is normalized into the shared command definition.

For a two-state status control, `statusWorkflow.appearance: switch` reuses the
same mutation executor, confirmation, validation, duplicate-submit guard, and
authoritative refresh as the default transition buttons. Set `activeState` to
the reader's active value and optionally map reader values with `stateLabels`.
The switch is disabled when no single legal next transition exists, including
unknown or terminal states. Use the **same `commandId` in both directions** so
a readback changing the current state cannot release the pending guard early.
`to` is passed through command extras and can use a different writer encoding
from the reader's state value.

```yaml
statusWorkflow:
  appearance: switch
  label: User Status
  stateField: status
  activeState: ENABLED
  stateLabels: {ENABLED: Active, DISABLED: Inactive}
  transitions:
    - id: deactivate
      from: [ENABLED]
      to: 0
      command:
        commandId: user-status
        dataSourceRef: status_patch
        refresh: [{dataSourceRef: record, bypassCache: true}]
    - id: activate
      from: [DISABLED]
      to: 1
      command:
        commandId: user-status
        dataSourceRef: status_patch
        refresh: [{dataSourceRef: record, bypassCache: true}]
```

Each editable operation may override the collection-level `selection` contract. This allows one list to combine exactly-one Edit with independently bounded bulk operations. `selection.every`, `selection.any`, and `selection.none` apply the normal predicate operators to each selected row and fail closed before dispatch.

For a server-paginated multi-select datasource, opt in to `selectionRetention: pages`
when a bulk operation may span pages. Only changing `page` retains selected rows
from earlier pages. Changing the filter, sort, page size, or parent parameters
clears them. A successful mutation should use `clearSelection: true` on its
list refresh so stale off-page rows cannot be reused after the write. The
default datasource behavior still reconciles selection to the current page.

For a hidden complete-replacement baseline, use bounded page aggregation:

```yaml
paging: {enabled: true, size: 25, aggregate: true, maxPages: 100, parameters: {page: Page, size: Limit}}
# Use explicit offsets when the producer does not implement page numbers:
# paging: {enabled: true, mode: offset, size: 25, aggregate: true, maxPages: 100, parameters: {page: Offset, size: Limit}}
```

Forge requests producer pages sequentially, rejects duplicate identities and
an exhausted page bound, and publishes the collection only after a short or
empty final page proves completion. A later-page failure never exposes a
partial replacement baseline. Keep visible lists on ordinary server paging;
this opt-in is for commands that require the complete relation set.
Only enable it after proving the producer's Page/Limit continuation and total
against representative multi-page data. A producer that falsely reports a
short or empty page can make any client aggregator believe a partial baseline
is complete; the consumer must not use that producer for replacement writes.

### Workflow primitive reference

| Primitive | Required | Important optional fields | Runtime responsibility |
|---|---|---|---|
| `editableCollection` | table plus `operations` or shared `mutation` | `dataSourceRef`, `identityFields`, collection `selection`, operation `selection`, `handler`, `dialogId`, `visibleWhen`, `disabledWhen` | selection bounds, action state, dialog/handler dispatch, mutation reconciliation; composes with responsive grid |
| `assignmentPicker` | `availableDataSourceRef`, `assignedDataSourceRef` | `identityFields`, `labelField`, `allowMultiple`, `assign`, `unassign` | identity-safe dual-list selection, duplicate suppression, assign/unassign lifecycle |
| `mutationCommand` | `dataSourceRef` | `commandId`, `label`, `intent`, `confirm`, `parameters`, typed `payload`, `validateWhen`, `invalidMessage`, `timeoutMs`, `invocationParameter`, lifecycle states, `reconcile`, `refresh` | standalone trigger and writer/sync presentation; optional resource-model payload preparation; composes `MutationCommand` with `CommandExecutor` |
| `statusWorkflow` | `stateField`, `transitions` | transition `from`, `to`, `availableWhen`, `confirm`, `command` | expose legal transitions only; writer still revalidates state |
| `treeEditor` | `dataSourceRef` | child/identity/label fields, include/exclude fields, `searchable`, `collapsible`, `defaultExpandedDepth`, `cascade`, `mutation` | hydrate/reset selections, search/expand hierarchy, descendant cascade, include/exclude accessibility |
| `wizard` | `steps` | `stateKey`, step `containerId`, `visibleWhen`, `validWhen`, `submit` | reactive step validity, step-ID persistence, focus/announcement, submit lifecycle |
| `uploadCollection` | `upload` | `accept`, `multiple`, limits, `transport: mcpBlob`, blob/metadata fields | validate files, encode actual bytes plus filename/MIME, lock pending input, submit one writer |
| `derivedDataSource` | `sources`, `pipeline` | `version`, `maxRows`, projections, group measures, join type/cardinality | bounded declarative client composition; reject malformed/oversized plans and propagate source state |
| `permissionBoundary` | `capability` | `mode: resource|row|selection`, authorization datasource, identity field, denied message | fail closed without hiding selection producers; clear protected stale selection |
| `responsiveDataGrid` | `breakpoints` | `identityColumns`, visible/sticky columns, density, row layout, `readOnlyCards` | preserve table behavior; semantic cards only when the row is explicitly read-only, while declared cell actions retain their normal visibility/read-only/property/click handlers |
| `historyDiff` | before/after fields | ignored/redacted fields, field labels, array strategy, record label | canonical nested diff with sensitive-value masking |
| `scheduleEditor` | start/end fields | timezone field, overlap/minimum duration, add/remove, ambiguity policy, mutation | explicit instant/wall-time conversion, DST gap/fold handling, per-field draft errors, clean payload |

`reconcile` accepts `replace|merge|remove|refetch`, one or multiple identity fields, and `resultPath|rowsPath`. Unknown modes and missing identities fail closed. Multi-call business transactions are not a mutation-command feature: expose one transactional writer, then reconcile or refresh its authoritative result.

## Structured workflows

- `treeEditor`: hierarchical selection with optional descendant cascade and `includeExclude` mode.
- `wizard`: visible/valid step predicates, step container IDs, Back/Next state, and a final command.
- `uploadCollection`: accepted types, file/byte limits, single/multiple selection, MCP JSON blob encoding (base64 bytes plus filename/MIME metadata), blob field, metadata field, and upload command. Multipart is intentionally not claimed by this primitive; it requires a connector-level upload API with progress and cancellation.
- `scheduleEditor`: start/end/time-zone fields, overlap and minimum-duration validation, add/remove policy, and save command.

## Read composition and presentation

- `derivedDataSource`: typed `projections`, joins, filters, unions, sorting, and grouped `measures` (`count|sum|min|max|first|list`) over named source datasources. Declare non-critical enrichment inputs in `optionalSources`; a terminal optional error settles as an empty input plus one warning without replacing the primary datasource's loaded/error state.
- `permissionBoundary`: fail-closed resource/capability visibility with an explicit denied message.
- `responsiveDataGrid`: breakpoint-specific visible/sticky columns, density, and table/card row layout.
- `historyDiff`: before/after selectors, ignored fields, and semantic field labels.

## Presentation primitives

### `draftForm`

Adds generic draft lifecycle controls around authored form items or nested containers.

```yaml
draftForm:
  dataSourceRef: record_draft
  saveLabel: Save
  resetLabel: Reset
  validWhen: {source: form, field: name, notEmpty: true}
  submit:
    dataSourceRef: record_patch
    reconcile: {mode: merge, dataSourceRef: records, identityField: id}
```

Optional fields: `dirtyWhen`, `confirmDiscard`. The renderer compares current form state with the loaded baseline, exposes unsaved state, resets safely, and delegates persistence to the shared `MutationCommand`/`CommandExecutor` contract.

### `queryToolbar`

Reuses the generic toolbar item contract for filtering, presets, sorting, paging, customization, export, and host-defined actions.

```yaml
queryToolbar:
  dataSourceRef: records
  density: compact
  layout: responsive
  items:
    - {id: filterList, label: Filter, type: filter}
    - {id: settings, label: Customize, type: settings}
```

Optional fields: `dataSourceRef`, `density`, and `layout`; items use the existing toolbar-item contract. Query execution, persistence, and supported filter/sort/page arguments remain datasource-owned.

Tables may declare the reusable export control without a host callback:

```yaml
table:
  toolbar:
    items:
      - id: export
        label: Export
        type: tableExport
        properties:
          filename: records
          formats: [csv, xlsx]
          scope: filtered # filtered (default) or page
          maxRows: 50000
          maxCells: 500000
          maxBytes: 16777216
```

`tableExport` exports the current sorted/filtered loaded rows and Customize-visible data columns; `scope: page` limits output to the rendered page. Selection and button columns are excluded. CSV neutralizes formula-like string cells while preserving numeric types; XLSX uses typed numeric/boolean/inline-string cells. Synchronous generation is guarded by row, cell, aggregate-byte, Excel cell-length, and hard 64 MiB limits, exposes busy/error state, and cancels queued work after unmount. Native interpreters must preserve the same scope, safety, filename, format, and accessibility semantics using their platform export facilities.

### `stableTabs`

Uses the existing tab renderer with stable metadata IDs, permission pruning, active-panel-only mounting, persistence, and overflow behavior.

```yaml
stableTabs:
  defaultSelectedTabId: properties
  appearance: section
  compact: true
  renderActiveTabPanelOnly: true
containers: [$import(tabs/properties.yaml), $import(tabs/history.yaml)]
```

Optional fields: `dataSourceFetchMode`, `keepVisitedTabPanelsMounted`. Tab IDs, not ordinal positions, are the persisted contract.

### `resourceHeader`

```yaml
resourceHeader:
  dataSourceRef: record
  titleField: name
  subtitleField: description
  fields: [{label: ID, field: id, format: id}, {label: Status, field: status}]
  actions:
    - {id: watch, label: Watch, icon: star, hideLabel: true, handler: Host.toggleWatch}
```

Actions support `visibleWhen`, `disabledWhen`, a non-persistent host callback, or one `MutationCommand`. Authorization remains generic predicate input. Any action that changes persistent state MUST use `MutationCommand`; callbacks are limited to navigation, dialog opening, and local presentation adaptation.

### `dataStateBoundary`

```yaml
dataStateBoundary:
  dataSourceRefs: [records, summary]
  allowPartial: true
  loadingMessage: Loading records…
  emptyMessage: No records
  errorMessage: Records are unavailable.
  staleMessage: Showing cached records.
```

It distinguishes loading, empty, partial, error, stale, and ready without hiding its datasource fetchers.

### `relationDrill`

```yaml
relationDrill:
  dataSourceRef: record
  countField: childCount
  singularLabel: child
  pluralLabel: children
  emptyText: No children
  link: {windowKey: childList, parameters: {ParentId: {source: row, selector: id, wrap: array}}}
```

Zero relations are non-actionable. Links may target a generic window or dialog.

### `notificationRules`

```yaml
notificationRules:
  rules:
    - id: missing-input
      intent: warning
      message: Complete the required input.
      visibleWhen: {source: form, field: inputId, empty: true}
```

Optional actions use the same header-action callback/mutation contract. Rules are presentation prerequisites, never business authorization.

### `metricSummary`

```yaml
metricSummary:
  dataSourceRef: summary
  columns: 4
  metrics:
    - {id: spend, label: Spend, field: spend, format: currency2, currencyField: currency, comparisonField: spendDelta, comparisonFormat: currency2, betterWhen: lower}
```

Metrics support labels, fields, formats, row/resource currency, empty text, formatted comparison values, `betterWhen: higher|lower|neutral` sentiment, physical direction, and responsive layout. Missing or non-numeric comparisons render no trend rather than `NaN`.

### `detailView`

Renders semantic read-only resource fields without host layout code. It owns grouping, labels, formatting, presentation predicates, null/empty display, typed links, copy affordances, stable IDs, and responsive column count. It does not authorize, mutate, transform data, or replace the resource header/data-state boundary.

```yaml
detailView:
  dataSourceRef: record
  columns: 2
  responsiveColumns: {narrow: 2, phone: 1}
  emptyText: —
  sections:
    - id: general
      label: General
      fields:
        - {id: id, label: ID, field: id, format: id, copyable: true}
        - {id: name, label: Name, field: name}
        - id: account
          label: Account
          field: accountName
          link: {windowKey: accountDetail, parameters: {AccountId: {source: row, selector: accountId, wrap: array}}}
```

Sections support `id`, `label`, `description`, `visibleWhen`, and fields. Fields support `id`, `label`, `field`, `format`, `currencyField`, `emptyText`, `span`, `copyable`, `visibleWhen`, and the existing generic link contract. Presentation predicates are not authorization; protected fields must be removed by authoritative data filtering or permission pruning before render.

### `masterDetail`

Coordinates one stable master selection with a dependent detail container. It owns identity persistence/revalidation, typed detail parameter binding, selection invalidation, stale-binding suppression, responsive split/drill representation, drill-back focus, and protected detail clearing. Master/detail children remain ordinary containers and own their own data, state boundaries, permissions, and commands.

```yaml
masterDetail:
  stateKey: selectedRecord
  identityFields: [id]
  master: {containerId: recordList}
  detail:
    containerId: recordDetail
    parameters: {RecordId: {source: row, selector: id, wrap: array}}
  emptyDetail: {message: Select a record}
  selectionInvalidation: clear
  responsive: {wide: split, narrow: drill}
containers:
  - {id: recordList, dataSourceRef: records, table: {columns: [{id: name, name: Name}]}}
  - {id: recordDetail, dataSourceRef: record, detailView: {dataSourceRef: record, fields: [{id: name, label: Name, field: name}]}}
```

Persistence stores identity values, never row positions. Restored identity is provisional until the authoritative master collection contains it. No selection shows `emptyDetail`; detail loading/error remains the detail's `dataStateBoundary`. A removed, filtered, or permission-pruned identity clears selection and protected detail state rather than silently selecting another row. `masterDetail` performs no mutation or authorization.

### Presentation primitive reference

| Primitive | Primary reduction | Composition |
|---|---|---|
| `draftForm` | dirty/reset/save callback glue | authored items, wizard, mutation command, notification rules |
| `queryToolbar` | repeated filter/customize/preset/export toolbars | tables, editable collections, stable tabs |
| `stableTabs` | tab persistence/lazy-mount/permission glue | any nested containers |
| `resourceHeader` | identity/status/breadcrumb/action headers | permission boundary, status workflow, notifications |
| `dataStateBoundary` | inconsistent loading/empty/error/stale branches | wraps visual content but not fetch activation |
| `relationDrill` | repeated count/link/zero-state code | headers, tables, metric summaries |
| `notificationRules` | imperative prerequisite/warning branches | forms, headers, status workflows |
| `metricSummary` | repeated KPI/trend card markup | query toolbar, data-state boundary |
| `detailView` | repeated read-only field grids and detail-dialog layout | resource header, data-state boundary, relation drill, stable tabs |
| `masterDetail` | selection persistence, dependent binding, split/drill and stale-detail callback glue | editable collection/grid master plus arbitrary detail composition |

## Cross-platform interpreter contract

Metadata, predicates, state transitions, mutation inputs, validation rules, identity semantics, and test vectors are platform-neutral. Web, Android, and iOS implement separate native renderers. A renderer must preserve accessibility, permission pruning, loading/error truthfulness, stable IDs, mutation idempotency, and responsive/adaptive semantics; it must not embed host-specific business rules.

These contracts are intentionally domain-neutral. Host callbacks may translate selected rows into an existing business-specific dialog or datasource payload, while generic Forge code must not know the consuming application, resource type, or backend tool name.

## Proof gate

Broad host-application adoption is gated by four checks:

1. `go test ./backend/types` proves every primitive survives YAML to Go to JSON without losing explicit values.
2. `workflowModels.test.js`, `editableCollectionModel.test.js`, and `scheduleTimeZone.test.js` prove deterministic behavior, mutation safety, and timezone/DST semantics.
3. Workflow and presentation renderer/model suites prove all twenty-two render or produce accessible semantic output and state why each removes repeated host glue. `commandExecutor.test.js` covers invalid, cancelled, succeeded, failed, indeterminate, synchronization-warning, concurrency, and correlation paths.
4. `npm run build`, consumer-runtime integration tests, metadata registry loading, and independent UX review prove integration. A consuming application may adopt a primitive only after its own live datasource, permission, mutation, responsive, and rollback evidence still passes.

All twenty-two primitives require an independent architecture/UX verdict before release. Reviewers must verify the primitive removes generic host logic, preserves datasource and authorization truth, composes with sibling primitives, remains usable at narrow widths, and does not absorb business transaction behavior.

Run the reproducible workflow gate with:

```sh
npm run verify:workflow-primitives
```

The command proves the twelve workflow primitives at the framework boundary: typed YAML/Go/JSON round-trip, deterministic models, shared command lifecycle, rendered semantics, upload byte encoding, timezone/DST behavior, and a production build. It deliberately does not claim host-product adoption. A primitive's product value is proven separately by a real consumer retaining its authoritative datasource, permission, mutation/readback/rollback, and responsive evidence.

### Value-proof ledger

| Primitive | Framework value demonstrated by the gate | Host proof required before broad migration |
|---|---|---|
| `editableCollection` | one identity/selection/operation/reconciliation contract | real collection operations and stale-selection recovery |
| `assignmentPicker` | deterministic, duplicate-safe assignment state | authoritative available/assigned readers plus assign/unassign rollback |
| `mutationCommand` | one fail-closed writer lifecycle with correlation and partial-sync truth | exact writer payload, committed readback, failure and indeterminate recovery |
| `statusWorkflow` | only legal metadata transitions are exposed | backend transition revalidation and reversible status evidence |
| `treeEditor` | hierarchical include/exclude selection and descendant cascade | authoritative tree identity, hydration, mutation, and denied-row behavior |
| `wizard` | visible/valid step navigation and stable step identity | real multi-step draft preservation and one transactional submit writer |
| `uploadCollection` | actual file bytes, MIME/name metadata, and preflight limits | real blob writer, size/type rejection, success readback, and retry behavior |
| `derivedDataSource` | bounded deterministic join/group composition | real source ownership, loading/error propagation, and cardinality evidence |
| `permissionBoundary` | resource/row/selection capability checks fail closed | live permitted/denied personas and protected-state clearing |
| `responsiveDataGrid` | breakpoint projection with semantic read-only cards | desktop/1024/390 evidence without lost actions, identity, or paging |
| `historyDiff` | semantic nested diff, noise suppression, and redaction | authoritative before/after records and sensitive-field review |
| `scheduleEditor` | overlap validation plus explicit DST gap/fold conversion | resource-timezone writer, readback/rollback, and ambiguous-time UX |

The ledger is intentionally asymmetric: a green framework gate makes a primitive eligible for a host proof; it does not make an unadopted primitive production-proven.

### Draft form composition

A container with `draftForm.wrapContent: true` renders its actions above its fields/child containers. Omit this opt-in to preserve the existing standalone/footer placement.
Those children are disabled for the entire guarded command, including confirmation,
synchronization and an indeterminate write outcome. Standalone draft forms remain
supported. `draftForm.validate` optionally names a synchronous application handler
receiving `{context, form}` and returning an empty string/true for valid data or an
error message/false for invalid data. Missing or asynchronous validators fail closed.
The validation is UX feedback; the resource model/writer must still validate writes.
Reset uses the latest clean baseline, including asynchronously loaded reader data.

Readiness predicates can reference a specific datasource without a JavaScript
window-state mirror. For example,
`{source: control, dataSourceRef: baseline, field: loaded, equals: true}`
reads and subscribes to that datasource's control signal. Combine it with
`loading: false` and an empty `error` predicate before a full-replacement
mutation. Other leaf scopes also honor an explicit `dataSourceRef`.

### Table button cell mutations

A basic table `type: button` column can declare `mutationCommand` using the same
command contract as standalone buttons. It reuses `MutationCommand` and the
existing command executor for confirmation, payload preparation, async `prepare`,
writer invocation, reconciliation, refresh and lifecycle presentation.

```yaml
dataSource:
  records:
    uniqueKey: [{field: id}]
view:
  content:
    id: recordsTable
    dataSourceRef: records
    table:
      columns:
        - id: remove
          name: Remove record
          type: button
          icon: trash
          mutationCommand:
            dataSourceRef: recordPatch
            prepare: Records.prepareRemoval
            confirm: Remove this record?
            refresh: [{dataSourceRef: records, bypassCache: true}]
```

The independently invented example names no application or service. The host's
prepare handler receives `{context, parameters, extras, signal}`; `extras` contains
`row`, `value`, `rowIndex` and `columnId` from the activated cell. Return the writer's
parameter map from `prepare`, or use the existing typed `payload` contract with
`source: {scope: extras, selector: row}`. Without payload/prepare, these extras use
the executor's ordinary parameter merge semantics. They are not permission facts.
The command uses the clicked row directly and does not select it first.

Declare a complete datasource `uniqueKey`. Compound keys use their ordered,
typed field values; zero and false are valid. Missing/null/empty or non-scalar key
components disable the action with an explanatory title. There is no row-index
fallback. A row's lifecycle follows its identity when sorting or paging, and
separate window instances retain separate command state. Authored `commandId`
is a namespace within the derived window/datasource/column/row identity, rather
than a replacement for that identity.

When `mutationCommand` is present, it owns activation and takes precedence over
legacy cell `onClick` handlers. Other button appearance and availability policies
remain in effect. Without it, the existing event path is unchanged. The button
has an accessible action name, native keyboard activation, disabled/pending
presentation and the shared polite lifecycle status. Confirmation uses the shared
accessible dialog; cancellation never invokes preparation or the writer.

A second activation of a guarded command cannot write again. Different rows
sharing a writer also use the existing datasource transport guard, preventing
concurrent input replacement; the second row reports that the datasource is busy.
Failures remain visible and retryable; a remounted terminal failure resets its
presentation through the existing primitive. An unknown writer outcome remains
guarded across remounts and requires the existing authoritative resolution path;
it is never automatically retried. No new lock, backend service or mutation
lifecycle is introduced. Independently authored component and native source
capture/recompile tests cover this contract. Host integration and real writer
persistence require their own qualification.

A cell can choose between fixed commands using `mutationCommands`. Conditions use
the existing predicate vocabulary, evaluated against the clicked row. Exactly
one matching entry selects its command. Multiple matches disable activation;
zero matches use the optional singular `mutationCommand` fallback or disable the
button when no fallback exists. The selected variant retains its own lifecycle
identity within the row.

```yaml
mutationCommands:
  - when: {source: row, field: mode, equals: primary}
    command:
      dataSourceRef: primaryPatch
      serializationGroup: recordChanges
      prepare: Records.preparePrimary
  - when: {source: row, field: mode, equals: secondary}
    command:
      dataSourceRef: secondaryPatch
      serializationGroup: recordChanges
      prepare: Records.prepareSecondary
```

Optional `serializationGroup` on any `MutationCommand` shares one guard across
commands in the same context/window, even when they use different writers. The
executor acquires it before validation, confirmation and preparation. Another
activation reports that the group is busy and performs no preparation or write.
Cancellation, validation/preparation errors, writer failure and acknowledged
completion release the invocation's own lease. Unknown outcomes retain it until
`resolveIndeterminateCommand` resolves that command after authoritative readback.
Another row cannot release the lease. Separate windows and ungrouped commands
keep their independent behavior. The existing target transport guard still
serializes commands sharing one writer. This is optional concurrency control,
not authorization, automatic queuing or retry.
