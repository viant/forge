# Forge Advanced Reporting / Report Builder — UX & Architecture Critique

*Scope: `ReportBuilder.jsx` (~17.8k lines), `reportBuilderComponents.jsx` (~3.3k lines),
`reportBuilderDocumentOutline.js`, `reportDocumentModel.js`, `reportFillModel.js`, plus
`advence-reporting/proposal.md` and phases 1–5.*

---

## 1. Executive Summary

The design docs get the **backend/data architecture** right: a clean pipeline
(`authoring artifacts → ReportSpec → ReportFill → ReportPrint/web render`) with explicit
ownership rules ("compile owns meaning, fill owns data, render owns geometry", "one reporting
brain"). That discipline is not the problem.

The problem is that this pipeline vocabulary — built for engineers reasoning about
service/ownership boundaries between Forge, `agently-core`, and Steward — has been copied
almost verbatim into the **end-user UI** instead of being translated into task language. "Scope,"
"projection," "semantic context," "refinement," "outline" are correct words for a compile-stage
data model. They are the wrong words for someone trying to build a report. This single category
error — architecture vocabulary standing in for product vocabulary, with no translation layer in
between — accounts for most of the recurring complaints.

It is compounded by a second, purely structural problem: `ReportBuilder.jsx` is a single
~17,800-line component with 50+ pieces of loosely-coordinated boolean/string state acting as an
ad hoc router. There is no explicit navigation model, so things that feel like they should be
"screens" (starter gallery → design → preview → report) are really just conditional renders keyed
off incidental state (`authoredBlockCount === 0`, `documentDataViewOpen`, `designWorkspaceFocus`).
Because there's no navigation *stack*, there's no way to go back — the "no way back to report
selection" complaint isn't a missing button, it's a missing concept.

Neither problem is solved by moving code into a new `forge-reporting` project (see §10). Both are
solvable inside Forge with (a) a deliberate copy/vocabulary layer and (b) decomposing the
monolith into components with an explicit navigation/state model. That is the recommended path.

---

## 2. What Is Structurally Wrong With The Current UX

1. **Starter selection is a one-way door.** The starter/template gallery (`renderTemplateChooser`)
   is rendered *only* when `authoredBlockCount === 0`. The instant a user adds one block, the
   gallery is gone for good. The only escape hatch is **"Reset report,"** which is destructive
   (clears back to blank) rather than a "go back and pick something else" action. There is no
   breadcrumb, no "change report" menu item, no non-destructive way back.

2. **Mode boundaries exist as a label, not as an experience.** `workspaceMode` ("design" /
   "preview" / "report") is a three-way toggle in the top toolbar with tooltip copy:
   - Design: "Compose authored blocks and shape the report."
   - Preview: "Run the current report and inspect the live result."
   - Report: "Review the report surface."

   "Run and inspect the live result" vs "review the report surface" is not a distinction a user
   can act on — it reads like two names for the same idea. Nothing in the surrounding chrome
   (layout, framing, color) changes between modes; only this one toggle's selected state does.

3. **"Report Tree" is mislabeled and structurally overloaded.** The panel literally headed
   "Report tree" mixes two different concepts as siblings: the document's own blocks, and
   **drill-hierarchy configuration nodes** (`drillHierarchy`, `drillPlaceholder` entries with
   action labels like "Edit drill" / "Add drill branch"). A tree of *content* and a tree of
   *navigation configuration* are not the same thing, but the UI presents them as one hierarchy.

4. **"Semantic Context" is unexplained internal plumbing surfaced as a panel.** It appears with
   the eyebrow "Semantic Context" and description "Scoped semantic fields for the currently
   selected report-tree item" — this is a description of an *implementation mechanism*
   (semantic binding resolution), not a task. A user has no way to know what decision they're
   supposed to make here or why it matters.

5. **Three near-identical "current X selection" labels mean three different things:**
   - "Data editor" / **"Current data selection"** — a modal for adjusting measures/breakdowns/drill
   - "Data editor" / **"Current builder selection"** / **"Current data"** — an inspector state for
     the primary builder
   - **"Data Sources"** — a separate section listing available sources

   These labels are similar enough to be interchangeable in a user's memory, but refer to
   different UI surfaces with different capabilities. This is a guaranteed source of "where do I
   go to do X" confusion — which matches the reported complaint almost exactly.

6. **Row/Chart/Detail actions are three independent headers, not one model.** The inspector shows
   separate "Row actions," "Chart actions," and "Detail actions" sections, each rendering
   differently-shaped data (`action.label` + `action.execution.kind` for rows/charts;
   `binding.actionLabel` / `binding.fieldLabel` / `binding.target` for detail). The design docs
   describe a single unifying abstraction — refinement kinds `keep | exclude | drill | detail` —
   but the UI does not present it as one coherent "what can I do with this data" surface; it
   presents it as three separately-designed lists that happen to sit near each other.

7. **Compiler/pipeline language leaks directly into help text**, e.g.: "Filter bar blocks
   **project** the current **shared scope parameters** into the **authored report contract**…"
   and "Refinement bar blocks expose the current drill and **keep/exclude trail**…" This is
   internal-model description, not user guidance.

---

## 3. Root Causes In The Current Architecture / UI Composition

- **One God component, one (implicit) IA.** Everything — starter chooser, canvas, inspector,
  filters, drill authoring, mode switching — lives in one `ReportBuilder.jsx`. Because there's a
  single flat state tree, there is no seam anywhere for a real navigation model to attach to.
  `focusDesignArea()` accepts targets like `"projection"`, `"measures"`, `"breakdowns"`,
  `"drill"`, `"runtime"` — these look like routes but are just scroll/focus nudges inside one
  conditional-render tree. No back stack, no history, no URL/state you could point a "back"
  button at, because there was never a first-class "current screen" concept to begin with.

- **No translation layer between the internal model and UI copy.** `reportDocumentModel.js`
  exposes fields like `staticFilters`, `paramIds`, `kind` directly; UI components hardcode labels
  next to where those fields are consumed (`"Shared scope parameters"` sits right beside
  `config.staticFilters` in `reportBuilderComponents.jsx`). There's no single vocabulary/copy
  module mapping internal identifiers → display strings, so every place a concept is shown risks
  drifting into a slightly different label (see the "current X selection" collision in §2.5).
  Renaming or refactoring the model has a direct, uncontrolled blast radius on user-facing copy.

- **Architecture-layer vocabulary was reused as product vocabulary.** The phase docs are
  explicit that "scope," "projection," "semantic context," and "refinement" are internal pipeline
  concepts meant to keep Forge/agently-core/Steward's responsibilities cleanly separated. Nothing
  in the docs asks for these words to appear in the UI — but they do, verbatim, because there was
  no deliberate translation step between "the model we compile" and "the words we show a report
  author."

- **The starter chooser is a side effect, not a state.** `authoredBlockCount === 0` is incidental
  data, not a navigation flag. Because "having chosen a starter" isn't tracked as an explicit
  state transition, there's nothing to reverse. This is the direct structural cause of complaint
  "no clear way back to report selection."

- **`reportDocumentModel.js` and `reportFillModel.js` overlap in shape** (`blocks`, `datasets`,
  `refinements` appear in both, with re-normalization logic repeated between them) without an
  enforced contract boundary in code. This is the same "two reporting brains" anti-pattern the
  design docs explicitly forbid at the backend level, showing up as a smaller-scale version at the
  *client model* level.

---

## 4. Concrete UX Smells Visible From The Current Forge Structure

| Smell | Evidence |
|---|---|
| Destructive-only "back" affordance | "Reset report" is the only way off a chosen starter once blocks exist; it discards rather than navigates back |
| Mode copy that doesn't differentiate | Preview: "Run the current report and inspect the live result" vs Report: "Review the report surface" |
| Tree mixing content and config | "Report tree" node list interleaves document blocks with drill-hierarchy/placeholder nodes |
| Unexplained internal concept surfaced as UI | "Semantic Context" panel description references "report-tree item" and "semantic fields" with no task framing |
| Near-duplicate labels, different meaning | "Current data selection" (data editor modal) vs "Current builder selection"/"Current data" (primary inspector) |
| Fragmented action model | "Row actions" / "Chart actions" / "Detail actions" rendered as three separately-shaped lists instead of one refinement model |
| Compiler jargon in end-user help text | "project the current shared scope parameters into the authored report contract"; "keep/exclude trail" |
| Unexplained one-off term | "Starter projection" appears with no supporting copy explaining what it configures |
| Inconsistent block naming | Block placeholder titled "Status Pills" but section header elsewhere just says "Pills" |
| Jargon-heavy drill copy | "Add drill branch," "Capture current path," "Remove drill branch" — implementation words, not task words |

---

## 5. Recommended Information Architecture / Mental Model

Replace the pipeline-shaped IA with a task-shaped one. A report author is doing four distinct
jobs; the UI should have exactly that many top-level places:

1. **Reports (home).** A persistent, always-reachable list of the user's reports and starters.
2. **Build.** One canvas of blocks + one consistent selected-block inspector.
3. **Filters.** Everything a viewer of this report can change.
4. **Preview/Publish.** What it looks like to a viewer, plus lifecycle state.

**Kill or fold in:**
- **"Semantic Context" as a standalone panel** — fold trust/governance signals onto field chips.
- **"Report tree"** — flatten to a simple block list or "outline".
- **"Data Sources" / "Data editor" / "Current data selection"** — one "Fields" affordance per
  block or report-level selection, not three parallel labels.

---

## 6. Recommended Interaction Model For Design vs Preview vs Report

Current: three co-equal toolbar tabs whose descriptions don't clearly differentiate two of them.
Recommended: **two modes, one status.**

- **Design** — visibly an editor: blocks, add/remove affordances, inspector, grid chrome.
- **View** (merge current "Preview" + "Report") — the same canonical compiled/filled result,
  rendered as a viewer would see it, with editing chrome removed.
- What is today "Preview" vs "Report" should become a **status badge** (Draft / Published),
  not a separate mode the user has to understand.

---

## 7. Naming / Terminology Recommendations

| Current | Replace with | Why |
|---|---|---|
| "Report tree" | "Report outline" or just "Blocks" | It's a content list users add to, not a technical tree |
| "Semantic Context" | remove as a screen; fold into field metadata | No standalone task happens there |
| "Scope" / "Shared scope parameters" | "Report filters" / "Block filters" | "Scope" is compiler language |
| "Projection" / "Starter projection" | remove from UI; if needed use "Suggested fields" | Users shouldn't reason in compile vocabulary |
| "Refinement" | "Focus", "Exclude", "See breakdown", "See details" | Internal kinds can stay `keep/exclude/drill/detail`; UI should use plain verbs |
| "Runtime" | remove from UI copy unless user-facing execution state truly matters | It's implementation language |

General rule: user-facing strings should come from a **single vocabulary/copy module**, not be
hardcoded next to internal model fields.

---

## 8. Recommended Near-Term Mitigations (small slices)

1. Add a non-destructive **"Change report"** entry point reachable after a starter is chosen.
2. Rename **"Report tree" → "Report outline"** or **"Blocks"**.
3. Remove/refold **"Semantic Context"** for scope/runtime-only nodes.
4. Unify the "current selection" copy across editor/inspector.
5. Sweep compiler jargon out of help text.
6. Keep "Reset report" but frame it as destructive, not navigational.

---

## 9. Recommended Medium-Term Redesign Direction

Decompose `ReportBuilder.jsx` into:

- **Shell/router** with explicit navigation state (`reports`, `design`, `view`)
- **Reports home**
- **Canvas / blocks list**
- **Selected block inspector**
- **Field/source picker**
- **Action/drill editor**

Also introduce:

- a single copy/vocabulary module
- a clearer model boundary between `reportDocumentModel.js` and `reportFillModel.js`

---

## 10. Assessment: Should Reporting Be Extracted Into forge-reporting?

**No — not yet.** Extraction now would be premature.

The current problems are primarily:

- information architecture problems
- component/state routing problems
- vocabulary/copy problems
- monolithic UI composition

They are **not** mainly caused by the current repository boundary between Forge,
`agently-core`, Steward, and the Agently app.

Extracting now would:

- freeze today’s confused UI shape into a public package boundary
- add packaging overhead while the product model is still changing
- slow down the exact iteration loop that is currently needed

Revisit extraction only once:

- the UI/navigation model is stabilized
- the contracts are clearly bounded
- there is a real second consumer for the reporting surface

---

## 11. If No, What Should Stay / What Could Move Later

**Stay in Forge now:**

- `ReportBuilder.jsx` logic, but split internally
- `reportDocumentModel.js`
- `reportFillModel.js`
- all reporting authoring/render UI
- a new vocabulary/copy layer

**Could move later, after stabilization:**

- stateless reporting contracts / schemas
- render-only reporting primitives
- reusable compile/fill helpers that no longer depend on the current dashboard shell

If a future `forge-reporting` project happens, it should contain **stable stateless reporting
contracts and rendering primitives**, not the still-evolving report-builder UX shell.

---

## 12. Recommended Implementation Sequence For The Next 3–5 Slices

1. **Starter/navigation fix**
   - add "Change report"
   - make starter selection reachable after first choice

2. **Naming and noise cleanup**
   - rename "Report tree"
   - suppress/remove "Semantic Context" scope noise
   - unify "current selection" naming

3. **Inspector unification**
   - one selected-block inspector
   - unify row/chart/detail actions into one conceptual action surface

4. **Mode simplification**
   - move toward Design vs View
   - turn Preview/Report distinction into status rather than separate modes

5. **Component extraction inside Forge**
   - split `ReportBuilder.jsx`
   - introduce explicit navigation state and vocabulary layer

---

## Bottom Line

The problem is not that Forge lacks a reporting architecture. The problem is that the UI is
currently exposing architecture concepts instead of product concepts, and a giant monolithic
component is forcing unrelated concerns into one unstable surface.

Do **not** solve that by extracting to `forge-reporting` yet.

First fix:

- navigation
- terminology
- mode clarity
- inspector structure
- component boundaries inside Forge

Then reevaluate extraction once the reporting product shape is stable.

---

## Claude Follow-up: Verification Priorities

*Based on the working tree as of 2026-07-01: `ReportBuilder.jsx` is 17,831 lines with a single
component body from line 1457 to 17831 (~16.4k lines, 116 `useState`, 145 `useCallback`, 357
`useMemo`, 50 `useEffect`); the test tree has 321 `tests/*.scenario.mjs` browser scenarios plus
116 `scripts/*.test.mjs` companion files, none of which run as part of the default `npm test`.*

### 1. The biggest verification risk: tests that pin today's copy/DOM, not today's behavior

The 321 `*.scenario.mjs` files drive a real browser (`../agently/ui/scripts/browser-proof-runner.mjs`)
against `window.__REPORT_BUILDER_PREVIEW__` and assert on **literal UI strings and DOM
structure** — `waitForDomContains: "Capacity Trend Block"`, `waitForDomContains: "Saved
exploration artifact: Report Builder Demo"`, `querySelector('.forge-report-builder__document-block-card
strong')`, exact `innerText` matches on rendered chip copy like `"Semantic binding: Ad Delivery •
Entity: Line Delivery"`. Across the scenario tree there are ~2,500 `querySelector`/`getAttribute`/
`clickRole`/`waitForDomContains` call sites and only ~28 total uses of a stable `data-testid`/
`data-report-builder-*` hook. Every §7 terminology change this doc recommends ("Report tree" →
"Report outline", killing "Semantic Context", unifying "current selection" copy) is a direct hit
against whichever scenarios happen to assert that exact string. That coupling — not the rename
itself — is almost certainly why past copy/structure edits produced "repeated UI regressions":
the regression signal fires on cosmetic text drift, indistinguishable from a real behavior break,
so the team either stops trusting the suite or stops touching copy.

Second-order problem, worse than the first: each `*.scenario.mjs` has a matching
`scripts/*-scenario-assets.test.mjs` (e.g. `report-builder-preview-authored-chart-save-reopen-scenario-assets.test.mjs`,
138 lines) that does not exercise the app at all — it `import`s the scenario module and asserts
that the scenario's own `steps[].expression` strings contain certain substrings (`assert.equal(
expressions.some(e => e.includes("applyAuthoredDocumentBlock API not available.") && ...)), true)`).
This is a test of the fixture, not of `ReportBuilder.jsx`. It inflates the file count and CI time
1:1 with the scenario count while adding no independent signal — if someone edits the scenario to
match a UI change, the assets test is trivially updated to match right along with it, and both
stay green whether or not the real app still behaves correctly. Treat these as fixture linting,
not regression coverage, when triaging "why did this break."

Third: the E2E scenarios are **not part of the safety net that runs by default**. `npm test`
(package.json:44) is a single `&&`-chained one-liner of ~90 `node file.test.js` unit-test
invocations; `test:report-builder-preview*` (package.json:23-31) is a separate family of scripts
that requires a live `vite` dev server on `127.0.0.1:5175` and a sibling checkout at
`../agently/ui/scripts/browser-proof-runner.mjs`. Nothing forces a contributor (or CI, without
explicit configuration) to run the 321-scenario suite before merging — it is exactly the layer
that would catch the God-component's cross-cutting regressions, and it's the layer most likely to
silently rot. Confirm what CI actually invokes; if it's only `npm test`, the scenario suite is
decorative today.

### 2. Next smallest high-signal verification slice

Don't try to fix the scenario suite wholesale — it's 321 files. Do this instead, in order:

1. **Pick one already-planned rename from §8/§12 (e.g. "Report tree" → "Report outline") as the
   pilot.** Before renaming anything in `ReportBuilder.jsx`, grep the `tests/*.scenario.mjs` tree
   for the literal strings that rename will touch (checked now: no scenario currently asserts
   `"Report tree"` or `"Semantic Context"` literally, so this specific pair is safe to rename with
   zero scenario fallout — a good first move to build confidence in the process before tackling a
   string that *is* widely asserted).
2. **Add `data-testid` (or a stable `data-report-builder-*` attribute already used sparingly
   today) to the handful of elements the pilot rename touches, and switch only those scenario
   assertions from `innerText`/`waitForDomContains` text match to the stable attribute**, before
   doing the rename. This makes the rename itself a no-op for those scenarios and gives you a
   template diff to point at when asking for the same treatment elsewhere.
3. **Wire `test:report-builder-preview:ci` into whatever CI actually gates merges**, even if only
   for the `semantic-left-rail` group first (it's already a named, smaller group in
   `run-report-builder-preview-scenarios.mjs`). A partial E2E gate that always runs beats a
   complete one that runs by hand.
4. **Delete or repurpose the `-scenario-assets.test.mjs` files for any scenario you touch as part
   of this slice.** If kept, narrow them to check structural invariants (step count, presence of
   a bootstrap/cleanup step) rather than re-asserting the same literal copy the scenario itself
   hardcodes — otherwise every future copy change has to satisfy three redundant copies of the
   same string (component, scenario, asset test).

This is deliberately narrow: one rename, a handful of selectors migrated to test IDs, one CI
group wired up. It's small enough to land in one PR and it directly de-risks every future
terminology change recommended elsewhere in this document.

### 3. God-component/router smell in `ReportBuilder.jsx`

Confirmed, and worse than "one big component" — it's one big **function body**. `export default
function ReportBuilder(...)` opens at `ReportBuilder.jsx:1457` and the file ends at line 17831;
there is no intermediate `return`/closing brace for ~16.4k lines. Concretely:

- **35+ `render*` closures are declared inside the component body** (`renderFilterCategoryControls`,
  `renderFiltersPanel`, `renderMeasuresPanel`, `renderBreakdownPanel`, `renderSemanticWorkspacePanel`,
  `renderAuthoredBlocksPanel`, `renderWorkspaceModeToggle`, `renderCompactHeader`,
  `renderCompactSetupSheet`, `renderCompactSemanticSheet`, `renderCompactChartSheet`,
  `renderDesignWorkspaceOverview`, `renderRuntimePreview`, `renderImportedRuntimePreview`, etc. —
  first cluster at lines 4002-6246, second cluster at 11499-14677). None of these are separate
  components; they're inline functions closing over the entire shared state tree, so **none of
  them can be unit-tested, memoized, or moved without dragging the whole state object with them.**
  This is the direct cause of the 145 `useCallback`/357 `useMemo` count — most of that memoization
  exists to avoid recomputing pieces of this one enormous render tree on every state change, not
  because the underlying values are individually expensive.
- **The router smell is real and lives at `ReportBuilder.jsx:12968-13066`.** `showTemplateChooser`
  is computed once (`shouldShowReportBuilderStarterChooser(...)` at line 12968) and used as a
  binary branch: `{showTemplateChooser ? renderTemplateChooser(...) : renderTemplateChooser({compact:true}) : ...}`
  at 13064-13066 — this is the entire "screen router" for the starter-chooser vs. design surface,
  implemented as one ternary over one derived boolean, not a navigation stack. It confirms §3 of
  this doc directly: there is exactly one seam (`showTemplateChooser`) doing the job a router
  would do, and it's a memoized boolean, not state that can be pushed/popped.

**Split recommendation, ordered by extraction safety (independent state first):**

1. **Extract the compact-mode render cluster first** (`renderCompactHeader`, `renderCompactSetupSheet`,
   `renderCompactSemanticSheet`, `renderCompactChartSheet`, `renderCompactBottomBar` —
   lines 5819-6246). These already read as a self-contained mobile shell; check what slice of the
   116 `useState` values they actually touch and pass those down as props rather than closing over
   everything. This is the safest first cut because compact mode is already behind its own
   `compactMode` flag, so a botched extraction fails loudly (compact UI breaks) without touching
   desktop behavior.
2. **Extract the starter-chooser branch (`renderTemplateChooser`, `shouldShowReportBuilderStarterChooser`,
   and the `showTemplateChooser` ternary at 12968-13066) into its own component that owns a real
   "have we chosen a starter" state**, not a derived `authoredBlockCount === 0` boolean. This is
   the component that should grow the "Change report" back-navigation this doc recommends in §8.1
   — building it as a real component with its own entry/exit is the same work as fixing the
   navigation bug, so do them together.
3. **Extract the filter/measure/breakdown panel cluster (4002-4669)** next — they're already
   grouped together and read/write a narrower slice of state (filters, measures, breakdowns) than
   the rest of the file.
4. **Leave the runtime-preview render cluster (11499-14677) for last.** It's the largest, most
   state-coupled cluster (export diagnostics, compile notices, semantic binding chips, drill
   summaries) and is exactly what the E2E scenarios exercise most heavily — extract it only after
   the test-ID migration in §2 above gives you scenarios that survive internal refactors, not just
   copy changes.

Do not attempt a single "split `ReportBuilder.jsx` into 6 components" PR. Given 116 `useState`
values with no reducer or context boundary, a big-bang split will either (a) thread all 116
values through new prop interfaces, which is a mechanical but massive diff with high regression
risk, or (b) get abandoned partway. Slice by render cluster, smallest/most-isolated first, and let
each extraction double as the state-model fix (real navigation state, not derived booleans) rather
than a pure code-move.

## Claude Follow-up: Row Action UX

*Scope: the row-level action pills ("Keep", "Exclude", "Drill to `<dimension>`", "Show `<detail>`
details") rendered per-row in `DashboardTableContent.jsx` and via `ReportBuilderRuntimeActionStrip.jsx`,
styled by `dashboardRowActionPresentation.js` + `Dashboard.css:401-618`.*

### 1. What is visually wrong

- **All four action kinds share the same shape and the same low-saturation gradient recipe.**
  `.forge-dashboard-row-action--keep/--exclude/--drill/--detail` (`Dashboard.css:560-618`) each set
  only a border-color and a 2-stop pastel gradient (`#f7fffa→#e8f7ef`, `#fff9fa→#fdecee`,
  `#f7fbff→#eaf1ff`, `#ffffff→#f4f8fb`) at near-identical lightness/saturation. At a glance the
  four kinds read as "the same pill in slightly different tints," not as a distinct
  affirm/reject/navigate/inspect vocabulary — this is the literal source of "dull."
- **They stack because the layout has no overflow strategy, not because of the color.**
  `.forge-dashboard-row-actions` is `display:inline-flex; flex-wrap:wrap` (`Dashboard.css:477-485`)
  inside a `<td class="forge-dashboard-table__actions-cell">` that is `width:1%; white-space:nowrap`
  (`Dashboard.css:376-380`) in a `table-layout:fixed` table (`Dashboard.css:308-314`). Once a row
  has 3-4 actions and one is a long `Drill to <dimension>` / `Show <detail> details` label, the
  flex row cannot fit on one line inside the column's fixed-layout width and wraps — producing the
  vertically stacked pill column the user is complaining about. This reproduces even in the default
  `rowActionDisplayMode="compact"` (`DashboardTableContent.jsx:52`) because compact mode only
  shrinks padding/font-size (`Dashboard.css:431-438`), it never changes the wrap behavior.
- **No hierarchy between primary (Keep/Exclude) and secondary (Drill/Show) actions.** All four
  render as equal-weight bordered pills with an icon chip + label, so a 4-action row has four
  competing focal points instead of one clear primary pair plus lighter-weight secondary actions.

### 2. Concrete implementation changes (existing Forge terms/CSS)

1. **Stop wrapping; make the strip horizontally scroll instead of stack.** In `Dashboard.css:477-485`,
   change `.forge-dashboard-row-actions` from `flex-wrap: wrap` to `flex-wrap: nowrap; overflow-x: auto;
   overscroll-behavior-x: contain;` (keep `justify-content: flex-end` for `--leading` variant only).
   Pair with a `mask-image`/`scrollbar-width: thin` treatment consistent with `.forge-dashboard-table-wrap`
   (`Dashboard.css:304-306`, already `overflow: auto`) so overflow reads as "scroll for more," not
   as a second row. This is the direct fix for "stacked pills" and touches only CSS, no component logic.
2. **Give Keep/Exclude a segmented-control treatment and demote Drill/Show to ghost buttons.**
   Reuse the existing `--keep`/`--exclude` modifier classes in `Dashboard.css:560-589` but raise
   contrast — solid `background: #1f8a52` / `#c22a4a` with white text on hover or active state,
   not just a lighter-tinted border — while for `--drill`/`--detail` (`Dashboard.css:590-618`) drop
   the border+gradient entirely and render as text-with-icon "ghost" buttons (`background: transparent`,
   `border: 1px solid transparent`, hover reveals `background: rgba(...,0.08)`). This is a same-file
   CSS change (no new classNames needed, `resolveDashboardRowActionPresentation` in
   `dashboardRowActionPresentation.js:78-118` already tags each button with a stable `--keep/--exclude/
   --drill/--detail` class) and immediately creates the primary-vs-secondary hierarchy called out above.
3. **Default dense rows to icon-only with tooltip, not compact-with-label.** `resolveDashboardRowActionVisibleLabel`
   (`dashboardRowActionPresentation.js:54-76`) already implements an `"icon"` display mode that hides
   the label and falls back to the `aria-label`/`title` for the tooltip — it's just never selected by
   default (`rowActionDisplayMode` defaults to `"compact"` at `DashboardTableContent.jsx:52`). For
   tables with 3+ row actions, switch the default (or add a container-config threshold) to `"icon"`
   so each action becomes a small round icon chip (`.forge-dashboard-row-action__icon`,
   `Dashboard.css:495-531`) with the label surfaced on hover — this is the single biggest
   information-density win available without touching the button markup, since the icon-chip
   styling is already implemented and only needs to be the common case instead of the label+icon pill.

### 3. Behavior risk to verify after the change

- **Icon-only default changes the accessible name path, not just the visible text.** Both
  `ReportBuilderRuntimeActionStrip.jsx:63-78` and `DashboardTableContent.jsx:243,257-259` already
  set `aria-label`/`title` and a visually-hidden `.forge-dashboard-row-action__sr-label` span
  independent of `visibleLabel`, so screen-reader/tooltip text should survive a default-mode switch
  to `"icon"` — but confirm with a real screen reader pass, not just reading the JSX, since two
  near-duplicate implementations (`ReportBuilderRuntimeActionStrip.jsx` and the inline renderer in
  `DashboardTableContent.jsx:214-264`) exist and could drift.
- **`overflow-x: auto` on the actions strip can eat scroll/click gestures on touch devices** where
  the table row itself may also want horizontal scroll (`.forge-dashboard-table-wrap` is already
  `overflow: auto`, `Dashboard.css:304-306`) — verify nested scroll containers don't fight each
  other on a narrow/mobile viewport, since this repo already ships iOS/Android capability work per
  recent commits (`15bdd5f`, `024b184`, `8885fbd`).
- **`resolveDashboardRowActionPresentation`/`resolveDashboardRowActionVisibleLabel` are covered by
  `dashboardRowActionPresentation.test.js`, `DashboardTableContentRowActions.test.mjs`, and
  `ReportBuilderRuntimeActionStrip.test.mjs`** — these likely assert on which CSS classes/display
  mode combinations are applied per action kind. Re-run them after changing the default
  `rowActionDisplayMode` or the wrap/scroll CSS, since a default-mode change is exactly the kind of
  change those tests exist to catch (and may need deliberate updates, not just a pass/fail check).
