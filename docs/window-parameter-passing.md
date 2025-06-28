# Window & Dialog Parameter Mapping – 2025-06

Forge now supports **bi-directional** parameter passing using a single, unambiguous
`Parameter` object.  The same structure drives all of the following flows:

1. Parent → child  (pre-populate the child window / dialog)
2. Request decoration (query / path parameters before a fetch)
3. Child → parent  (return values on `commit()`)
4. Cross-data-source writes inside the same window

---------------------------------------------------------------
Parameter fields (new)
---------------------------------------------------------------

| field       | required | description |
|-------------|----------|-------------|
| direction   | no – default `in` | `in` (before open / fetch) – `out` (on commit) – `both` |
| from        | yes | **Origin store** – syntax `[dataSource]:store`.<br>Leave `dataSource` blank to use *this* window’s default DS.  Stores: `form`, `input`, `selection`, `filter`, `metrics`, `query`, `path`, `output` (*payload at commit*). |
| to          | yes | **Destination store** – same syntax as `from`.  `caller:` prefix writes to the opener’s DS (only valid when `direction: out`). |
| name        | yes | Selector on the **destination** side. |
| location    | no  | Selector on the **origin** side. If omitted it defaults to the value of `name`. |

Shorthands
• `:form`, `:selection`, … – omit the `dataSource` to mean this window’s default DS.  
• `:query`, `:path` – aliases for `:input.query` / `:input.path`.

Automatic direction inference
• Omitted ⇒ `in`, unless `from` uses `:output` or `to` uses `caller:` – then default is `out`.

---------------------------------------------------------------
Four canonical examples
---------------------------------------------------------------

### 1. Parent → Child (pre-populate form)
```yaml
- from:      :selection
  to:        :form
  name:      customerId       # dest selector
  location:  customerId       # source selector (identical ⇒ could omit)
```

### 2. Add query parameter before fetch
```yaml
- from:      :form
  to:        :query           # expands → :input.query
  name:      statusQuery      # dest key in ?statusQuery=
  location:  status           # read form.status
```

Note on omitted data-source prefix (`:store`)
---------------------------------------------------------------
If you leave the data-source part blank (e.g. `:form`, `:query`), the
runtime substitutes **the default dataSourceRef of the context that
executes the parameter**.  That means:

* When the parent opens a child window the inbound parameter `to: :form`
  writes to the child’s default DS.
* Inside a dialog commit an outbound `to: caller:form` targets the
  opener, while simply `to: :form` would target the dialog’s own
  form.

Constants, spread and array helpers
---------------------------------------------------------------
*Constant* value – `from: const`, value in `location`.

```yaml
- from: const
  location: "/projects/reports"
  to:   :filter
  name: uri
```

*Spread* entire object – `name: ...` merges every property from the
source object into the target store.

*Array wrapper* – `name: []ids` always stores `[value]` so the caller
receives an array even when a single item was selected.

### 3. Return value from dialog / window
```yaml
- from:      :output          # payload.email
  to:        caller:form
  name:      customerEmail    # write caller.form.customerEmail
  location:  email            # read payload.email
  direction: out              # could be omitted – inferred
```

### 4. Cross-DS write inside same window
```yaml
- direction: both
  from:      :form
  to:        audit:metrics
  name:      status
  location:  status
```

---------------------------------------------------------------
Opening a dialog and mapping the result
---------------------------------------------------------------

Caller metadata:

```yaml
on:
  - event: onClick
    handler: window.openDialog
    args:
      - pickCustomer                # id  (pos 0)
      - "Pick a customer"           # title (pos 1)
      - awaitResult: true            # options object (pos 2)
        parameters:
          - from:     :output
            to:       :form
            name:     customerId
            location: id
            direction: out          # inferred because from=:output
```

Dialog side (sends full form):

```yaml
on:
  - event: onClick
    handler: dialog.commit          # publishes form as payload
```

The runtime writes `payload.id` to `caller.form.customerId` and resolves the
Promise returned by `await window.openDialog()` with the full payload.

---------------------------------------------------------------
Programmatic usage from React components
---------------------------------------------------------------
While the examples above declare the parameter mapping in metadata, the
exact same structure can be supplied when a component calls the
imperative API directly:

```javascript
// Inside a React event handler
const execArgs = [
  'pickFile',               // dialog id (pos 0)
  'Pick a file',            // title     (pos 1)
  {                         // options   (pos 2)
    awaitResult: true,
    parameters: [
      { from: ':output', to: 'caller:form', name: 'uri' },
    ],
  },
];

const payload = await context.handlers.window.openDialog({
  execution: { args: execArgs },
});

// `payload` is whatever the dialog passes to dialog.commit(payload)
// – in this case we expect an object like { uri: 'file.txt' }.
```

The runtime merges the `parameters` array from the `options` object with
those that might have been supplied on `execution.parameters`, so both
styles inter-operate.

---------------------------------------------------------------
Compatibility with classic metadata
---------------------------------------------------------------

A shim converts legacy Parameter rows to the new shape:

| legacy field | conversion |
|--------------|------------|
| `in` / `kind`         | populates `from`                      |
| `to` / `kind`         | populates `to`                        |
| `location`            | copied to `location`; also to `name` if missing |
| `output: true`        | sets `direction: out` & `from: :output` |
| `scope`               | appended to store part (`dataSource:scope`) |
| `kind: query/path`    | converts to `to: :input.query` / `:input.path` |

Thus existing projects continue to run unmodified while new metadata can
adopt the clearer five-field syntax immediately.
