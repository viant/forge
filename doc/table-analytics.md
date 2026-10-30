# Inline hierarchical and pivot tables

These opt-in `tableBlock` contracts operate on a complete, already authorized
snapshot. They do not discover producers, fetch children, change authorization,
or replace the existing query-scope drill transitions. Ordinary tables retain
their existing behavior.

The [laboratory fixture](examples/laboratory-table-analytics.json) is independently
invented. It includes building → room → equipment category inventory with available
and occupied units, plus inspection counts pivoted by Electrical, Mechanical and
Safety. There is no customer data or private source. Run the normal Vite server
and open `table-analytics-preview.html` for the actual shared ReportRuntime and
DashboardTableContent example.

## Hierarchy

```json
{
  "hierarchy": {
    "keyField": "nodeId",
    "parentField": "parentId",
    "labelField": "name",
    "defaultExpandedKeys": ["atlas"],
    "totals": {"mode": "producer"}
  }
}
```

Every row requires a unique nonempty string key and an explicit parent: null for
a root, otherwise another row's key. Fields refer to literal record keys. The
label field must be a displayed column; key and parent fields must be declared
in the dataset catalog and are included in its projection even when hidden.
Duplicate keys, missing parents, orphan links and cycles reject the materialized
report. Input order determines sibling order until a sort is selected.

Parent values in `totals.mode: producer` are displayed exactly as supplied.
Forge does not infer additivity from names or formats. To compute additive
parent totals, author `totals: {mode: "sum-leaves", fields: ["available",
"occupied"]}`. Only descendant leaves contribute; intermediate totals are never
counted twice. Computed parent fields must be null or absent in the source to
prevent replacing producer totals. Values must be finite numbers, null or absent.
Null/missing values do not contribute; an all-missing group stays null, while
measured zero stays zero. Numeric overflow rejects the transformation.

The native table uses buttons with `aria-expanded` for inline children. Enter
and Space activate them through normal button semantics. Expansion is stored by
row key, so equal data recreated during a render preserves choices. Nested
choices survive collapsing and reopening a parent. Optional presentation state
`expandedKeys` supports host retention; stale keys are harmless when rows leave
the snapshot. Expansion never changes exported rows.

Search and dashboard filters show matching rows plus their ancestor paths and
force those paths open while the filter applies. Totals retain the complete
admitted snapshot's meaning; a filter does not silently recalculate them. Sorting
uses the existing typed comparator, sorts roots and siblings separately, and
preserves parent/child adjacency. Missing values sort last. Local paging counts
root groups and keeps each visible subtree together; an expanded root may exceed
the nominal row-page size. Hierarchy rendering ignores flat row limits so a
preview cannot silently cut a subtree. A collapsible block previews at most five
root groups with each displayed subtree intact; its summary reports matching root
groups and the actual visible-row count. Expand removes that root-group limit. Partial server pages, truncated results,
and nonzero source offsets must be collected by the authorized host before
materialization; Forge does not issue extra calls for this feature.

The fill adds a reserved `__forge_hierarchy_path` identity column containing the
complete label path, for readable standalone child evidence in every export.
This reserved column is excluded from interactive columns, search and presentation
sort choices. Searching a parent label matches that row, not descendants solely
because its label occurs in their export path.
Sources must not use that reserved key. Source datasets retain their original
JSON row values; parent computation and the path are materialized presentation rows.

## Pivot

```json
{
  "pivot": {
    "rowFields": ["building", "room"],
    "columnField": "category",
    "columnCategories": ["Electrical", "Mechanical", "Safety"],
    "values": [{"field": "count", "label": "Inspections",
                "aggregate": "none", "format": "integer"}]
  }
}
```

Declare the row fields, column field and value fields in the block's source
columns. Row dimension values and ordered category keys are nonempty strings.
The first occurrence of each row tuple determines its initial order. Columns use
the explicit domain, including categories with no observations. Out-of-domain
categories reject the report. `aggregate: none` requires one source record per
row-tuple/category pair; duplicates reject rather than overwrite. `sum` is the
only opt-in aggregation and has the same null/zero/overflow rules as sum-leaves.
No totals or averages are inferred. Generated field keys are deterministic
`__forge_pivot_<category index>_<measure index>`; row-field collisions reject.

