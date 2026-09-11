# Web primitive and mobile pairing audit

> Historical findings below have now been addressed by the [native widget backfill](native-widget-backfill.md). Keep this audit as the before-state and use that document for current implementation and validation scope.

Scope: Forge source in this checkout, including prior uncommitted reporting work.
This pass analyzes implementation; it does not modify runtime behavior.

## Verdict

All **22 catalog primitives** have web, iOS, and Android model/renderer paths.
They are **structurally paired, not behaviorally equivalent**. The Blueprint pack
also registers **31 named control widgets**; many lack equivalent native item
renderers. Primitive coverage must not be used as evidence of control-widget or
end-to-end feature parity.

`paired` below means a concrete implementation exists and this pass did not
identify a specific critical divergence in that row. It is not a release verdict.
`partial` means a concrete behavior gap was identified. No row implies complete
live datasource, authentication, accessibility, or device-layout verification.

## Actionable findings

1. **P1 — iOS standalone primitive state is not subscribed.**
   `ContainerRenderer.observesPrimitiveState` excludes `draftForm`,
   `resourceHeader`, `editableCollection`, `statusWorkflow`, and `historyDiff`.
   Their shared renderer consumes `visibilityForm`, `visibilitySelection`, and
   related state, but subscription functions return early unless a different
   observed primitive happens to be present. Standalone forms/actions can operate
   with empty or stale state. See [ContainerRenderer.swift](../ios/Sources/ForgeIOSUI/ContainerRenderer.swift#L209)
   and [the subscription guard](../ios/Sources/ForgeIOSUI/ContainerRenderer.swift#L340).

2. **P1 — Mutation/callback payload keys differ.**
   Web draft submit supplies `extras.data`; both native renderers supply
   `extras.draft`. Web reset callback supplies `values`; native supplies `form`.
   Web resource-header actions supply `record`; native supplies `resource`.
   A shared descriptor selecting `extras.data.name` or `extras.record.id` therefore
   does not receive the same input. This can fail validation/marshalling or produce
   missing writer arguments; writers remain authoritative.
   Sources: [web draft](../src/components/primitives/DraftForm.jsx),
   [web header](../src/components/primitives/ResourceHeader.jsx),
   [iOS actions](../ios/Sources/ForgeIOSUI/WorkflowPresentationPrimitives.swift),
   [Android actions](../android/sdk/src/main/java/com/viant/forgeandroid/ui/WorkflowPresentationPrimitives.kt).

3. **P1 — Resource-header mutation buttons omit `action.disabledWhen`.**
   Web passes the computed condition to `MutationCommand.disabled`. Native
   implementations apply it to handler buttons but omit it from the mutation
   branch, despite both native command buttons supporting an external-disabled
   argument. This is a UI dispatch-contract mismatch, not a claim that backend
   authorization can be bypassed. See the same resource-header sources above.

4. **P1 — Control types are not paired; password metadata is one concrete case.**
   Web registers a password input. The native ordinary-item switches lack a secure
   password branch: iOS falls back to its display label, Android to an unmasked
   text field. Other explicit types such as `switch`, `percentFraction2Input`,
   `dateRangePreset`, and `keyValuePairs` also lack equivalent dispatch.
   Sources: [web widgets](../src/packs/blueprint/index.jsx),
   [iOS item dispatch](../ios/Sources/ForgeIOSUI/MenuListRenderer.swift#L147),
   [Android item dispatch](../android/sdk/src/main/java/com/viant/forgeandroid/ui/FormRenderer.kt#L362).

5. **P2 — Draft baseline/reset/save lifecycle differs.**
   Web captures the form baseline, respects `formStatus.dirty`, and updates the
   baseline after successful submission. Native uses the selected row as baseline
   and does not attach a submit-settled callback to update it. New records without
   selection can start dirty, reset to an empty baseline, or remain dirty after
   successful save. This remains a gap even when state subscription is corrected.

6. **P2 — Per-primitive datasource selection is conflated.**
   Web primitives resolve their own `spec.dataSourceRef`. Native shared presentation
   rendering receives one context; queryToolbar/draftForm/resourceHeader/historyDiff
   are not independently observed/resolved there. Even the native visibility
   context resolver chooses only one reference for a composed container.
   Sources: [iOS context selection](../ios/Sources/ForgeIOSUI/ContainerRenderer.swift#L194),
   [Android context selection](../android/sdk/src/main/java/com/viant/forgeandroid/ui/ContainerRenderer.kt#L634),
   [web toolbar](../src/components/primitives/QueryToolbar.jsx).

7. **P2 — `stableTabs` is only partially lowered on mobile.**
   Native adapters copy the default selected tab and appearance into ordinary tabs.
   The renderers do not consume the primitive's stable-ID persistence, visited/all-panel
   mounting, and permission-pruning contract. Web derives a mount policy directly
   from those fields. iOS uses a local selected index, which also differs from
   stable identity when child order changes.
   Sources: [web lowering](../src/components/Container.jsx#L207),
   [iOS lowering](../ios/Sources/ForgeIOSUI/ContainerRenderer.swift#L601),
   [Android lowering](../android/sdk/src/main/java/com/viant/forgeandroid/ui/ContainerRenderer.kt#L393),
   [iOS tabs](../ios/Sources/ForgeIOSUI/TabsRenderer.swift),
   [Android tabs](../android/sdk/src/main/java/com/viant/forgeandroid/ui/TabsRenderer.kt).

8. **P2 — Generic numeric item edits have different value types.**
   The web numeric adapter writes a numeric value. iOS's number item uses the text
   binding and writes `.string`; Android generic numeric inputs likewise write
   text. Typed schema/resource-model coercion may compensate in some flows, but
   ordinary item signals and callbacks are not equivalent.
   See [iOS editable text](../ios/Sources/ForgeIOSUI/MenuListRenderer.swift#L393)
   and [Android fallback input](../android/sdk/src/main/java/com/viant/forgeandroid/ui/FormRenderer.kt#L592).

## Catalog pairing

| Primitive | iOS | Android | Assessment |
|---|---|---|---|
| `editableCollection` | [partial](../ios/Sources/ForgeIOSUI/WorkflowPresentationPrimitives.swift) | [paired](../android/sdk/src/main/java/com/viant/forgeandroid/ui/WorkflowPresentationPrimitives.kt) | iOS standalone selection/form observation gap; native action UI differs. |
| `assignmentPicker` | [paired](../ios/Sources/ForgeIOSUI/AssignmentPickerRenderer.swift) | [paired](../android/sdk/src/main/java/com/viant/forgeandroid/ui/AssignmentPickerRenderer.kt) | Dedicated native dual-list renderers; live writer/readback parity still needs host proof. |
| `mutationCommand` | [paired](../ios/Sources/ForgeIOSUI/WorkflowPresentationPrimitives.swift) | [paired](../android/sdk/src/main/java/com/viant/forgeandroid/ui/WorkflowPresentationPrimitives.kt) | Shared executor implementations and targeted lifecycle/guard tests exist. |
| `statusWorkflow` | [partial](../ios/Sources/ForgeIOSUI/WorkflowPresentationPrimitives.swift) | [paired](../android/sdk/src/main/java/com/viant/forgeandroid/ui/WorkflowPresentationPrimitives.kt) | iOS standalone state subscription gap can affect current state and transitions. |
| `treeEditor` | [paired](../ios/Sources/ForgeIOSUI/TreeEditorRenderer.swift) | [paired](../android/sdk/src/main/java/com/viant/forgeandroid/ui/TreeEditorRenderer.kt) | Dedicated renderers and shared hierarchy/selection model behavior. |
| `wizard` | [paired](../ios/Sources/ForgeIOSUI/WorkflowWizardRenderer.swift) | [paired](../android/sdk/src/main/java/com/viant/forgeandroid/ui/WorkflowWizardRenderer.kt) | Dedicated step/validation/submit renderers; device focus/mount parity unproven. |
| `uploadCollection` | [paired](../ios/Sources/ForgeIOSUI/UploadCollectionRenderer.swift) | [paired](../android/sdk/src/main/java/com/viant/forgeandroid/ui/UploadCollectionRenderer.kt) | Dedicated upload validation and byte/MCP-blob paths. |
| `derivedDataSource` | [paired](../ios/Sources/ForgeIOSUI/DerivedDataSourceRenderer.swift) | [paired](../android/sdk/src/main/java/com/viant/forgeandroid/ui/DerivedDataSourceRenderer.kt) | Dedicated bounded pipeline runtimes; targeted native model tests exist. |
| `permissionBoundary` | [paired](../ios/Sources/ForgeIOSUI/ContainerRenderer.swift) | [paired](../android/sdk/src/main/java/com/viant/forgeandroid/ui/ContainerRenderer.kt) | Fail-closed boundary logic exists; host capability contracts remain authoritative. |
| `responsiveDataGrid` | [paired](../ios/Sources/ForgeIOSUI/ContainerRenderer.swift) | [paired](../android/sdk/src/main/java/com/viant/forgeandroid/ui/ContainerRenderer.kt) | Breakpoint metadata lowers into native tables; visual sticky/card parity is not established. |
| `historyDiff` | [partial](../ios/Sources/ForgeIOSUI/WorkflowPresentationPrimitives.swift) | [partial](../android/sdk/src/main/java/com/viant/forgeandroid/ui/WorkflowPresentationPrimitives.kt) | Nested diff/redaction models exist; per-primitive datasource context is not independently resolved. |
| `scheduleEditor` | [paired](../ios/Sources/ForgeIOSUI/ScheduleEditorRenderer.swift) | [paired](../android/sdk/src/main/java/com/viant/forgeandroid/ui/ScheduleEditorRenderer.kt) | Dedicated editors with timezone/range/overlap validation paths. |
| `draftForm` | [partial](../ios/Sources/ForgeIOSUI/WorkflowPresentationPrimitives.swift) | [partial](../android/sdk/src/main/java/com/viant/forgeandroid/ui/WorkflowPresentationPrimitives.kt) | Payload keys, baseline lifecycle, and source context diverge; iOS also lacks standalone observation. |
| `queryToolbar` | [partial](../ios/Sources/ForgeIOSUI/WorkflowPresentationPrimitives.swift) | [partial](../android/sdk/src/main/java/com/viant/forgeandroid/ui/WorkflowPresentationPrimitives.kt) | Items render through native forms; spec.dataSourceRef and web TableToolbar semantics are not equivalent. |
| `stableTabs` | [partial](../ios/Sources/ForgeIOSUI/TabsRenderer.swift) | [partial](../android/sdk/src/main/java/com/viant/forgeandroid/ui/TabsRenderer.kt) | Adapter copies default selection/appearance; full persistence/mount-policy/pruning contract is not implemented. |
| `resourceHeader` | [partial](../ios/Sources/ForgeIOSUI/WorkflowPresentationPrimitives.swift) | [partial](../android/sdk/src/main/java/com/viant/forgeandroid/ui/WorkflowPresentationPrimitives.kt) | Payload uses resource instead of record; mutation disabledWhen omitted; source-context gaps. |
| `dataStateBoundary` | [paired](../ios/Sources/ForgeIOSUI/ContainerRenderer.swift) | [paired](../android/sdk/src/main/java/com/viant/forgeandroid/ui/ContainerRenderer.kt) | Dedicated loaded/empty/error/stale branches and model tests. |
| `relationDrill` | [paired](../ios/Sources/ForgeIOSUI/WorkflowPresentationPrimitives.swift) | [paired](../android/sdk/src/main/java/com/viant/forgeandroid/ui/WorkflowPresentationPrimitives.kt) | Native relation actions and source-context paths exist; live host actions need proof. |
| `notificationRules` | [paired](../ios/Sources/ForgeIOSUI/WorkflowPresentationPrimitives.swift) | [paired](../android/sdk/src/main/java/com/viant/forgeandroid/ui/WorkflowPresentationPrimitives.kt) | Native visibility/action/disabled handling exists; composite context limitations still apply. |
| `metricSummary` | [paired](../ios/Sources/ForgeIOSUI/WorkflowPresentationPrimitives.swift) | [paired](../android/sdk/src/main/java/com/viant/forgeandroid/ui/WorkflowPresentationPrimitives.kt) | Native metric/comparison rendering and dedicated datasource selection exist. |
| `detailView` | [paired](../ios/Sources/ForgeIOSUI/WorkflowPresentationPrimitives.swift) | [paired](../android/sdk/src/main/java/com/viant/forgeandroid/ui/WorkflowPresentationPrimitives.kt) | Native fields/sections/source selection exist; device formatting/layout proof remains. |
| `masterDetail` | [paired](../ios/Sources/ForgeIOSUI/MasterDetailRenderer.swift) | [paired](../android/sdk/src/main/java/com/viant/forgeandroid/ui/MasterDetailRenderer.kt) | Dedicated native master/detail and identity/binding models. |

## Control-widget pairing

This table concerns ordinary item dispatch. Schema-generated forms can lower some
widgets differently; those alternatives are identified rather than counted as
universal coverage. Native lookup/file-browser/editor/terminal capabilities exist
separately and are not proof that the same web widget descriptor works.

| Web widget | iOS item path | Android item path |
|---|---|---|
| `text` | direct | direct |
| `password` | no secure item editor | no masked item editor |
| `file` | separate uploadCollection primitive only | separate uploadCollection primitive only |
| `object` | schema-form JSON editor; ordinary item fallback | JSON item branch |
| `number` | string-backed editor | string-backed generic editor |
| `textarea` | direct | direct |
| `schema` | schema-form JSON editor; ordinary item fallback | JSON item branch |
| `checkbox` | direct | direct |
| `toggle` | direct | direct |
| `switch` | fallback label | fallback text |
| `booleanPill` | schema boolean lowering only | schema toggle lowering only |
| `chipList` | no dedicated same-key widget | no dedicated same-key widget |
| `select` | direct | direct |
| `multiSelect` | direct | direct |
| `link` | direct | no dedicated FormItemRenderer link branch |
| `currency` | fallback label | generic text; no currency contract |
| `mediaPreview` | no dedicated same-key widget | no dedicated same-key widget |
| `percentFraction2Input` | no dedicated same-key widget | no dedicated same-key widget |
| `dateRange` | schema-form date-range only | direct date-range branch |
| `dateRangePreset` | no dedicated same-key widget | no dedicated same-key widget |
| `radio` | option-group path | direct |
| `treeMultiSelect` | no same-key widget; treeEditor/tree lookup alternative | no same-key widget; treeEditor/tree lookup alternative |
| `progressBar` | no dedicated same-key widget | no dedicated same-key widget |
| `button` | no dedicated same-key widget | no dedicated same-key widget |
| `label` | direct | direct |
| `math` | no same-key widget | generic text fallback |
| `keyValuePairs` | no dedicated same-key widget | no dedicated same-key widget |
| `markdown` | direct | direct |
| `document` | no dedicated same-key widget | no dedicated same-key widget |
| `date` | no dedicated item date widget | no dedicated item date widget |
| `datetime` | no dedicated item datetime widget | no dedicated item datetime widget |

## Registry and wider Forge scope

Web widget registration is dynamic and last-registration-wins. Native container
extensions use a separate protocol/registry and reject duplicate kinds. These are
platform-specific extension APIs, not interchangeable widget packs. Unknown web
widgets default to a basic input; native items may default to display labels or
text editors. That fallback must not count as support.

Both native clients have dedicated table, chart, tree/file browser, schema form,
editor, terminal, dialog, and report renderers. Feature-by-feature parity for those
larger containers remains separate from the 22 primitives. Reporting gaps are
tracked in [reporting-platform-parity.md](reporting-platform-parity.md).

## Repair order and acceptance evidence

1. Align primitive payload keys and external-disabled gating; fix iOS observation.
2. Give every primitive its declared datasource context and correct draft baseline lifecycle.
3. Add one platform-neutral widget classifier and typed value contract, starting
   with password, numeric/currency/percent, dates, and boolean aliases.
4. Implement stable-tab state and mounting semantics, including permission changes.
5. Run the same event fixtures on all platforms: initial hydration, value edit,
   reset, successful save, failed save, changed selection, disabled mutation,
   tab reorder/remount, and per-primitive datasource overrides.
6. Add native UI tests for actual controls/accessibility and host writer/readback
   tests. Model decoding and a successful build cannot prove these behaviors.

## Validation

Existing targeted suites were executed for this analysis. Their results are
recorded below. They prove their exercised model/executor paths, not the missing
cross-platform event sequences identified above.

- Web workflow gate: passed, including Go metadata round-trip, command executor,
  workflow models/rendering, upload bytes, timezone validation, and production build.
- iOS selected workflow suite: 18 tests passed.
- Android selected primitive/command/schema/form/container/tab suites: 39 tests passed.

No primitive/control implementation was changed during this analysis. The only
new files are this report and its machine-readable pairing inventory.
