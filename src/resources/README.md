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
