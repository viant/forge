# Choice browser

`choiceBrowser` renders a controlled list from a datasource collection, a form
field, or a window-form field. Rows can navigate or toggle selection. The owning
`onAction` handler performs data loading, validation and state changes.

Configure identity, label, selectable, selected and secondary fields rather than
embedding domain logic. `selectionDisabledField` and `navigationDisabledField`
are separate: reaching a selection limit need not block browsing. `readOnlyWhen`
blocks selection while preserving navigation; `disabledWhen` blocks all actions.
`loadingWhen` hides stale rows and displays the loading message. An explicit
missing datasource never falls back to another form.

Paths contain strings or `{label, value, current, disabled}` objects. With
`maxPathItems`, long paths expose an accessible expansion control. `activatePath`
returns the path value and index without toggling selection.

| Operation | Additional payload |
| --- | --- |
| activateItem, toggleItem | record, id |
| activatePath | record, id, pathValue, pathIndex, details (for popup paths) |

`detailFields` describes labeled record values with standard Forge formats,
optional currency and null text. `detailPathField` supplies popup breadcrumbs.
Details open by pointer hover, focus or click, support Escape/close buttons, and
share one active record popup per window. Pointer departure has a 500 ms grace
period for entering the popup. The same generic details view is available on
`groupedSelection`; it emits `activatePath` with group/item identifiers.

All appearance is provided through named classes and existing Forge CSS tokens.
