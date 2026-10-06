# Native report preparation contract

This is an internal Swift/Kotlin runtime contract, not a new server endpoint or database record. The source of request semantics remains authored Forge metadata and the existing web publisher in `src/reporting/reportSpecModel.js`.

A prepared request consists of its immutable identity (`windowId`, selected `builderRef`, form revision, state revision), readiness (`pending`, `ready`, or `error`), selected datasource, primary request, and resolved initial scope bindings. The identity must still match immediately before each fetch, run begin, and materialization publication. Selecting another builder or changing the form invalidates it. A cancelled or failed hook cannot publish a partial request. In particular, an empty map while initialization is pending must never be interpreted as a global report.

Resolve builder, configuration, datasource, and variant state key together. Apply the authored initialization hook to the exact window form and configuration, then build the primary request from the resulting state and authored request hook. A declared hook that cannot be executed must report an actionable unsupported-binding error; silently using an unscoped base request is not a fallback. Declarative prefill binding is acceptable only where metadata defines the mapping. Do not inject order, campaign, account, or other business field names into the native runtime.

`requiredBindings` in the fixture represents resolved initial intent before dataset policy, not a permanent equality constraint against raw prefill. Explicit user edits and authored overrides produce a new preparation revision. A ready author-intended global request is valid; a scoped intent whose binding was lost is an error.

For each referenced published dataset, port the canonical publisher's exact semantics:

1. Retain the catalog request shape (measures, dimensions, limits, sorting). Inherit primary options, and primary filters/refinements only for the same datasource.
2. Resolve `scopeParamOptions` by declared IDs and paths. Dataset-local values take precedence over current state; missing values may fall back to the primary request. Date ranges use their declared start/end paths.
3. Remove explicitly excluded inherited bindings. For a date-range option this includes every declared `paramPath`, `startParamPath`, and `endParamPath`; unrelated scope remains.
4. Resolve authored local and relative-date patches. `inherit` applies inherited context to the catalog request. `append` applies local first, then inherited context. `override` and `exclude` apply inherited context first, then local/relative patches. Thus a declared local date replacement may intentionally follow exclusion.
5. Validate the resulting intended request and only then release the prepared generation for execution. Unsupported scope modes and invalid relative-date definitions fail closed. Scope policies are not implemented by simply merging two `filters` maps.

Typed native models must preserve `scopeParamOptions`, `scope`, `source`, `capabilities`, and `resultContract` through decode/encode/target resolution. Their absence after a typed round trip is not evidence the author chose an unscoped request.

For `ui.data.fetch`, an omitted reference means the currently active view's concrete datasource dependencies, never all registry entries. Exclude inactive/dialog/lookup definitions unless explicitly requested. Resolve and validate the entire plan before executing any target. A report-owned target, including an explicitly named target, must have a ready preparation for the current identity; otherwise return pending/error without fetching. Do not silently redirect to `ui.report.run`, because an existing execute-on-open intent may already be pending. Explicit nonreport fetches are not prohibited merely because `autoFetch` is false.

Diagnostics should identify builder, datasource, generation, binding path, and readiness/reason. Do not log authentication data or full user filter values. Both clients should retain the actual prepared request in their request-only test evidence so scope loss is demonstrable before a fresh business trial.

## Fixtures and reproduction

`published-requests.json` includes web-generated requests plus readiness/identity gates. `fetch-plans.json` covers bounded bridge target selection. Consumers must assert exact JSON request equality; do not compare only nonempty filters. Relative-time cases pin UTC and `2026-10-04T12:00:00Z`.

Generate using an installed Forge JavaScript dependency tree:

```sh
node --no-warnings scripts/generate-native-report-preparation-fixtures.mjs [reference-forge-root]
```

With no argument the generator uses this checkout. A sibling original Forge checkout can supply the canonical source and its installed dependencies without editing it. The generated fixture records semantic outputs, not local filesystem paths or credentials.
