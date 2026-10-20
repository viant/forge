# Hierarchical result preview

Use a container with `resultPreview: {dataSourceRef: result, dataField: payload, label: Query result}` to inspect arbitrary JSON from a declared datasource. `dataField` is relative to the datasource form record and defaults to `data`.

The widget retains table/JSON switching, expandable child collections, object fields, scalar values, empty collections and a bounded nested rendering depth. It has no network calls, application schemas, credentials or mutation behavior. The window owns loading and evidence/budget semantics.

React hosts can also import `ResultPreview` or `NestedDataGrid` from `forge/result-preview` with a `data` prop. Metadata windows use the same renderer through `container.resultPreview`.
