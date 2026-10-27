# Report dataset page navigation

The shared engine and runtime were published in `3fa1930`; the isolated
AIStudio integration uses published Forge `3ebcb11`.

- ExecuteResourceRequest.datasetPageOffsets is a map from declared dataset ID to
  nonnegative bounded row offset. It is accepted only with datasetFetchMode=page.
- A requested dataset must exist and be selected. Its descriptor must declare
  offset paging and the offset parameter must not be pinned. Scope, limit,
  projection, source identity and ordinary admission checks remain unchanged.
- Shared ReportDatasetPager displays row ranges and previous/next controls using
  hasMore. It never treats local slicing as server continuation. Missing host
  support produces an explicit partial-data notice.
- ReportRuntime accepts datasetPages and onDatasetPageChange. Hosts own pending
  operations, per-scope positions, cancellation, stale-response suppression and
  offset reset when filters or authority change. Complete exports omit offsets.

Offset/page descriptors may omit `paging.dataInfoSelectors.hasMore` when the
datasource service generates normalized `dataInfo.hasMore` from the returned
page size. Report page/complete execution consumes that actual boolean. Missing
or non-boolean completeness still fails; the report engine never infers it from
rows. Cursor descriptors continue to require explicit producer continuation paths
and tokens. Resource revalidation, row/byte/page bounds and progress checks apply
to every continuation.

The private AIStudio browser adapter is guarded by
`session.reportCapabilities.datasetPaging=true`. Older backends must not advertise
this capability. The isolated adapter forwards PreviewTestRequest offsets through
request context to ExecuteResource and advertises support only when its native
production report runner is configured.

Verification on the isolated integration: the full shared engine suite passed;
private native-MCP page/export integration, full catalog suite and 38 rendered
preview/filter/cancellation tests passed. Live Video-filtered Geo traversed 199
rows over eight pages and Creatives 59 rows over three pages, with unique grouping
tuples and matching totals. Chrome verified Geo Next/Previous, disabled controls
while pending, filter-reset to page one, and a complete 199-row CSV exported from
page two. These are scoped integration results, not acceptance of every report.
