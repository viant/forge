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
