# Shared client validation and native field attributes

`forge/validation` exports `validateResource`, `validateFieldRules` and
`formatResourceTime`. They run locally in JavaScript, with no HTTP call, Go
runtime, WASM, generated executable code or global validation cache. Resource
model read/write validation imports this same implementation. Existing model
hooks remain the place for cross-field, custom and business validation.

```js
import {validateResource} from 'forge/validation';
const schema = {
  type: 'object',
  properties: {
    title: {type: 'string', validation: {
      checks: [{name: 'required'}, {name: 'le', parameters: ['64']}],
    }},
  },
};
const errors = validateResource({title: 'Example'}, schema);
```

The existing canonical schema vocabulary remains supported: `required`,
`nullable`, numeric `minimum`/`maximum`, typed `enum`, string `minLength`/
`maxLength`, array bounds and nested shapes. String length now counts Unicode
code points, matching Go's rune count, rather than UTF-16 code units. Combining
marks count separately; this is not a grapheme or visible-character count.
Legacy `required` lists retain their previous behavior: missing, null and empty
string fail, while zero and false remain valid.

Optional field `validation` carries normalized govalidator checks. Supported
names are `required`, `le`, `ge`, `lt`, `gt`, `choice`, and `domain`. Bound
parameters are safe integer strings; bounds compare Unicode length for strings,
length for arrays, and numeric value for finite numbers. `choice` supports
strings and safe integers without coercing values between types. Existing
schema `enum` supports typed JSON values. Unsupported names, malformed bounds
and empty choices produce diagnostics, rather than passing silently. Omit
unsupported checks from the browser subset only when an explicit frontend model
hook owns their validation; do not advertise them as supported checks.

The `domain` check intentionally follows govalidator v0.3.3's lowercase,
unanchored pattern. It can match a domain substring inside a larger value and
is not a URL parser or a stricter whole-string hostname policy. Such policies
remain explicit hooks. The synthetic shared corpus tests these distinctions.

`validation.pointer` selects native pointer-required semantics: non-null values
pass `required`, including empty string, false and zero. For scalar fields those
zero values fail the normalized `required` check. Missing scalar fields use the
Go zero value; a missing pointer retains nil semantics. `validation.omitEmpty`
skips native checks for nil/null/empty string, including a pointer to empty
string. A missing scalar is replaced by its Go zero value before this decision. Scalar zero/false and non-null numeric pointers to zero are not omitted.
`validation.presenceOnly` explicitly opts into marker semantics: absent own
properties skip checks; present values, including null/zero/false, are checked.
This flag is independent of `nullable`, and never weakens a legacy required list.
Unknown checks still diagnose when a value is omitted. JavaScript undefined is
not transported as an explicit JSON value; use omitted properties for absence.

## Native preparation helper

Go package `backend/types/attributes` exposes
`ResourceFieldSchemaFromTags(reflect.StructField, presenceOnly)`. It reuses
published `govalidator.ParseTag` v0.3.3 and tagly `format.Parse` at preparation
or compilation time. It exports normalized checks, pointer/marker/omitempty
metadata and scalar type information. It preserves unknown checks for explicit
client diagnostics. Callers retain ownership of JSON names, schema composition,
resource models, dependencies and producer authorization. The adapter supports
scalar string, boolean and numeric tags; time.Time is format-only, and aggregate
Go types or native time validation require explicit caller schema/hook handling. This opt-in helper
does not infer a full application schema or replace native producer validation.
The `types` metadata structs and editor schema carry the fields without importing
the Go parser libraries into a browser or canonical WASM.

## Time formatting scope

A field schema may retain normalized `timeFormat` metadata with `timeLayout`,
`timeZone`, `nullable` and `omitEmpty`. The native helper converts tagly
`dateFormat` into Go `timeLayout` and preserves the `tz`/`timezone` alias. The
existing `formatDisplayValue` utility accepts this metadata in its options:

```js
formatDisplayValue(instant, 'raw', 'en-US', {
  timeFormat: {timeLayout: '2006-01-02 15:04:05', timeZone: 'UTC'},
});
```

`formatResourceTime` uses Intl timezone data with an explicit instant (`Date`,
epoch milliseconds, or an offset-bearing ISO string). Supported exact layouts
are `2006-01-02`, `2006-01-02 15:04`, `2006-01-02 15:04:05`, and
`2006-01-02T15:04:05Z07:00`. The last is also the default. It preserves an input
ISO offset when no presentation zone is supplied; Date/numeric input defaults
to UTC. Null becomes `"null"` when nullable and empty text otherwise. An omitted
empty string produces empty text. Unsupported layouts, sub-millisecond input
precision, years outside 0100–9999 and sub-minute historical timezone offsets
require an explicit formatting hook. Other existing display formats are
unchanged when no timeFormat option is supplied.

There is no new date parser. Tagly `Tag.ParseTime` uses `TimeLayout` and does not
apply its presentation timezone. It also has lenient fallbacks that this bounded
formatter does not reproduce. Wall-clock text is rejected here: mapping a local
clock to an instant, ambiguous or missing DST hours, and application-specific
date policies remain explicit caller responsibilities. Native/JS fixtures cover
formatting across spring/fall DST changes and prove that native parsing ignores
the presentation zone. They do not qualify arbitrary timezone conversion logic.

Run `node --no-warnings src/validation/validation.test.js` and
`GOWORK=off go test ./backend/types/attributes ./backend/types` for the shared
independently authored corpus and native metadata checks. Existing resource model
and display formatter tests cover compatibility. This capability can replace
repeated supported field checks and instant-display formatting in window code;
it does not establish removal of any entire application's validation module.

## Declarative draft form binding

Bind a frontend draft schema to a `draftForm` to validate before Save becomes
available, without writing a window handler:

```yaml
schemas:
  editorDraft:
    type: object
    required: [title, enabled]
    properties:
      title: {type: string, minLength: 1, maxLength: 64}
      enabled: {type: boolean}
view:
  content:
    id: editor
    draftForm:
      validation: {schemaRef: editorDraft}
      submit: {dataSourceRef: recordPatch}
```

The existing DraftForm reads its current form and uses the shared local
`validateResource` implementation with `context.metadata.schemas`. Basic errors
feed its existing validation message and disabled Save state. Missing/empty
references and non-object schemas fail closed; native authored-window validation
also rejects missing references. The same typed binding is available on the
embedded `parameterEditor.draft` contract.

When `validate` is also supplied, the existing synchronous caller hook runs only
after the schema checks pass, so it can retain cross-field or business checks.
When `validation` is absent, the legacy hook/availability path is unchanged.
No payload model is inferred or prepared, no datasource fetch occurs for
validation, and no lifecycle/reset policy changes. The schema describes the
frontend draft, including UI-only state when appropriate; it need not match a
writer's wire payload. Ordinary extra fields remain allowed unless
`additionalProperties: false` is authored. Choose `required` lists for their
legacy zero/false semantics, or explicit normalized `validation` checks for the
native scalar/pointer/marker semantics described above.