Pivot rows contain only their declared dimensions and generated measures, not
an arbitrary first source row's metadata. The fill preserves the complete original
long-form dataset separately. Checkbox source-row review is rejected for pivots
because a matrix row may represent several source records. Hierarchy and pivot
are separate blocks; combining them is outside this contract.

## Grouped headers and export scope

`columnGroups: [{label: "Units", columns: ["available", "occupied"]}]` groups
contiguous displayed columns. Groups cannot overlap. Ungrouped columns retain
their own ordinary headers. The browser renders native `scope="colgroup"`
headers and uniquely named sort buttons. Analytical/grouped tables retain declared
column order and bypass the legacy identifier-name freezing heuristic. Pivot groups are generated from the
ordered category domain and include a row-dimension group.

Table CSV and XLSX export every materialized row regardless of collapse or local
paging, with unambiguous `Group / Column` headers. Pivot exports are the complete
matrix; the existing dashboard workbook also retains the original long-form
dataset. Explicit export search/sort applies the same hierarchy-aware ancestor
and sibling rules as the browser. Collapse state is accepted but ignored by
exports. The existing PDF table paginator repeats qualified headers on each
page and column band, wraps long paths, and keeps identity columns with values.
Its headers are qualified flat labels rather than merged browser header cells.
HTML uses the same canonical print model. Existing admission/completeness checks
still govern all exports.

Run `npm run test:table-analytics`, `node scripts/test-table-analytics-browser.mjs`,
and `go test ./backend/reporting/materializer -run TestTableAnalyticsExports`.
Tests cover nested disclosure, stable state, search/sort/root paging, selection,
explicit totals, duplicates/cycles, nulls/zero, schema round trips, raw evidence,
and actual CSV/XLSX/HTML/multipage PDF output. This change adds authored metadata;
it does not add a visual pivot designer, native iOS rendering, lazy child loading,
automatic non-additive aggregation, or hierarchy-plus-pivot combination.

Partial native report datasets delegate table sorting to their host through
`ReportRuntime.onDatasetSortChange({datasetId, blockId, sort: {key, direction}})`.
The table keeps the producer's order and hides pending/failed rows. Hosts that
omit the callback disable partial-page sort actions; complete local datasets
continue sorting their whole collection before display pagination.

`DashboardReportRuntime` implements this callback with the existing authored
`datasetBindings[datasetId].queryPath` and the existing datasource `setSort`
handler. The adapter reconstructs the authored query parameter because `setSort`
accepts a top-level destination; `setSort` owns page reset, fetch scheduling,
cancellation and failure publication. Existing `serverTableSortValues`
normalization supplies the primary order and secondary entries. It
places the chosen field first in that query's `orderBy`, retains existing
authored secondary order entries (falling back to an initial source-order snapshot only when
no authored order is provided), resets offset and that source to page one,
and preserves filters, fixed inputs and other queries. Normalized
`collectionInfo` supplies completeness and page ownership. Producer-side
validation and admission remain authoritative.

Bounded `ExecuteResource` reads reuse `tablePresentations` to resolve a sort
against admitted table columns and push `orderBy` into a datasource that admits
that input. The effective spec records the request actually fetched. Bounded materialization
removes only producer-consumed sort choices so its local comparator cannot
reinterpret the producer's order; filters, expansions and other choices remain. Conflicting
sorts for tables sharing a dataset, pinned order, unsupported display mappings,
and analytical partial datasets fail explicitly. Partial-page sort buttons for
presentation relation paths, object/array companions and local calculated fields
are disabled; those columns keep display-value sorting on complete local data. Complete output keeps the
existing global materializer sort. No completion/fetch-all request is necessary
for an ordinary partial table sort.
