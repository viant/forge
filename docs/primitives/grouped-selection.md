# Grouped selection

`groupedSelection` is a controlled, data-driven container primitive for arranging
items into labeled groups and sections. It does not own persistence, validation,
transport, or application-specific inclusion/exclusion rules. Its `onAction`
handler applies an intent to the current model and publishes the updated form.

```yaml
id: choices
className: editor-choices
groupedSelection:
  scope: windowForm
  field: selectionDraft
  sections:
    - {id: primary, label: Primary, groupsField: primary}
    - {id: secondary, label: Secondary, groupsField: secondary}
  itemsField: items
  itemIdentityField: key
  itemLabelField: name
  itemDescriptionField: path
  readOnlyWhen: {source: windowForm, field: editingDisabled, equals: true}
  onAction: Editor.updateGroups
```

The model has section arrays containing groups with `id`, `label`, `collapsed`,
and `items`. `activeGroup` contains `{section, id}`. Selectors for these fields are
configurable in the Go/web metadata contract. Item descriptions accept a scalar
or an array of path labels. Explicit numeric zero identities and false options
are preserved.

`scope: windowForm` reads the owning window signal without requiring a datasource.
The default scope reads the form of `dataSourceRef` (or the container context).
An explicit missing datasource does not fall back to an unrelated form.

The action receives `context`, `operation`, and these identifiers:

| Operation | Payload |
| --- | --- |
| addGroup | sectionId |
| removeGroup, activateGroup | sectionId, groupId |
| collapseGroup | sectionId, groupId, collapsed |
| removeItem | sectionId, groupId, itemId |
| moveItem | sectionId, groupId, itemId, toSectionId, toGroupId, index |

Pointer drag/drop and keyboard-accessible group selection/reorder controls emit
`moveItem`. Drag payloads are scoped to one component instance; foreign or stale
items are rejected. Readonly guards are checked again at invocation. Readonly
users can activate and collapse groups, but cannot mutate their contents.

The host must enforce its business rules and server authorization. A handler is
required for actions; the primitive never writes a form or sends a request on its
own. Styling uses named classes and inherited Forge CSS tokens, with no authored
inline styles.
