# Authored report materializer

This Core Go module embeds Forge's official report builder, ReportDocument lowerer, and ReportFill/ReportPrint materializers. Core owns the runtime pipeline; Forge owns the concrete report formats and official rendering algorithms. `Lower(ctx, raw)` consumes the exact `registry.ReportEnvelope` bytes approved by a resource resolver and returns a canonical ReportSpec. It runs a fresh Goja VM per call and executes only the compiled, embedded bundle. Builder hook names, formula strings, and arbitrary metadata scripts remain data. Runtime needs neither Node nor the Forge source tree.

Schema version 1 authored envelopes require a complete matching builder, document, state, trusted datasource descriptor map and complete dependency fingerprints. The materializer checks exact builder/descriptor bytes, duplicate JSON fields, the output datasource closure, size limits and context cancellation; execution has a five second bound. The consuming host must still authorize the selected resource, run its ReportSpec compiler, apply datasource admission, and recheck the pinned resource before releasing output. This helper does not grant execution permission or synthesize authenticated request parameters.

Install pinned build-time Intl polyfills with `npm ci --ignore-scripts` in this module. The bundle contains official FormatJS NumberFormat/DateTimeFormat with English locale and timezone data; it imports the pure signal and SVG-path primitives rather than browser components. With the canonical Forge checkout alongside Core, build the trusted bundle from this module with `node scripts/build.mjs`; verify official parity with `node js/entry.test.mjs`. The bundle is committed build input. Metadata input cannot replace it. The ten Steward fixtures contain declarative definitions and typed datasource schemas, with no rows or credentials.

`GOWORK=off go test -race ./...` verifies all ten migrated Steward envelopes, changed builder/descriptor rejection, duplicate fields and bounded VM interruption. Core adds its own real compiler, pin and authority regression tests. Goja is pinned to the verified published module version in go.mod. The optional Forge module and Core local replacement require publication/version pins before independent remote consumers can build this integration.

`Materialize(ctx, spec, executedDatasets)` consumes server-executed dataset
payloads and calls the official fill and print functions. The consuming Core
service buffers every result, preserves the exact resource lease, and validates
all datasource descriptors and arguments before dispatch. Builder-published
logical dataset aliases remain distinct from physical datasource descriptors;
both closures are preserved. The calculated-field and formatting expression
interpreters are the official restricted parsers, with no JavaScript eval or
metadata script execution.
