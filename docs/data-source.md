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
