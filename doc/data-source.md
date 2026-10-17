# Forge DataSource lifecycle & component interaction

This document summarises the **canonical data-flow** around a `DataSource` in
Forge UI, the reactive signals it owns, how widgets are expected to interact
with those signals, and how the new _Chat_ component fits into the same model.


## 1. Signals created for every DataSource

```
collection   signal<Array<Record>>   // full record set rendered by tables
selection    signal<{selected,rowIndex}|{selection:[]}|{nodePath,…}> // user selection
form         signal<Record>          // single record currently edited / shown
input        signal<{filter,page,…}> // command parameters sent to DataSource.jsx
control      signal<{loading,error,inactive}>
message      signal<Array<Message>>  // messagebus queue (internal)
```

`Context` wires these signals when `Context(dataSourceRef)` is requested and
exposes a rich set of **handlers** in `useDataSourceHandlers` so that widgets
can interact without touching the signals directly.


## 2. Nominal sequence diagram

```text
┌──────────┐            (user edits field / clicks row / hits submit …)
│  Widget  │──────────────────┐
└──────────┘                  │ calls one of:
   ▲                          │   • setFormField / setFormData
   │                          │   • toggleSelection / setSelection
   │                          │   • setFilter / fetchCollection …
   │                          ▼
   │               DataSource Handlers (useDataSourceHandlers)
   │               ┌───────────────────────────────────────────┐
   │               │ • mutate `form` or `selection` signal      │
   │               │ • push dependency parameters downstream    │
   │               └───────────────────────────────────────────┘
   │                           │ reactive
   ▼                           ▼
Other widgets receive     (optionally) a fetch cycle:
updated form/selection    input.fetch=true  →  DataSource.jsx
immediately.                                   connector.get()
                                              collection.value = rows
```

**Key design points**

1. `form` is the *optimistic, immediate* local state.  Components that edit
   data **must** update it through the handlers so sibling controls can react
   instantly.
2. `collection` is authoritative only after a successful `connector.get`.
3. Widgets never mutate `collection` directly – they either edit `form` or
   invoke a handler that ultimately triggers a refresh.


## 3. Chat component alignment

The Chat panel now adheres to the same principle:

* **Submit**
  1. Build `userMessage` & call `handlers.dataSource.setFormData(userMessage)` –
     pushes the message into `form` optimistically.
  2. If `chat.onSubmit` executions are defined in metadata, they are executed
     (`{message, adapter}`) and Chat stops; otherwise it falls back to the
     default `connector.post + fetchCollection` flow.

* **Upload**
  1. Build `fileMessage`; update `form` via handler.
  2. Run `chat.onUpload` executions if present, else default upload logic.

Both flows respect the *single-path* rule: DataSource remains the only code
that mutates `collection`.


## 4. Metadata reference (excerpt)

```yaml
chat:
  dataSourceRef: conversationDs
  tools: ["translate","code"]         # optional toolbar buttons
  showTools: true                      # default true
  showUpload: false                    # default true

  adapter:            # map payloads w/out changing Chat.jsx
    toOutbound:  "chat.buildPayload"   # handler name
    fromInbound: "chat.parseResponse"  # handler name

  on:                 # declare event executions
    - event: submit
      handler: chat.customSubmit
    - event: upload
      handler: chat.customUpload
```

Handlers above are resolved via `Context.lookupHandler` so they can live in
`window.actions` Go templates or be injected dynamically.

---

### TL;DR for component authors

* Update/inspect data **only via handlers** – never mutate signals yourself.
* Use `setFormData` / `setFormField` for instant UI sync.
* Trigger a refresh with `fetchCollection`, `refreshSelected` or similar
  helpers when you need server confirmation.

## Parameterized inline fixtures (Agently host)

When an Agently datasource uses `backend.kind: inline`, `backend.inlineFilters`
can opt into filtering before projection, paging, and caching. This is a host
backend feature; it is not JavaScript executed by the Forge renderer.

