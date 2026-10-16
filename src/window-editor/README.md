# Public Forge window YAML editor

Standalone demo: `npm run dev:window-editor`, then open http://127.0.0.1:5187/window-editor-preview.html.

Build static portable demo: `npm run build:window-editor`. Serve `dist-window-editor/` with any static server and open `window-editor-preview.html`. No Forge backend, AI Studio, authentication provider, or business services are required.

```jsx
import { WindowYamlEditor } from 'forge/window-editor';

<WindowYamlEditor value={yamlSource} onChange={setYamlSource} />
```

For embedding, give the parent a definite height (for example `height: 600px`). The editor sizes and scrolls within that container. `headingLevel` (default 2) controls the title and descendant headings. `showHeader={false}` omits the title/header landmark while keeping the editing toolbar. `subtitle` is configurable; an empty string hides it. Multiple instances have unique control IDs and the inspector uses a named section.

`value`/`onChange` expose the YAML source, including invalid drafts. `defaultValue` supports uncontrolled usage. `defaultMode` defaults to `tree`; `yaml` opens CodeMirror. `schema` can supply an extended model. The export includes its scoped stylesheet. Primitive fields use their model type; objects/arrays navigate to nested inspectors. Long strings use multiline controls. Add chooses any available model property, appends sequence items in order, or adds typed entries to dictionaries. Custom attributes are explicitly available everywhere.

The target tree supports plain windows and `window.bundle`/`window.references` envelopes. Bundle groups follow each authored target binding and resolve its variant, including phone/tablet and additional platforms/form factors. Full bundle metadata and unbound variants remain navigable under the document root. A plain window shows shared-source Desktop/iOS/Android phone/tablet views; these are navigation views of the same authored source, not generated variants. Target conditions, overrides, and bindings remain authored data. The editor does not simulate rendering or infer target-specific overrides.

YAML mutations use the `yaml` document/CST representation. Unknown attributes, array ordering, comments, quoted scalar styles, anchors, and external JS/CSS references are retained. Detected source indentation is retained and scalar folding is disabled on tree edits; byte-identical source is retained until an edit. Aliases and their anchored descendants carry a Shared source badge, with an inspector warning and Go to anchor navigation before edits. An edit through an alias changes its shared anchor. Repeated target bindings to one variant are likewise visibly shared. YAML diagnostics retain the last valid tree and disable tree mutations until source recovery. Undo/redo spans tree and source edits. This is an authoring editor, not a backend semantic validator or executing preview.

## Host lifecycle

`readOnly` defaults to `false`. When true, the editor disables attribute/add/remove mutations, undo/redo and CodeMirror editing. Tree expansion/selection, nested inspector navigation, YAML viewing/copying and explicit local draft discard remain available. Controlled `value` updates still display the host's current source without emitting `onChange`. Existing drafts survive a switch to read-only.

`onStateChange(state)` optionally reports the initial state and meaningful state transitions:

```ts
{
  validSource: boolean;       // YAML mapping parses successfully
  pendingEdits: number;       // all unapplied drafts, including active/hidden fields
  readOnly: boolean;
  canCommit: boolean;
  canonicalStatus: 'notRequired' | 'loading' | 'ready' | 'error';
  errors: readonly string[];
}
```

The immutable state object is stable while those values are unchanged; replacing callback identity does not repeat an unchanged notification. `onChange` remains the raw-source callback. An active attribute draft immediately makes `canCommit=false`, even when its pending banner is intentionally hidden during typing. Commit, restored original text, or explicit Discard clear the corresponding pending count; mode/navigation changes retain it.

`canCommit` requires write access, valid YAML, zero unapplied drafts and, for bundles, a ready canonicalizer with valid current fingerprints/dependencies. Loading/adapter/validation errors block it. Bundle validation for this state contract runs only when a state listener is provided. Hosts should use `canCommit` to guard Save and inspect `pendingEdits`/`validSource` when deciding Close/discard behavior; backend revision validation and authorization remain required. A read-only revision always reports `canCommit=false`.

## Canonical schema

`forgeWindowSchema.json` is generated from Forge's canonical authored Go AST model, including embedded bindings, map/array types, recursive definitions, named scalar types, and imported public protocol resource/primitive structs. Interfaces and custom attributes intentionally remain extensible. JSON-only transport fields are used where a type has no YAML tags; explicitly `yaml:"-"` fields are excluded. Existing SchemaBasedForm is coupled to runtime datasource context and does not cover all recursively nested map/array model values, so this portable inspector uses the generated schema directly. Source editing uses the established CodeMirror libraries.

