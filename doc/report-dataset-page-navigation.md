# Report dataset page navigation

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
