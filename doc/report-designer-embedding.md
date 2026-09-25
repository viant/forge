# Reusable report designer

`ReportDesigner` exposes the same Forge Design workspace used by dashboard Report Builder windows. Dashboard windows use the default host adapter. The controlled entry point supplies a native report document and explicit host callbacks; it does not read or write browser storage, call a report tool, or advance a revision.

```jsx
import ReportDesigner from 'forge/report-designer';

<ReportDesigner
  report={nativeReportDocument}
  datasets={declaredFieldCatalog}
  expectedRevision={revision}
  sourceProviders={providers}
  onChange={(candidate, change) => retainDraft(candidate)}
  onPreview={({ report, signal }) => previewOnServer(report, signal)}
  onSave={({ report, expectedRevision, signal }) => saveWithRevision(report, expectedRevision, signal)}
/>
```

`report` is the native `reportDocument` object. The designer keeps unrelated document fields, datasets, source declarations, and unsupported blocks when editing supported content. No callback runs for an unchanged visual session. A missing change callback makes the workspace read-only. The host can also set `readOnly`, pass `capabilities.blockKinds` to limit available block kinds, or disable the built-in source manager with `capabilities.sourceManager: false`.

`onChange` receives a candidate native document and a change descriptor. It never means “saved.” The host should retain the candidate until it accepts or discards it. If `report` changes while an edit dialog or candidate draft is open, the designer retains the draft and offers an explicit choice to keep it or load the newer host document. Loading the newer document resets open edit dialogs.

`onPreview`, `onRun`, and `onSave` receive `{report, expectedRevision, signal}`. The host returns a typed state: `result`, `partial`, `error`, `conflict`, `denied`, or `unavailable`. A preview or run result may contain `reportSpec`, `reportFill`, and `reportDocument`, which Forge renders with `ReportRuntime`. The host owns authorization checks, server requests, revision compare-and-swap, audit identity, publishing, and export. The designer aborts an outstanding callback on cancellation, a newer request, or unmount. A partial preview is labelled as partial.

A source provider has an ID and `discover`, `describe`, and `validate` methods. Discovery may return a result with partial, denied, or unavailable status; one failing provider does not hide results from another. Discovery returns `{id, version, display, status}` records. Describe returns the same exact identity plus typed fields, result contract, query inputs, and display metadata. Validate returns `{valid: true, dataset}` or a denied, unavailable, or error result. A dataset declaration must carry `id`, `dataSourceRef`, `source: {id, version, serviceRef, toolRef}`, `resultContract`, and `columns`. Forge checks those identities and leaves credentials and execution to the host. If a validated dataset already exists, the designer asks before replacing its pinned declaration. Seeing a source in discovery does not authorize its execution; the host must recheck on preview, run, and export.

The API is available from `forge/report-designer` with TypeScript declarations, and as `ReportDesigner` from `forge/components`. `ReportBlockDesigner` and `ReportRuntime` remain exported. A document without a primary builder block may still use the declared field catalog for authored blocks; unsupported nodes remain visible and read-only. The host should retain source text and comments outside this native document subtree and skip rewriting that text when no change was emitted.