Regenerate and verify using a checkout containing the committed public protocol revision:

```sh
# From the isolated Forge checkout. The argument is read-only.
sh scripts/verify-window-editor-canonical.sh --generate
npm run test:window-editor
sh scripts/verify-window-editor-canonical.sh
```

The generator uses archived committed Forge `backend/types`, `backend/window/contract`, and `backend/datasource/contract`. It records source revision and SHA-256 provenance. Unknown/custom attributes remain extensible and are preserved in YAML. No Studio model or Agently Core checkout is required.

The verification script exports sources read-only, uses a temporary module file, compares the generated JSON byte-for-byte, runs the real Forge backend tests, and validates initial and edited demo YAML with `WindowResourceEnvelope.Validate`. The base checkout's pinned protocol versions predate two model types, so this isolated compatibility step is required; no Go module pins or original checkouts are changed.

## Canonical bundle edits

Plain windows need no runtime assets. Bundle editing lazily loads static `window-editor/wasm_exec.js` (16,992 bytes) and `canonical.wasm` (5,199,636 bytes uncompressed) from the host's asset directory. `canonicalAssetsURL` can configure that directory. Serve these files alongside the package (the standalone production build copies them automatically). They require WebAssembly, Web Crypto, and CSP permission for the script and WASM compilation. Loading errors disable bundle tree mutations while YAML remains available. The assets invoke the existing canonical Go fingerprint and backend validation functions; they do not call services or execute window assets.

A host may supply a synchronous `canonicalizer(yamlText)` instead, returning `{ keys: { oldVariant: fingerprint }, dependencies: { oldVariant: { datasourceID: fingerprint } } }`. This receives precise YAML bytes, not a JavaScript JSON approximation, and must use the same canonical backend model and validation. Supplying it avoids WASM loading. The model functions accept the same hook as `options.canonicalizer`; direct bundle model callers must load the runtime first or supply the hook.

Valid tree edits update descriptor dependencies, variant keys, and target references through the YAML CST, retaining comments, anchors, unknown attributes, indentation and order. Selection, expansion and pending draft ownership follow the new variant key. An edit that would merge distinct variants is rejected with an explicit message so comments/extensions cannot be silently discarded. Invalid complete bundle edits retain the committed source and show an actionable error. YAML mode intentionally permits incomplete/invalid drafts; hosts must gate saving on their validation requirements.

## Verification

`npm run test:window-editor` verifies typed/model paths, embedded/imported schema coverage, extension preservation, references, comments, anchors/aliases, array ordering/insertion/removal, bundle target paths, and invalid-source parsing/recovery. `npm run build:window-editor` verifies the standalone production build. Browser interaction verification is recorded in `doc/public-window-editor-review.md`; screenshots are in the local worktree's `output/window-editor/` directory.


Tree keyboard controls use a single roving tab stop: Up/Down move focus, Right expands or enters children, Left collapses or returns to a parent, Home/End reach the first/last visible node, and Enter/Space selects. Nested inspector navigation reveals its selected tree path. Unapplied attribute drafts are owned by YAML path, retained across inspector/mode changes, and shown with explicit Review/Discard actions; invalid numeric values never silently replace committed YAML.
# Source authoring

Bundle YAML defaults to a readable assembled `window` and named `dataSources`
projection. Applying a datasource edit invokes the Go compiler to regenerate its
runtime service/bindings before updating fingerprints. The complete original
document is retained as a CST sidecar, including other targets, comments, aliases
and unknown extensions. An unchanged projection returns byte-identical source.
`yamlDocumentMode="runtime"` is available for explicit technical inspection.
Normal tree/inspector navigation starts at the Desktop window; runtime document
and target-binding metadata are behind **Technical metadata**.

Compiled bundles cannot recover original source filenames or `$import`
directives. For file-oriented authoring, pass `sourceManifest`,
`compileSourceManifest` and `onSourceManifestChange`. The editor shows the named
YAML/JS files verbatim and emits a complete compiled definition through `onChange`.
The host must retain the manifest alongside that definition, not derive files
from runtime bytes. A string `definition` preserves exact JSON numeric lexemes.

The server-side compiler is Forge `backend/window/source.CompileWindowSource`. It invokes Forge's confined native source loader in a private temporary workspace: `$import` and named `actionRefs` are resolved on the server, and runtime `actions.code` is produced by that loader.
No browser script-resource fetching protocol is introduced. Hosts own normal
authoring authorization and persistence; this compiler performs no data calls.
