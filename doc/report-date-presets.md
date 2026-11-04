# Calendar-backed report date drafts

`useReportDatePresetDraft` from `forge/reporting` owns calendar loading, relative
preset resolution, cancellation, manual edits and reset for `ReportFilterBar`.
Hosts normalize each producer declaration with `normalizeReportDatePresets` and
pass ranges with `id`, `start`, `end`, and `datePresets`. Preserve normalization
errors as `datePresetError`; missing dates then block Apply with a visible error.

```jsx
const dates = useReportDatePresetDraft({
  ranges, parameters, resetParameters,
  contextKey: currentResourceAndSessionKey,
  loadCalendar: (id, inputs, signal) => loadDatasource(id, inputs, {signal}),
  onDefaultsReady: values => { commitInitialParameters(values); return values; },
});
<ReportFilterBar controls={dates.controls} values={dates.draft}
  onChange={(id, value) => {
    dates.editField(id);
    dates.writeDraft({...dates.draftRef.current, [id]: value});
  }}
  onDatePreset={dates.requestPreset} onDateRange={dates.manualRange}
  onDateDraft={dates.cancelDraftRequests} onReset={dates.reset}
  applyDisabled={dates.dateBlocked || otherRequiredInputsMissing}
  onApply={() => commit(dates.draft)} />
```

Keep the calendar loader stable until its authenticated/resource context changes.
Changing that loader or `contextKey` cancels outstanding responses and marks an
already resolved relative draft stale. The loader receives an AbortSignal; stale
responses are ignored even if the underlying transport cannot cancel them. This
is a UI lifecycle fence, not an authorization decision.

The loader returns `{data: [...]}` with exactly one matching identity and a valid
IANA timezone at the declaration's paths. The hook never falls back to UTC or the
browser timezone. Multiple defaults use one instant after all calendars arrive.
Explicit dates, including explicit blanks, suppress automatic defaults. Manual
edits and Reset cancel earlier requests; Reset resolves missing defaults as a
draft without automatically applying them.

`initialize` optionally preserves the host's existing non-calendar parameter
initialization. `onDefaultsReady` may return `false` or throw while other required
inputs are unresolved; change `defaultsReadyKey` when those domains become ready.
Return the committed parameter object to recognize its subsequent controlled
update. For user Apply, call `expectParameters(next)` before updating controlled
parameters. Neither callback executes a report unless the host elects to do so.

To persist the selected option alongside endpoints, declare an optional safe flat
alias, for example `datePresets.valueParameter: periodMode`. The hook writes that
parameter into its draft atomically with a successfully resolved named/default
range. Manual ranges and external absolute endpoints without a declared selected
option use `custom`, even when those endpoints equal a named range. Binding aliases
must differ from every range's endpoints, calendar identities and other bindings.
Caller objects are copied before augmentation. Without this property the existing
initialization, defaults and parameter shape are unchanged.

Hosts that copy only known input aliases must forward this declared parameter from
`dates.draft` with the date endpoints. Commit it through the same applied snapshot
used by execution and export; never consult an unapplied control value during export.
A producer may map the alias to a source option or ordinary report scope parameter.
The parameter supplies presentation/query semantics, never execution authority.

An externally supplied valid option plus explicit endpoints represents an applied
absolute snapshot. The option remains a presentation/source selector; the hook does
not replay its relative expression on a later context change. To refresh that named
range, request the preset again. Relative drafts resolved within this hook still
become stale on calendar/identity changes and block Apply as before. Hosts clearing
an optional range must clear its bound preset parameter with both endpoints.

## Canonical bound windows

A canonical `scope.params` entry of `kind: dateRange` may declare `datePresets`
using the declaration above. Its existing `filterBindings` still map `start` and
`end` into admitted dataset filters. `calendar.input.parameter` reads an existing
scope parameter. Optional `valueParameter` names a separately bound ordinary
scope parameter: a scalar text input or an option control admitting every declared
preset value, including `custom`. It cannot bind a numeric, multiple, or date input.
The calendar datasource must exist in the window registry with caching disabled.

`DashboardReportRuntime` renders these ranges through the shared `ReportFilterBar`
and `useReportDatePresetDraft`. It loads calendar metadata through the window's
ordinary authenticated `fetchRecords({parameters, signal})` handler. The shared
hook owns timezone resolution and stale-response cancellation. There is no
calendar lookup based on endpoint equality or browser timezone.

Selecting a named range, entering manual dates, resolving initial defaults, and
Reset change only the date draft. Apply filters commits all declared endpoints
and bound preset selections together, resets source paging, and fetches once per
affected datasource. An explicitly optional range can clear both endpoints; its
selection becomes `custom`. Incomplete required ranges block Apply. Reset restores
the authored baseline and resolves missing defaults without applying them.

Reports without `scopeParam.datePresets` retain the immediate bound-window control
path: each valid control edit updates its admitted request and refreshes through
the same datasource engine. Other controls in a mixed window keep this behavior.
A calendar identity edit cancels outstanding calendar work; an already resolved
relative draft becomes stale and must be selected again or replaced manually.

The report renderer and KPI `secondaryVisibleWhen` evaluate the applied request
snapshot, so dirty date selections cannot change comparisons or exports. Resource
exports and print use the completed run's captured scope and metric selections;
a newly applied run clears the previous result and disables output until completion.
`ReportRuntime.datePresets.render.test.jsx` mounts an independently invented real
window with the native datasource connector and a synthetic transport.

The declaration lives in the canonical report source, under either
`reportDocument.scope.params` (retained by document lowering) or the already
compiled `reportRuntime.reportSpec.scope.params`. For example:

```json
{
  "id": "period", "kind": "dateRange", "label": "Period", "required": true,
  "value": {"start": "2026-01-01", "end": "2026-01-07"},
  "filterBindings": [
    {"datasetRef": "primary", "path": "from", "valuePath": "start"},
    {"datasetRef": "primary", "path": "to", "valuePath": "end"}
  ],
  "datePresets": {
    "calendar": {
      "dataSourceRef": "calendar", "input": {"name": "ids", "parameter": "identity", "array": true},
      "identityField": "id", "timeZoneField": "zone"
    },
    "default": "completed", "valueParameter": "periodMode",
    "options": [
      {"value": "completed", "label": "Completed days", "range": {"kind": "relativeDays", "startOffset": -7, "endOffset": -1}},
      {"value": "custom", "label": "Custom"}
    ]
  }
}
```

`identity` is an existing scope input; `periodMode` is a separately bound scalar
text or compatible option scope input. The native window's `datasetBindings`
still declares the datasource and query path. This does not introduce a
`reportBuilder.predicates.datePresets` grammar or infer missing filter bindings.
Author the canonical scope declaration once; lowering retains it rather than
creating a second calendar policy.
