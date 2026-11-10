# Canonical authoring schemas for Go

`Resolve("forge:report-spec")` and `Resolve("forge:window")` return independent
JSON Schema maps from the linked Forge version. They perform no remote lookup.
These are the same schema documents used by Forge's report and window editors;
this package adds no validator or policy layer.

After changing canonical report schema sources or regenerating the canonical
window editor schema, run `go generate ./backend/authoring/schema` with the
repository's JavaScript dependencies installed. Check drift with
`node backend/authoring/schema/generate.mjs --check`.

Window schema provenance remains in the exported document. Use the existing
`scripts/verify-window-editor-canonical.sh` workflow to regenerate its source.
Report kind-specific unions and constraints remain intact. Consumers should
resolve only explicitly requested schemas during their existing definition
preparation, not inject the full schemas into every prompt. Provider support for
JSON Schema dialects and constraints varies; schema export does not guarantee
that every provider accepts every canonical constraint.

`Compact(reference)` parses, indexes and serializes each canonical schema once
per process. Its immutable string is safe to reuse across templates and reloads.
`Resolve` returns a deep copy for consumers needing a mutable schema map.

`Select(reference, pointer)` accepts an RFC 6901 pointer and returns compact
selected constraints with all transitively referenced canonical definitions.
The response retains `schemaRef`, the canonical source `fingerprint`, `pointer`,
and `complete` (false for fragments). Repeated selections reuse serialized
bytes; the finite canonical pointer index bounds memoization. Missing pointers
and external references fail with `ErrSelection`; there is no network loader.
For example, `forge:report-spec` plus `/$defs/kpiBlock` retrieves the KPI contract
and its dependencies without unrelated report blocks. Canonical validation
remains with the existing Forge editors and report/window owners.
