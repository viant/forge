# Metadata workspace widgets

A complex React interaction can be a Forge widget. Its portable window declares
field bindings, data sources, actions and events; the host installs authenticated
resource loading, operation transport, navigation and download capabilities.
The widget must not import a consumer application's API client or accept a token
or arbitrary provider URL from window metadata.

## Mount a portable window

```jsx
import {ResourceWindow} from 'forge/resource-window';

<ResourceWindow
  uri="window://studio/reader-workbench"
  parameters={{report, namespaceId}}
  hostServices={{hostWindow: {
    loadResource: uri => resourceReader.read(uri),
    executeResource: (metadata, request) => transport.execute(metadata, request),
  }}}
  onDirtyChange={setNavigationGuard}
  onNavigate={navigate}
/>
```

`loadResource` returns a format-3 envelope with target bindings, window variants
and their datasource definitions. Datasource requests are admitted by the host.
The window gives nested resource instances separate contexts. Dirty children and
open metadata dialogs keep the aggregate navigation guard set until all scopes
are released. `disabled` protects controls while the host acquires its edit scope.

## Reader workbench

`readerWorkbench` supplies graph, SQL, input/output, preview and publication
interactions. Each semantic API method maps to a declared datasource and DTO.
It performs no eager command calls while constructing these bindings.

```yaml
readerWorkbench:
  dataSourceRef: editor_context
  reportField: report
  namespaceField: namespaceId
  resourceNamespace: studio
  operations:
    updateComponent:
      dataSourceRef: component_update
      mutation: true
      parameters:
        id: {arg: 0}
        input: {arg: 1}
  lookups:
    definition:
      dataSourceRef: version_inspect
      parameters:
        reportId: {arg: 0}
        versionNo: {arg: 1}
  onBack: actions.back
```

`arg` is a zero-based positional argument index. `selector` selects an argument
field; `default` supplies missing values without replacing `false` or `0`.
`spreadArg` merges an argument object into the request. `responseSelector` extracts
an operation payload. Mark writers `mutation: true` so shared dialogs cannot be
dismissed while a mutation is pending. Commands still require server authorization
and expected revision checks.

## Policy and gate editors

`resourcePolicyEditor` binds a selected resource to `get`, `context`, `create`,
`replace` and `check` datasources. Static `actionsByKind` is the action contract;
`actionsByKindField` optionally resolves a host-supplied contract from the bound
form. Likewise `choicesField` supports a fallback choice directory. Authoritative
provider context controls manage access and supersedes fallback choices. No
unknown resource kind receives an invented action contract.

`gateRequirementsEditor` binds resource, action and selected preview entities to
declared operations. Gate attestations must match the request/resource/action,
revision and validity bounds before they can be used.

## Other reusable interactions

- `parameterEditor`: metadata fields, conditional sections and read-only guards.
- `predicateCompositionEditor`: Boolean stages, per-group operators and protected
  group IDs. `onSave` and `onGroupSave` delegate revisioned writes to the window.
- `resultPreview`: nested table and JSON views of a bound payload.
- `workspaceSummary`: collection lists, actions, statuses and readable dates;
  optional `titleField`/`descriptionField` read a bound state datasource.
- `table.presentation: catalog`: full-width management tables with ordinary row
  actions and conditional column visibility.
- `hostContent`: an explicitly installed named extension slot. A missing optional
  host slot does not download or import consumer code.
- `previewWorkbench`: same-origin preview frames with metadata controls, viewport
  widths and review checklists.

Go window compilation preserves these specs in `backend/types`. Add compile
round-trip coverage when extending a spec and rendered coverage for behavior.
Consumer applications should test real format-3 resources with WindowContent;
mocked DTO tests alone do not prove that the declared data sources are mounted.

### Layout ownership

Datasource-only container branches remain mounted without reserving visual space.
Hidden branches also release their flex allocation, and the last visible child
receives the remaining space. Horizontal containers honor a child’s authored
`style.width`, while definite `style.height` values retain their own height in a
content-sized host. `editor.style.height: '100%'` fills the allocated editor pane.

Use `layout.labels.align: end` to align standalone actions with the bottom of
labeled controls. `workspaceSummary.appearance: empty` centers a compact empty
state in the available pane. Catalog table headers retain an opaque surface when
scrolling; `table.density: compact` provides a denser explorer presentation.
