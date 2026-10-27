# One section model for screen and print

An exclusive report tab group (`includeUnlistedSections: false`) uses each
section's explicit `blockIds` as membership. The report layout controls order
within that membership; placing a KPI before its section heading in the flat
layout does not remove the KPI from its section.

`src/reporting/reportSections.js` is the shared pure model used by ReportRuntime
and ReportPrint. The previous dashboard import remains as a compatibility
re-export. Legacy sections without explicit membership keep position-based
inference. Unlisted blocks remain excluded, and hidden/composite child blocks
are not emitted twice.

A regression fixture deliberately places a KPI before its section heading.
It verifies the KPI belongs to the screen section, prints after the heading,
retains its sparkline, and excludes an unlisted narrative. All examples use
independently authored synthetic data. Browser visual acceptance remains separate.

## Initial section delivery

The stored report runtime can display one authorized section before the full
execution completes. This is opt-in intermediate output on the existing tool
execution stream. `prioritySectionId` is an advisory hint; the admitted server
spec supplies the complete section dependency closure. Unlisted analytical blocks
are excluded from the first wave; globally rendered filter bars and root scope
controls retain their declared dependencies. Shared datasets execute
once. The remaining datasets run after the initial snapshot. Ordinary JSON
callers retain the complete-result barrier.

`reportSectionReady` carries its resource binding, a complete projected
`reportSpec`/`reportFill`, the ready `sectionId`, and `sections: [{id, label}]`
for navigation. Unavailable datasets and blocks are absent from that projection.
The projection is provisional and cannot be exported or printed. Authorization
or transport failure removes it; the terminal result replaces it.

Use the existing runtime with declared navigation and explicit pending state:

```jsx
<ReportRuntime
  reportSpec={snapshot.reportSpec}
  reportFill={snapshot.reportFill}
  sectionNavigation={snapshot.sections}
  selectedSectionId={selectedSectionId}
  onSectionChange={setSelectedSectionId}
  sectionLoading={selectedSectionId !== snapshot.sectionId}
/>
```

Changing tabs only changes the local selection. Pending tabs display the shared
loading state and retain the existing tab keyboard/focus behavior. They never
render missing payloads as successful empty data. When the full result arrives,
remove `sectionNavigation` and `sectionLoading`, retaining the selected ID.
Ambiguous ownership graphs use complete execution without a snapshot.

The section materializer/engine tests verify comparison and trend dependencies,
shared reads, first-section ordering, complete-result parity and denied release.
The stored-runtime and empty-chart component tests cover pending navigation,
local tab changes, stale callbacks, terminal failure and unavailable datasets.
