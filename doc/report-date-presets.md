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
