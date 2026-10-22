# Authored report materializer

This Forge Go package embeds the canonical report builder, ReportDocument lowerer, and ReportFill/ReportPrint materializers. The host owns the authorized execution pipeline; Forge owns the concrete report formats and rendering algorithms. `Lower(ctx, raw)` consumes the exact `registry.ReportEnvelope` bytes approved by a resource resolver and returns a canonical ReportSpec. It runs a fresh Goja VM per call and executes only the compiled, embedded bundle. Builder hook names, formula strings, and arbitrary metadata scripts remain data. Runtime needs neither Node nor the Forge source tree.

Schema version 1 authored envelopes require a complete matching builder, document, state, trusted datasource descriptor map and complete dependency fingerprints. The materializer checks exact builder/descriptor bytes, duplicate JSON fields, the output datasource closure, size limits and context cancellation; execution has a five second bound. The consuming host must still authorize the selected resource, run its ReportSpec compiler, apply datasource admission, and recheck the pinned resource before releasing output. This helper does not grant execution permission or synthesize authenticated request parameters.

Install the root UI dependencies using its lockfile, then run
`npm ci --ignore-scripts` in this package. Build with `npm run build` from this
package. The tracked entry adapter imports the canonical Forge builder, lowerer,
fill and print functions; it does not contain a second renderer. Build-only
FormatJS polyfills and esbuild are pinned by the package lock. Signals and icon
paths resolve to pure package entrypoints, without React rendering. No runtime
imports or external scripts remain in the embedded bundle.

Run `go test ./backend/reporting/materializer ./backend/reporting/engine` from
the repository root. The ten existing Steward fixtures compare ReportSpec,
ReportFill, and print output against retained goldens. A separate synthetic
comparison fixture proves previous-period authored lowering in the bundled Goja
runtime. Rebuilding twice must produce the same bundle SHA-256. The generated
bundle is committed build input; metadata input cannot replace it.

`GOWORK=off go test -race ./...` verifies all ten migrated Steward envelopes, changed builder/descriptor rejection, duplicate fields and bounded VM interruption. Core adds its own real compiler, pin and authority regression tests. Goja is pinned to the verified published module version in go.mod. Consumers must pin a published Forge revision containing the regenerated bundle; runtime builds do not require a local replacement.

`Materialize(ctx, spec, executedDatasets)` consumes server-executed dataset
payloads and calls the official fill and print functions. The consuming Core
service buffers every result, preserves the exact resource lease, and validates
all datasource descriptors and arguments before dispatch. Builder-published
logical dataset aliases remain distinct from physical datasource descriptors;
both closures are preserved. The calculated-field and formatting expression
interpreters are the official restricted parsers, with no JavaScript eval or
metadata script execution.