```yaml
id: example_delivery
cardinality: collection
selectors: {data: data}
backend:
  kind: inline
  rows:
    - {orderId: 710001, day: '2026-09-09', spend: 300}
    - {orderId: 710002, day: '2026-09-09', spend: 600}
  inlineFilters:
    - {field: orderId, input: filters.orderId, operator: eq, type: number}
    - {field: day, input: filters.From, operator: gte, type: date}
    - {field: day, input: filters.To, operator: lte, type: date}
```

Filters accept `eq`, `gte`, and `lte`, with number or date comparison. Equality
accepts a scalar or a list (membership); range filters need one value. Nested and
flat input paths are supported. Dates compare inclusive day boundaries. Missing
filter values do not restrict rows. Existing inline sources without the optional
mapping retain their previous behavior.

For an inline backend's root-array response, `selectors.data: data` supports the
root-array fallback; `selectors.data: rows` would try to project a missing field.
Verify both the public fetch result and the rendered report for the same request.
A static fixture is test data, not proof that a production backend filters or
aggregates correctly.

#### Option-source startup ownership

`Item.optionsFetchMode: onFocus` is an optional single-select rendering hint.
WindowContent mounts its `optionsDataSourceRef` normally but suppresses automatic
startup fetch only when every active consumer of that source is lazy. A shared
eager consumer, title/default data binding, or normal fallback reference retains
the source's existing behavior. The authored datasource `autoFetch` and other
metadata remain immutable. This ownership decision follows active-only window
tabs and propagates through inherited datasource parents. Explicit request intent
is not suppressed. See the widgets guide for focus/open deduplication, selected
value display and deliberate error retry.

An explicit `fetchData: false` on a container/item datasource binding is also a
**deferred consumer**, not an instruction to remove its context. It initializes
parameters and manual handlers but does not cause startup/parameter-change
priming. A dynamically mapped datasource reference follows the same rule. Any
active eager consumer, the selected default datasource or title binding still
wins, independent of traversal order; inherited parents receive the combined
ownership. No datasource `autoFetch` declaration is rewritten.

For tabbed windows, this is separate from lookup focus: an inactive tab never
contributes eager ownership when `renderActiveTabPanelOnly` is true. Activating a
visible `fetchData: true` tab starts its read even if a common hidden
`fetchData: false` binding already mounted the same datasource. Existing
`dataSourceFetchMode: once` and `keepVisitedTabPanelsMounted` behavior is retained
when revisiting the tab. Calling a deferred context's native `fetchCollection`,
refresh or explicit fetch intent remains supported. This controls automatic
consumer scheduling only; the producer continues to authorize each invocation.

Native Go metadata preserves this three-state policy as `Container.FetchData
*bool`: nil is omitted, a pointer to false is explicitly deferred, and a pointer
to true enables container activation fetch. YAML/JSON roundtrips retain literal
false, including nested containers and target overrides. Go constructors that
intend a policy must pass a bool pointer. Published components compiled by an
older bool/omitempty model must be recompiled and republished; deploying only the
new renderer cannot restore an already omitted field.

## Initial filter state

`initialFilter` supplies typed defaults for a newly initialized UI datasource:

```yaml
id: records
initialFilter:
  IncludeArchived: false
filterMode: server
paginationMode: server
filterSet:
  - name: quick
    default: true
    template:
      - {id: IncludeArchived, label: Include archived, type: boolean, operator: equal}
```

Forge clones this map into the datasource input signal only when that signal has
no `filter` property. A signal created before metadata arrives can still receive
the initial filter. Existing filters—including restored state and an explicitly
empty `{}`—take precedence. Remounting or resolving the context again does not
reapply the defaults after the user edits or clears them.

This is UI initialization, not a server constraint. User filters remain editable
and the producer still owns authorization. Use pinned backend arguments only for
constraints callers must not override. Request parameter defaults are a different
layer and should not be used to continually overwrite a filter control's state.

Verification: `src/core/store/signals.test.js` covers one-time seeding, metadata
cloning, user edits, explicit clearing, and restored filters. Typed metadata is
represented by `DataSource.InitialFilter` in `backend/types/model.go`.
