# Shared resource filesystem

`ResourceFS` is an opt-in, scope-bound definition loader shared by native Studio,
Agently, and previews. It contains no permission engine and makes no business-data
calls. A host creates one instance per authenticated provider/namespace scope,
shares it through `SettingProvider.services.resourceFS`, and replaces it on account
changes. `SettingProvider` starts preloading before windows mount.

`createMCPResourceFS` adapts the host's existing authenticated `resources/read`
function. It concurrently reads `resource-archive://<namespace>/datasources` and
`resource-archive://<namespace>/dialogs`. HTTP compression is handled by the
transport. No additional REST endpoint or giant window bundle is introduced.

Archive v1 contains `namespace`, `kind`, `catalogRevision`, `complete: true`, and
`entries` with `uri`, `revision`, `definitionText` (exact JSON text), and SHA-256
`contentFingerprint`. An index is installed atomically only after a complete,
valid snapshot. Each definition is cached separately. `read` returns a detached
object; `readFile` returns the original text. Relative paths resolve against the
containing resource directory without escaping the namespace root.

`loadWindow` accepts YAML or an object and preserves authored `resources` links.
It waits for archive kinds actually referenced by that window, not unrelated
archive kinds or business-data queries. Local datasource bindings override fetched
configuration. The optional host `prepareDataSource` callback adapts transport
configuration, without executing the datasource. Inline existing dialogs win.
Missing entries and failed archives produce warnings, not a window-load failure.
`WindowContent` displays those warnings while retaining the remaining content.

Hosts call `invalidate()` on catalog refresh/relevant notifications. Invalidating
an in-flight snapshot prevents its later publication. A missing entry in a complete
snapshot does not trigger individual-read retries. A failed preload remains failed
until explicit invalidation; no polling/retry loop is created.

This adapter must not be installed on a first-load critical path until archive
production meets its latency budget or preload has already completed. The initial
live archive producer still performs too many per-resource reads; CPU indexing
benchmarks do not establish end-to-end archive readiness.

For binary archives, pass `archiveFormat: 'tar.gz'` to `createMCPResourceFS`.
The same standard reads use `/datasources.tar.gz` and `/dialogs.tar.gz` and return
MCP blob content with `application/gzip`. POSIX tar contains `manifest.json` and
regular files at `resources/<contentFingerprint>.json`. Manifest entries carry
`path` instead of `definitionText`; multiple resource identities may share one
content-addressed path. The decoder never extracts files to disk. It rejects
unsafe paths, links, duplicates, truncated blocks, checksum failures and orphan
entries, then reuses the existing per-definition fingerprint check and cache.

### Additional definition kinds

`preloadKinds` selects the archives a provider actually supports. It defaults to
`['datasource', 'dialog']`; it can also include `window`, `report`, `lookup`, and
`style`. Each kind uses its own `resource-archive://<namespace>/<plural>.tar.gz`
resource and the same scoped revision index. Unsupported provider kinds should
be omitted from preload configuration. `read(uri, {revision})` resolves an exact
stamp; without a revision it uses the publisher's `selected: true` entry.
These archives contain definitions, never report result rows or mutation output.

### Scoped styles

`compileResourceCSS(definition, {providerIdentity, namespace, uri})` compiles a
style resource into its provider/namespace boundary, including owned portals.
The shared parser isolates animation, font, registered-property and layer names.
It rejects unsupported global rules before installation.

A host rendering an admitted shared base can pass `scopeSelector` for its own
workspace boundary. This is trusted host wiring, never a selector copied from
an authored definition. Omitting it preserves namespace confinement. The host
owns stylesheet order and removal; the compiler neither fetches resources nor
makes access decisions. A trusted host can set `global: true` for its one configured global stylesheet;
this preserves document-root selectors while retaining symbol isolation. Never
copy that option from authored definition data. Other resource consumers retain
namespace confinement by default.

`prepareResourceStyle` returns the compiled CSS, normalized token values, and an
`installFonts` function for embedded WOFF2 faces. It reuses the shared bounded
font decoder and validates before installation. Resource-scoped faces receive
private family names; a global owner preserves its declared workspace families.
A scoped preview of that same global owner can request `sharedFonts: true`. Call the returned cleanup when replacing or removing a sheet;
it removes only that sheet's faces. Warm consumers retain prepared sheets and
faces until publication changes, rather than installing fonts per window.
