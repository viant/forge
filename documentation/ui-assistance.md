# UI metadata, context, reads and operations

Forge supplies a host-independent UI assistance contract. A host such as Agently
Core binds that contract to its current user, conversation and resource instance.
Forge does not import the host's chat client, model client or authorization store.

## Discover the definition

`backend/uimetadata.Project` projects a selected `types.Window` into a bounded,
paginated description of one window, its initialization parameters, nested tabs,
forms, controls, constraints and declared actions.
It can describe an unopened window. It does not open the window, execute authored
conditions, load dynamic options or fetch business data.

Use returned structural paths to traverse children. Static option previews have
an `options.path`; follow it to enumerate choices beyond the preview. Returned
option-leaf paths can also select individual choices. Truncated option text and
omitted non-scalar values are marked explicitly. Dynamic
options are explicitly unloaded. A declaration is not evidence that an action is
currently available. Each page must be bound by the host to the same selected
resource; changed definitions invalidate continuation cursors.

## Observe the current workspace

The existing UI snapshot includes optional `semanticContext` and
`operationRevision`. Semantic context describes selected nested tabs, selected
record identities, safe filters, ordering, pagination, dirty state, changed field
names and open dialogs. It is advisory context, not tool arguments or permission.
It excludes raw form contents and sensitive values.

`backend/uicontext.Project` validates and bounds that context on the server.
Hosts must scope it to the current conversation and exclude closed windows and
other conversations before adding it to a model request. A semantic-context
revision describes the observation; it is separate from the operation revision.

## Read mounted controls

Browser commands `ui.controls.list` and `ui.controls.get` observe controls that
the current renderers registered. They return current values, visibility,
disabled/read-only state, loaded choices, constraints and supported actions.
Reads use passive renderer state. They do not invoke change, focus, refresh or
save handlers, and do not fetch business data.

Read pages are bounded and can be truncated. Sensitive values must be redacted
before crossing the browser bridge and again at the host boundary.
`backend/uicontext.RedactReadJSON` provides the neutral server-side redactor.
Hosts should use metadata sensitivity as well as credential-key/value detection.

## Operate through normal UI handlers

Renderers register live actions with `registerControlActions`. An operation
resolves an unambiguous mounted target and rechecks its current state before
invoking the same handler used by the user interface. Controls can reject hidden,
disabled, read-only, unavailable or invalid operations. A declared metadata
action alone cannot authorize execution. Unsupported controls return an error;
there is no direct signal-write fallback.

Use a current control read's `operationRevision` as `expectedRevision` when
operating. A stale revision requires another read. The host supplies the verified
conversation and resource-instance binding; caller-provided resource selectors
can only constrain that binding.

Table selection uses known records. Refresh uses registered readers. Form saves
retain validation and confirmation behavior; a failed or indeterminate operation
must not be automatically repeated. Window close uses the normal dirty-close
flow, and awaiting confirmation is not reported as a completed close.

## Agently Core adapter

Agently Core exposes these capabilities as distinct tool surfaces:

- `ui/metadata:list|get` discovers selected definitions, including unopened ones.
- `ui/context:get` reads current workspace context.
- `ui/control:list|get` reads mounted control state on demand.
- `ui/control:setValue|click|focus` operates registered handlers. Focus uses the
  normal native focus handler and may trigger its authored lazy-option loading;
  it is an operation, not a passive read.
- Existing window and datasource tools provide navigation, tab selection,
  selection reads/changes and reader refresh through the corresponding UI paths.

Metadata uses the existing authorized selected-definition reader and does not
require a mounted window. Read and Operate admit the current chat/live window,
forward the host-held resource binding internally, and return public resource
identities for new control reads.
The workspace tool bundle must explicitly include each public method. Tool
discovery exclusions are separate from missing assets or browser warmup results.

The shared contract does not replace application E2E coverage. Verify actual
window handlers, conditional tabs, loaded options and confirmation flows in each
embedding host, and record unsupported controls as incomplete coverage.
