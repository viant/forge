# Array field editor

`widget: arrayFields` edits an array owned by the current form. It does not fetch
or save data. The parent form retains its normal validation, reset and mutation
contract. Presentation uses `forge-array-fields*` CSS classes and tokens.

```yaml
id: ranges
widget: arrayFields
scope: form
dataField: ranges
properties:
  rowLabel: Range
  addLabel: Add range
  removeLabel: Remove range
  minRows: 1
  newRow: {id: null, start: null, end: null}
  rowReadOnlyWhen: {source: row, field: locked, equals: true}
  removeWhen: {source: row, field: removable, equals: true}
  fields:
    - {field: start, label: Start, type: date, properties: {valueMode: civil}}
    - {field: end, label: End, type: date, properties: {valueMode: civil}}
```

Fields reuse registered Forge input widgets. `readHandler` and `writeHandler` may
name registered source functions receiving `{value, row, field, context}` for
explicit display/storage conversion. The editor preserves unbound row fields.
`rowKey` defaults to `id`; unsaved rows without an ID use their position.
`minRows` limits removal; it does not silently manufacture stored rows.

The normal item `readOnlyWhen` guard applies to the whole editor. Per-field
`readOnlyWhen` and row `rowReadOnlyWhen` constrain editing; `removeWhen` constrains
removal. These are presentation rules, not producer authorization. Parent save
validation must enforce cross-row invariants. Timezones must be supplied or
converted explicitly; this widget does not infer an account timezone.

Widget properties pass through the existing Go `Item.Properties` metadata map;
`TestArrayFieldsWidgetRoundtrip` covers preservation of nested fields, conversion
handlers and row conditions. No application-specific fields are added to Forge.
