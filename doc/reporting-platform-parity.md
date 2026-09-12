# Report builder and runtime platform parity

This is an implementation audit, not a claim that the native builders duplicate
all desktop features. The shared contract is the report document, effective
request values, runtime actions, and the Go PDF exporter. Phone layouts may differ.

## Verified and repaired in this pass

| Capability | Web | iOS | Android | Evidence |
|---|---|---|---|---|
| Semantic report options: defaults, type/value validation, labels, descriptions, reset | Supported | Supported | Supported | reportBuilderOptions tests; ReportBuilderOptionsTests/Test |
| Option persistence and request values | Supported | Supported | Supported | Native state/hook tests and web option tests |
| Header option placement | Section/composite headers with rail fallback | Metadata retained; controls in filter area | Metadata retained; controls in filter area | Web control/partition tests; native model round-trip tests |
| Composite ownership and nesting | Supported | Repaired | Repaired | Shared report-runtime-structure-conformance.v1.json |
| Missing/cyclic/duplicate composite references | Safe ownership resolution | Same contract | Same contract | Shared fixture executed in all three runtimes |
| Hidden composite descendants | Parent controls visibility | Nested rendering | Nested rendering | Web render regression; shared ownership contract |
| Authored report filter/selection state | Live | Live | Repaired: previously empty state | Runtime condition/action tests; Android signal wiring |
| Explicit tab default | Supported | Repaired | Repaired | Runtime renderer code and existing navigation tests |
| Tab selection through data refresh | Retained | Retained | Repaired | State keyed by window/report identity, not returned rows |
| Authored table collapse/defaultCollapsed | Supported | Added | Added | Native compilation and retained block metadata |
| Access to row actions after row six | Supported | Added progressive disclosure | Added progressive disclosure | Existing action execution tests; native rendering no longer truncates the action list |
| PDF rendering and option context | Shared Go | Shared Go | Shared Go | Go PDF tests compare web request values with mobile metadata; core export tests |
| Chart type normalization and bar orientation | Supported | Line default; grouped/stacked vertical and horizontal/funnel axes | Line default; grouped/stacked vertical and horizontal/funnel geometry | Native chart normalization and renderer tests |

Composite layouts stack on phones. This preserves ownership, data, and actions;
it does not reproduce desktop column widths.

## Open gaps: full platform equivalence is not established

| Area | Current difference | Required follow-up |
|---|---|---|
| Full document designer | Web has block authoring/reordering, calculated fields, themes, and document lifecycle tools that native builders do not mirror | Define and implement the native authoring surface or deliberately expose the shared web designer |
| Runtime field catalog hydration | Web has a dedicated dynamic field-catalog adapter; native builders primarily use decoded configuration | Add shared catalog-hydration contract fixtures and native adaptation |
| Runtime tables | Native action strips and incremental rows differ from the web table's integrated controls | Device-level sorting/filtering/paging and action reachability proofs |
| Rich presentation blocks | Native blocks may render simplified lists/cards instead of the web visual treatment | Per-kind device snapshots and interaction proofs, especially collection/kanban/timeline |
| Saved/shared report lifecycle | Shared backend exists, but native builder menus do not mirror every web authoring/lifecycle entry point | Host integration tests and native UX implementation |
| End-to-end device parity | Model/compiler tests do not prove touch layouts, VoiceOver/TalkBack, authentication, or live provider behavior | iOS/Android device automation using the same authored reports and backend fixtures |

## Regression entry points

- Web: `npm run test:reporting-parity`
- iOS: `swift test --package-path ios`
- Android: `./gradlew :sdk:testDebugUnitTest --tests '*Report*' --tests '*Dashboard*'` from `android`, with the Android SDK configured
- Shared PDF: `go test ./backend/reporting/export/pdf ./backend/reporting/fenced`
- agently-core: reporting PDF/fenced tests against the updated Forge dependency

The Swift test capture used by the full suite now uses an actor so the suite can
compile under the current concurrency checks; it no longer requires an isolated
subset solely to bypass that test compilation error.

## Local validation for this change

- Full iOS package: 305 tests passed.
- Android report/dashboard suites: 127 tests passed.
- Web parity entry point and production build passed.
- Shared Go PDF and fenced compilation suites passed during the PDF handoff change.

These results validate the exercised contracts. They do not close the open gaps
above or substitute for real-device interaction and layout tests.
