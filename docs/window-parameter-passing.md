# Passing Parameters Between Forge Windows

This document explains the **canonical** way to hand data from one window to
another when you call `window.openWindow`.

It covers:

* Authoring the *parameters* section in metadata
* How the runtime resolves and packages the values
* How `WindowContent` applies them so that **any** signal in the target
  DataSource can be preset ( `input.filter`, `form`, `selection`, … ).

---

## 1. Declaring parameters in metadata

Inside an *execution* (e.g. a button `onClick`) that opens the new window add
`parameters:` definitions.

```yaml
on:
  - event: onClick
    handler: window.openWindow
    args: [ chat/new, History Chat ]
    parameters:
      # Copy the selected `history.id` into the *filter* of the
      # `conversations` DataSource in the new window
      - name: filter.id
        to:   conversations
        in:   selection
        location: history.id

      # Put the same id into *input.parameters.convID* of the `messages`
      # DataSource
      - name: input.parameters.convID
        to:   messages
        in:   selection
        location: history.id
```

Field semantics

| Field   | Purpose                                                                                |
|---------|----------------------------------------------------------------------------------------|
| `to`    | **Destination DataSourceRef** inside the new window. |
| `name`  | Path *inside the DataSource signals* to receive the value.<br>Can be: <br>• **Exact path** (e.g. `form.user.id`) – creates nested objects as needed. <br>• **Spreader `...`** – copies every field of the resolved source object into the destination signal. <br>• **Array shortcut `[]field`** – wraps the single resolved value into a one-element array. <br>  <br>For top-level tokens `filter` or `parameters` the runtime writes into `signals.input`.<br>Any other root token writes to the signal with the same name (`form`, `selection`, `message`, …). |
| `in`    | Where to read from in the *current* window (`selection`, `form`, `metadata`, …).       |
| `location` | Selector path inside that source (e.g. `order.id`).                                  |

## 2. Runtime resolution (`src/hooks/parameters.js`)

`resolveParameters(defs, ctx)`

1. Iterates over the array.
2. Calls the correct resolver based on `in:` to pull the value from the
   current window (selection, form, metadata, …).
3. Builds an **object of objects** grouped by `to` (or legacy `kind`):

```json
{
  "conversations": {
     "filter": { "id": "123" }
  },
  "messages": {
     "input": { "parameters": { "convID": "123" } }
  }
}
```

This structure is stored in `activeWindows[i].parameters` when the new window
is added.

## 3. Applying parameters (`WindowContent.jsx`)

When `WindowContent` mounts it renders a `DataSourceContainer` for each
DataSource in the metadata.  Each container receives its slice of
`initialParams` ( `parameters[dsRef]` ).

```jsx
Object.entries(initialParams).forEach(([k, v]) => {
  if (k === 'filter' || k === 'parameters') {
      // write into signals.input
      dsContext.signals.input.value = { ...input.peek(), [k]: v };
  } else {
      // write directly into the matching signal (form, selection …)
      const signal = dsContext.signals[k];
      if (signal) signal.value = v;
  }
});
```

Because this runs **once** per DataSource (in a `useEffect` with `dsContext`
as dependency) the parameters are not re-applied during later re-renders.

### What can be preset?

* `filter` → presets the table query.
* `parameters` → generic input parameters passed to backend connectors.
* `form` → immediately shows data in edit/preview forms.
* `selection` → pre-selects a row/node.
* Any custom signal you create in code can be initialised the same way as
  long as you expose it under `dsContext.signals`.

This makes the mechanism **data-source agnostic**: simply choose a `kind`
that matches the destination DataSource and write into the desired signal.

## 4. Master–Detail example without tables

If the master window is not a table (e.g. a form + button) you can still pass
values:

```yaml
parameters:
  - name: filter.parentId
    to:   detailDs
    in:   form
    location: master.id

  - name: input.parameters.refresh = true  # trigger immediate fetch
    to:   detailDs
    in:   metadata
    location: ''
```

Setting `input.parameters.refresh = true` causes the child DataSource to fetch
its collection as soon as the parameters are applied.

---

### TL;DR

1.  Use `kind` to choose the **target DataSource** in the new window.  
2.  Use `name` to choose the **signal** inside that DataSource.            
3.  Values are resolved in the *current* window based on `in` and `location`.  
4.  The runtime applies them once, so they don’t overwrite user changes later.
