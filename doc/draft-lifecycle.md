# Data-driven draft initialization

`DraftForm.lifecycle` opts the existing DraftForm into a fresh baseline per
opening and parent key. Existing persistent editors omit it and keep native
load/save synchronization. No domain defaults, role rules, payload validation,
or date/time policy are built into this feature.

```yaml
draftForm:
  lifecycle:
    openWhen: {source: windowForm, field: createOpen, equals: true}
    key: [{name: parentId, in: windowForm, location: parentId}]
    defaults:
      - {name: parentId, in: windowForm, location: parentId}
      - {name: name, default: ''}
      - {name: enabled, default: false}
      - {name: count, default: 0}
      - {name: optionalValue, default: null}
    source:
      dataSourceRef: parentDefaults
      parameters: [{name: id, in: windowForm, location: parentId}]
      defaults:
        - {name: currency, in: form, location: parentDefaults.currency, default: USD}
        - {name: count, in: form, location: parentDefaults.count, codec: {name: int}}
  validate: Host.validateDraft
  submit: {dataSourceRef: writer, prepare: Host.prepareWrite}
```

A different dialog can initialize entirely from its window/parent data:

```yaml
draftForm:
  lifecycle:
    key: [{name: teamId, in: windowForm, location: teamId}]
    defaults:
      - {name: teamId, in: windowForm, location: teamId}
      - {name: title, default: ''}
      - {name: limit, default: 0}
      - {name: tags, default: []}
```

These are independently authored generic examples. Declare each draft datasource
with `autoFetch: false` and `fetchData: false` on its container; lifecycle owns its
initial baseline. The optional source is a **separate read datasource**, mounted
by the normal window dependency collector. Its native selectors, transforms,
parameter codecs and authorization apply. The source uses the native `fetchCollection({result: "records"})` completion,
which snapshots normalized records; callers omitting `result` keep their existing
raw payload completion. One source response is mapped using
existing Parameter rows against that invocation's returned records; `form` maps
from the first record and `selection` obeys the source selection mode. Missing
rows/fields use explicit authored defaults. Business requirements for matching
identity or required context belong in source transforms or caller hooks.

The key uses existing Parameter rows and must include every parent identity
whose change should discard this draft. Changing the key starts a fresh baseline;
use an external parent selector when that behavior is desired. Defaults are
sampled on open/key change, not reapplied on every field edit. A mounted window
with no `openWhen` initializes on mount. For a retained dialog, bind `openWhen` to
its actual open state; unmount/close invalidates in-flight results. Reopening
starts fresh even with the same parent. Two instances require independently
scoped draft datasources, as with ordinary native forms.

For a parent selector that should refresh defaults **without resetting edits**,
keep the opening key stable and opt into a separate defaults context:

```yaml
source:
  dataSourceRef: parentDefaults
  watch: [{name: parentId, in: windowForm, location: selectedParentId}]
  when: {source: windowForm, field: selectedParentId, gt: 0}
  parameters: [{name: id, in: windowForm, location: selectedParentId}]
  defaults: [{name: currency, in: form, location: parentDefaults.currency}]
```

`source.watch` uses existing Parameter rows. A resolved-value change invalidates
pending defaults and reloads using the current source parameters, preserving
edits relative to the current baseline. `source.when` uses the existing predicate
contract. False invalidates pending defaults, makes no read, retains current
values/baseline, and shows Waiting for defaults context; submission waits until
the predicate becomes true and the new read succeeds. This is only a load guard,
not authorization. A caller may include its presentation readiness predicate;
the native source/backend still authorizes the read. Clearing a parent does not
implicitly clear fields: declare an opening key change when a fresh form is the
intended behavior. Both fields are optional. Without them, parameter value
changes alone do not refresh defaults or invalidate the current opening.

Source defaults merge recursively into the accepted baseline. Values differing
from that baseline remain edits, including removed properties, null, false,
zero, empty strings and empty arrays. Omitted/undefined fields do not overwrite;
null is explicit. Arrays are atomic. A field changed back to its baseline is
untouched for this comparison; this is value-based dirty tracking, not a touch
history. Reset accepts the latest default baseline and clears dirty state.
Canceling the existing discard confirmation retains edits. Closing the host
dialog follows the host's existing close/confirmation behavior; this feature
adds no independent modal or navigation guard.

Loading keeps fields editable and disables DraftForm submission until ready.
Failure keeps edits, shows the error and offers Retry; retry does not reseed.
Retry is also exposed through the native registered control action
`<container-id>:retry`. Old completions cannot modify a newer opening. The
existing reset/save controls, keyboard behavior and semantic status/alert roles
remain in use. The new retry button uses the same shared Button as those actions.

An optional `load: Host.prepareDefaults` runs after the declarative source. It
receives `{context, parameters, defaults, signal}`: parameters are the resolved
key, defaults include source values, and signal aborts on retry/close/reopen.
Return a defaults object (or a promise for one). Keep effects abort-aware and
return values instead of directly mutating draft signals. Use this only for
business-specific preparation; ordinary reads/mappings/defaults need no JS.
Existing `validate` and `submit.prepare` remain the validation and write hooks.
They are not bypassed by initialization, which grants no backend permission.

Validation:

- `node --no-warnings src/components/primitives/draftLifecycle.test.mjs`
- `npx vitest run --config vitest.runtime.config.mjs src/components/primitives/DraftForm.lifecycle.render.test.jsx`
- `go test ./backend/types ./backend/window/source`
- `sh scripts/verify-window-editor-canonical.sh`

The synthetic model/component/source tests cover independent windows, native
read selectors/codecs, parent changes, close/reopen/stale completions, failures
and retries, edit retention, reset/cancel and metadata preservation. They are
not browser business E2E or persistence qualification. Existing consumers are
not automatically migrated; application-specific authorization, identity
readback, uploads and time-zone rules need consumer review and E2E evidence.
