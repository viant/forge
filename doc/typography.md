# Shared design-system foundation

Declared planar region maps use the shared `GeoGeometryMap` component with
semantic typography and Button region selectors. See [the geometry contract and
synthetic runnable example](geo-geometry.md) for Polygon/MultiPolygon shapes,
keyboard selection, missing-value states, and matching canonical print paths.
This opt-in map does not change the legacy world or US tile appearance.

Legacy report tile and world maps adapt their detail sidebar to the widget's
container width. A map placed in a narrow dashboard column stacks its selected
area and ranking below the map, even on a wide screen. Compact tile spacing also
follows the widget width; source values, labels and rankings remain unchanged.

The renderer supplies generic behavior, semantic hooks and neutral fallback
recipes. Workspaces supply palettes, font assets, reviewed values, business
content and variant selection. Customer styling never belongs in shared code.

## Foundation map

| Foundation | Existing contract and use |
| --- | --- |
| Colors | Core's surface, text, border, interaction, disabled, validation, status and data roles. Use meaning rather than a palette color name. |
| Typography | Complete portable roles below, including all five properties. HTML semantics remain independent. |
| Spacing | spacing.1 through spacing.6; component insets and gaps consume them. Breakpoints belong to the owning shared pattern. |
| Borders/radii | border.width, control.radius, radius.surface and radius.pill. Ordinary surfaces use quiet borders. |
| Elevation | Existing --forge-overlay-shadow plus --forge-modal-shadow. Neutral recipes live in foundations.css; workspace CSS assets may select reviewed recipes. |
| Icons | Icon from forge/components or forge/theme, with finite lucide: names and currentColor. Legacy Blueprint names retain their meaning. |
| Focus | focus.color, focus.width and focus.offset, including icon actions and controls. |
| Motion | motion.fast and the neutral --forge-motion-easing recipe. Reduced motion removes transitions and loading rotation. |
| Responsive behavior | Wrapping action groups and content-based fields. New variant buttons provide a 44px coarse-pointer target. Legacy pattern geometry remains its owner's migration scope. |

## Components, variants and states

| Implementation | Supported contract and scope |
| --- | --- |
| Button | primary, secondary, ghost, link, danger; default/compact sizes; hover, active, focus, disabled, readOnly and loading. Icon-only actions require a name. |
| WidgetRenderer/Blueprint pack | Text, number, textarea, select, checkbox, radio and SwitchControl bindings. Required/error/helper associations and availability remain intact. Select and segmented roles reach their controls. |
| Blueprint Callout/Tag | Select data-forge-status info/success/warning/danger and a typography role. Include text; dynamic results use role=status or role=alert. |
| Card/AccessibleSection | Existing renderer container anatomy, semantic appearance and keyboard collapse. The same implementations are used by Container. |
| Blueprint Popover/Dialog | Theme-owned portals, raised surface/elevation, focus trapping, initial control via onOpened, Escape and return focus. |
| DashboardTableContent/Chart | Existing data-driven components. Populated/empty/loading/error table states and chart typography are demonstrated. The opt-in document table supplies quiet headers, flexible columns and editable row details. Remaining table/chart migration and accessibility review stay separate. |
| Agently shell | Navigation, history, composer docking/transitions and viewer patterns are Agently-owned. Forge owns the shared Chat/Composer recipe described below. |

```jsx
import {Button, Icon, Typography} from 'forge/components';

<Button variant="primary" icon="lucide:check" loading={saving} onClick={save}>
  Save changes
</Button>
<Button variant="ghost" icon="lucide:panel-right" hideLabel
  aria-label="Show panel" onClick={showPanel}/>
<Typography as="h2" typeRole="section">Details</Typography>
```

Widget metadata selects `properties.variant`; toolbar metadata selects `variant`
directly. Both reuse Button. New variants reject inline appearance overrides;
use tokens or extend the shared component. Legacy button style props remain
compatible. Optional --forge-button-hover-bg and --forge-button-active-bg hooks
let a workspace select reviewed states; neutral defaults derive from its palette.
Compact and icon-only variants retain a minimum 44px target on coarse pointers;
the compact desktop height remains 28px. FoundationSpecimen includes both forms.

Icon accepts `name` and optional `label`. Informative standalone icons have a
label; button icons are decorative because their action supplies its name.
Unsupported Lucide names and variants fail explicitly. The finite registry uses
named imports from pinned [Lucide React](https://lucide.dev/guide/react/), with
no CDN or dynamic download. Extend it with an example and test in this owner.

The existing theme-preview.html now includes FoundationSpecimen plus the complete
TypographySpecimen. Browser checks cover real actions, selection, dialog focus,
table states, reduced motion and role propagation at desktop and phone widths.
Render checks reject customer branding in the new shared source and inline
appearance on new variants. The specimen runs with neutral shared fixtures or
externally supplied workspace assets. This is bounded foundation evidence, not
a claim that every legacy control, table interaction or device has migrated.

## Anchored panels stay visible

Use `Popover` from `forge/components` (or `forge/theme`) for anchored menus,
settings panels and contextual content. Library-owned Select panels receive
`anchoredPopoverProps(existingProps)`. The preferred placement describes intent;
it never forces a panel outside the visible viewport.

- Try the preferred side, then available bottom/top/right/left alternatives.
- Keep at least 12px from viewport edges and an 8px gap from the trigger when
  space permits. Shift inside those edges if no side fits completely.
- Render through the existing theme-owned portal using fixed positioning so
  scroll containers and headers cannot crop the panel.
- Limit oversized panels to the viewport with internal scrolling. Every action
  remains reachable; never hide overflow or shrink text to make a menu fit.
- Reposition on scroll, viewport resize and content-size changes through the
  existing positioning engine. Keep Escape, outside-click dismissal, trigger
  focus return, disabled states and nested controls working.
- Neighboring menus in one toolbar share a vertical placement decision based on
  the tallest menu before either opens. If it cannot fit above, both open below;
  if neither side fits, both use the roomier side with internal scrolling.
  Recompute together on content, layout, scroll and viewport changes. The shared
  document composer implements this for its attachment and Tools controls.
  Individual horizontal shifting and natural panel sizes remain intact; child
  popovers do not independently flip away from the group's chosen direction.
- Native browser select menus keep browser positioning and keyboard behavior.
  Tooltips and modal dialogs retain their distinct semantics. Do not implement
  anchored panels with absolute top/bottom offsets or import raw Blueprint
  Popover in application/component code.

```jsx
import {Popover, Button} from 'forge/components';

<Popover minimal popupKind="dialog" placement="top-start" shouldReturnFocusOnClose
  content={<div role="dialog" aria-label="Options">...</div>}>
  <Button variant="secondary">Options</Button>
</Popover>
```

The shared composer, registered controls, record/media previews, report menus,
table controls and host popovers use this path. The neutral anchored-panel
specimen demonstrates all preferred directions and oversized content. The
existing required workspace-theme command checks viewport edges, clipped
parents, scrolling, resize and Escape/focus, and rejects new raw Popover imports.
This is web behavior; native applications retain their platform interaction.

## Semantic typography

Forge consumes the existing portable workspace contract. Workspace theme values
arrive as `--forge-type-<role>-family`, `-size`, `-weight`, `-line-height`, and
`-letter-spacing`. Agently receives corresponding `--agently-theme-type-*`
variables. `src/components/typography.css` contains the single neutral fallback
scale, reused by Blueprint's existing size aliases. Workspace profiles own their
values. No vendor font is packaged by Forge.

`Typography` and `typographyProps` are exported through `forge/theme` and
`forge/components`. Example:

```jsx
<Typography as="h2" typeRole="section">Delivery overview</Typography>
```

`as` retains document semantics. `typeRole` changes appearance and accepts the
finite roles caption, small, body, section, heading, title, metric, display,
code, label, and metadata. Unknown roles throw. A role is not an ARIA role and
does not choose a heading level. Code and metric use tabular numerals.

Existing widgets opt in with `properties.typographyRole`. `WidgetRenderer`
validates the role and forwards `data-forge-type` to the actual control, not a
mockup. The Blueprint wrapper applies label typography to the existing accessible
label. Bindings, required/error associations, disabled/read-only behavior,
wrappers and event handling remain intact. Role consumers must not also supply
font size, family, weight, leading or tracking in metadata or inline style.
Legacy widgets retain their current font behavior when the property is absent.

`Chart` reads the active caption/small family, weight, size, leading and tracking
for axis, legend and tooltip text. Category measurement uses that same family,
weight, size and tracking. Theme/CSS/font changes refresh measurements without
clearing the selected series. The non-chart legacy UI and annotations are not
claimed as migrated.

## Document charts

Select `chart.appearance: document` on an existing Chart or `chartSpec.appearance`
on an authored report. Omit it to preserve the legacy rendering. This recipe
uses the existing semantic typography and palette, shared native selectors,
shared actions and token-based plot/tooltip geometry. Unknown appearances/layouts
and inline typography/stroke/bar appearance overrides fail explicitly.

| Property | Contract |
| --- | --- |
| appearance | Optional `document`; neutral shared defaults, workspace-owned reviewed values |
| layout | Optional `small-multiples`, for line/area; uses the same Chart for each series with one common value extent and all observed dates |
| stacked | Optional boolean for grouped bar series; direct series may retain existing stackId selections |
| rowLimit | Existing authored block limit. Positive values retain rank limits; document zero means all already-returned rows. Legacy horizontal/funnel defaults remain ten |

Line, vertical bar, horizontal/funnel bar, area, pie, donut and composed series
remain the supported families. Document comparisons have complete wrapped labels,
exact formatted quantities, signed extents and inert rows unless selection is
provided. Sparse trends preserve gaps and single observations. Document pie/donut
states distinguish missing data, zero and invalid negative slices. Column width
is capped by the theme and adapts to its category band at narrow widths.

ChartPoint keeps one keyboard stop per series. Arrow keys/Home/End move among
available observations; Enter/Space select. Its transparent pointer target is
44px. Small plots translate selection back through the original parent rows,
preserving business field bindings. Legends retain named selection/toggle
behavior and chart data can be read with the existing Table switch. Existing
CSV and print payload behavior is retained; export styling is separate from the
browser recipe and needs release-specific verification.

Workspace CSS may set --forge-chart-line-width, --forge-chart-point-radius,
--forge-chart-point-stroke-width, --forge-chart-column-size, --forge-chart-bar-size,
--forge-chart-plot-height, --forge-chart-small-plot-height, --forge-chart-axis-width,
--forge-chart-inset-top/right/bottom and --forge-chart-axis-line-height. Existing
chart colors and caption/small/body roles supply text, guides, series and surfaces.
Use the existing portable control and data tokens instead of duplicating their
values in component overrides. SelectControl supplies a low-specificity native
field recipe beneath the existing settings and document-table recipes.

ChartSpecimen in theme-preview.html shows ten configurations, seven states,
metric selectors/two axes and actual shared components. The existing workspace
theme command now includes report schema round trips and negative recipe checks,
browser family/state/role/selection checks and existing control/table regressions.
The existing CI Go command additionally tests the report-spec decoding boundary.
External host fixtures may supply authored report charts and reference assertions;
customer metadata, fonts and palette expectations remain outside this repository.

The existing `theme-preview.html` specimen renders `TypographySpecimen`, real
`WidgetRenderer` controls and the actual data-driven Chart. It includes all type
roles, empty/editable/disabled/invalid controls, an icon action, and the existing
portal/dialog examples. The action has local specimen data only. The portable
spacing, border, focus, icon size and motion hooks apply to role-selected
controls. Reduced motion removes their transition. Existing SchemaBasedForm
menus use `--forge-overlay-shadow` and `--bp-surface-shadow-2` as fallback.

Run `npm run test:workspace-theme`. Its existing render check covers actual role
selection and rejects new inline typography in the shared text component. Its
browser check verifies computed roles, changes all five role properties, checks
chart refresh and portal inheritance, and retains controls/state across desktop,
phone, mode changes and boundary cleanup. These checks supplement the existing
component/state tests; they do not prove all historical Forge components or
native screens have migrated.


## Contributing and extending

The versioned root README and AGENTS.md point to this guide. Compose supported
components before adding a new pattern. A shared extension includes its API,
variants, keyboard/focus and data states, specimen, product consumer, migration
limit and existing contract/component checks in the same change. PR evidence
identifies those items for the existing shared-component owner's review. Never
silently enlarge a legacy allowance or move canonical values into a page.

The repository now supplies versioned entry points for Codex, Claude Code and
Cursor, linked below. The design-system workflow runs the owning contract,
component and browser checks. GitHub policy verification found no merge-required
shared checks. An administrator must require `Design system contracts` before
team-wide merge enforcement can be claimed.


## Document table variant

`Container.tablePresentation.variant: document` opts DashboardTableContent and
DashboardEditableTable into the shared document table recipe. Existing tables
retain legacy rendering when absent. Columns retain authored order. Use one
`flex: true` column with numeric `minWidth`, and numeric `width` for compact
columns; `align: right` keeps quantities aligned. A text editor may explicitly
select `type: multiline` so long names remain editable without clipping.

Editable tables may also select `tablePresentation.rowDetails: {field, label?}`.
The field must be an existing column with `editor: false`; otherwise rendering
fails instead of silently removing an editable control. Its content stays under
the complete record and within the scroll viewport. It remains searchable.
Document tables use horizontal scrolling on narrow screens; their legacy
mobile-card metadata is inactive for this variant. Editing, replacement,
filtering, paging and remove handlers retain the existing implementation.
`tablePresentation.removeIcon` accepts the shared Icon names. Include the action
name through the existing removeRowLabel contract.

The document table consumes full body, metadata and label typography roles.
Optional component recipes are --forge-table-border, -header-surface,
-header-size, -header-weight, -header-line-height, -cell-padding-block,
-control-border, -control-radius, -control-padding, -details-line-height and
-details-padding-block. Body values and first-column labels follow all five
properties of their semantic role without per-table type-size recipes. Their fallback roles are generic; a workspace owns
reviewed values. --forge-icon-stroke-width complements the portable icon.size
and keeps the original 24px Lucide viewBox. Old icon names stay compatible.

FoundationSpecimen demonstrates the actual read-only document table and accepts
workspace-supplied icon examples. The generic Agently proof accepts externally
authored editable tables and reference-style assertions. Existing theme checks
cover authored order, narrow scrolling, full row detail, metadata round-trip,
real component rendering and unchanged legacy behavior. This foundation does
not migrate shell icons, lookup/pager anatomy, all tables or all screen layouts.

## AI contributor entry points

The team uses Codex, Claude Code and Cursor. Root `AGENTS.md` links this guide;
`CLAUDE.md` imports that entry point, and `.cursor/rules/design-system.mdc` is an
always-applied thin pointer to this same guide. These files are versioned so a
fresh checkout has the usage path. Instructions guide contributors; the contract
and component checks reject defined violations. Neither replaces design review.

Mechanisms verified against [Claude Code project memory](https://code.claude.com/docs/en/memory)
and [Cursor project rules](https://cursor.com/docs/rules). The Cursor rule uses
`.mdc` frontmatter and `alwaysApply: true`; no user/team settings are changed.

Document table values are plain at rest. Only an editable field under the pointer
reveals its control; keyboard focus or one tap enters it and keeps it visible.
Read-only values have no editor. Headers have no edit icons. Escape restores the
field's pre-focus value, Enter finishes a single value/name, and Tab advances.
Multiline text retains newline entry and Ctrl/Cmd+Enter to finish. Edits preserve
selection, reusing the existing table-integrity fix from Forge PR 11. Coarse
pointers receive 44px editor targets. Native selects retain one-click activation
and a shared Lucide chevron with reserved padding. The column pattern uses normal
read-only columns; rowDetails remains a compatible optional alternative.

Role-selected Typography and WidgetRenderer reject competing inline font values,
including local type-token overrides. Legacy controls without a role remain
compatible. Labels and feedback select their own roles; helper/error typography
is checked across wrapper modes and in browser token-perturbation assertions.


## Shared native select indicator

`SelectControl` is exported from forge/components and forge/theme. It keeps a
real native select, including label/id, name, required/disabled, selection,
change events, ref and keyboard behavior. A decorative, pointer-transparent
Lucide chevron shares one frame with the select. The neutral geometry reserves
32px at the inline end, with a 16px icon inset 10px. Workspaces can supply
--forge-select-indicator-space, -size and -inset; icon stroke inherits the normal
workspace icon hook. Control appearance and semantic type roles still use the
existing owning pattern's tokens. Role plus inline typography is rejected.

```jsx
<SelectControl {...typographyProps('body')} aria-label="View" value={view}
  onChange={event => setView(event.target.value)}>
  <option value="all">All records</option>
</SelectControl>
```

FoundationSpecimen's table-state chooser and the actual document-table select
editors reuse this frame. Agently's real appearance settings consume it through
the public export. Legacy table rendering is retained. Read-only table cells
remain text rather than a disabled edit affordance. Existing render/browser
checks verify native attributes, selection, disabled behavior, role validation,
indicator size/inset/padding and table cancellation.


The installed Lucide registry also exposes bell, gauge and log-out for shared
shell utilities. They use the same currentColor, decorative/accessibly named
Icon contract. Agently owns shell-specific geometry and placement; workspace
assets continue to own branding. The navigation and header specimens exercise
these exports without adding a customer-specific icon package.

Response actions can use `lucide:thumbs-up`, `lucide:thumbs-down` and
`lucide:ellipsis` through the same Icon and Button contracts. FoundationSpecimen
includes these glyphs; selected state remains the consumer's semantic state,
without a separate filled-icon API or dependency.

### Document chat consumers

`chat.appearance: document` uses the actual shared composer and task browser.
Message input and queue previews consume body; task titles consume label,
descriptions consume small and optional outcome captions consume caption.
Every category control, including Suggested or All tasks, and the Browse/library
return actions consume small. Other action labels consume label, and queue
status uses metadata. The host's document messages also consume body, including
rich prose inheritance. See [chat composer](chat-composer.md#document-presentation)
for behavior, activation, compatibility and verification. Workspace fonts and
palette remain outside Forge. Existing legacy presentation remains available.

The document Home question uses `Typography as="h1" typeRole="display"`.
The starting canvas uses the canvas role; the composer keeps its surface role.
Ordinary task rows use the quiet border role, selected categories use selected
background, and fields/composer use the strong border role. Keep those meanings
separate when supplying workspace tokens. Shared Home geometry uses 76px 36px
50px padding, changing to 48px 24px 36px at 760px and below. Workspace assets may
select a reviewed responsive display-role value without copying this geometry.

Suggestions take the first available task in each authored category, respecting
task and category order; without category groups they fall back to the first
five available tasks. The full catalog remains in the library. Priority belongs
to workspace or host metadata ordering, never product task IDs in Forge.
Actual-app fixture checks supplement the shared component/browser checks;
neither proves authenticated report saving or complete legacy report/chat
migration.

Chat owns the Home/library transition and accepts the host's `renderHomeRecent`
slot after task discovery. Library mode hides the Home question, composer and
recent slot; prepared-task Back preserves the mounted browser's filters and
the editable draft. The actual native Chat Home is rendered in Agently's
ChatSpecimen, so the existing desktop/touch typography runner checks its short
content allocation as well as the separate composer/task consumers. Five-property
small-role perturbations cover category controls and task descriptions, and
body-role perturbations cover real message content. Keep workspace-selected
sizes, palettes, fonts and task wording outside this shared recipe.

The selected starter's return action reuses the library's `Button variant="link"`
with the `small` role and `forge-task-back` geometry. A content-width frame aligns
the compact action with the Home heading without stretching its hit area across
the page. Both return paths keep the 44px target, keyboard focus and independent
Home/starter drafts; returning from a library selection retains search and filters.
The native Chat Home specimen and existing host browser checks exercise these
states at desktop and phone widths. Selection and return never submit a request.

### Compound editors in document tables

The existing `tablePresentation.variant: document` supports fixed identity and
numeric columns plus one flexible explanation column. Field hover/focus reveals
the native editor without moving the row; read-only columns remain text. The
frequency editor groups count, interval and unit in a shared four-track grid.
Its copy and unit select inherit the body role, and the unit reuses SelectControl
with the same indicator inset and reserved space as other document selects.
The existing disabledWhen guard applies to all three frequency fields.

Escape restores the focused field's pre-focus value while retaining sibling
edits. Single-line inputs finish on Enter. A multiline name column can declare
`editor: {type: multiline, commitOnEnter: true}` to finish on Enter. Other
multiline editors retain Enter for newlines and Ctrl/Cmd+Enter to finish.
Document numeric editors suppress legacy data-bar backgrounds, while retaining
the authored value/format/visual metadata and legacy rendering outside this
variant. No workspace branding belongs in these shared rules.

FoundationSpecimen renders the actual frequency editor in its populated/editing
states. The existing workspace-theme render/browser runner covers disabled
controls, shared selects, five-property body inheritance, no compound overlap,
decimal input and field-scoped cancellation on desktop and phone. Host report
composition and product save/publish behavior need their owning integration.

### Reading documents and paired dates

`Container.appearance: document` selects the shared bounded reading surface.
Use `layout.appearance: document-flow` for vertically spaced peer sections,
`document-header` for identity beside a wrapping action toolbar, and
`dashboard.summary` with `appearance: document-scope` or `document-summary` for
semantic definition lists instead of metric cards. Summary items may select an
existing `dataSourceRef` independently; they retain the source's actual values.
No datasource, permission or business action is created by an appearance.

The document consumes body, title, section, label and metadata roles. Its default
maximum width is1150px, desktop padding30/36/48px, and phone padding20/16/24px.
Geometry can be supplied through the `--forge-document-*` semantic variables in
`documentPresentation.css`. Selected appearances reject container inline styles.
Keep fonts, palettes, product labels and bindings in the workspace owner.

Schema fields explicitly forward `x-ui-properties` to widget properties and
`x-ui-hide-label` to label ownership. A paired native date control selects
`x-ui-widget: dateRange`, `x-ui-properties: {appearance: document}`,
`x-ui-hide-label: true`, and a two-column span. Each edge retains its own label,
native date picker, range bounds, disabled/read-only and invalid semantics.
Unselected date ranges keep the legacy rendering. Field-track forms use the
control-only wrapper even when a group owns its own labels.

Named actions remain visible when `hideLabel: false` is explicit, including
workspace-forwarded export actions. Document headers use the existing action
variants and Lucide registry, and wrap rather than collapse named actions into
unexplained icons. The shared DocumentSpecimen uses the actual Container,
SchemaBasedForm, paired dates and summary implementation. Existing required
workspace-theme checks verify retained edits, date constraints, all five role
properties, native focus, responsive geometry and legacy opt-out. Go metadata
roundtrips and the existing schema mapper test cover serialization/activation.

Within an active document Container, AccessibleSection exposes an h3 with the
complete section role. Its existing legacy heading stays unchanged outside that
scope. Blueprint header-size defaults yield to an explicit semantic role. Paired
date groups use the group part; their two native inputs own the input part and
body role. The group has no enclosing control border or padding. Labels consume
muted metadata with the same alignment as adjacent fields. Required browser
checks perturb these consumers and reject a return of enclosing group chrome.

### Analytical documents and input modality

Report authors can select `viewer: {appearance: document}` on the existing report
document. The viewer setting survives compilation/lowering and backend JSON;
`allowChartTableSwitch` remains independent, including legacy defaults when it
is omitted. `ReportRuntime` provides the shared title/action header, quiet panels,
compact metric records, semantic narrative roles, document tables and
relative-date controls. Document KPIs also retain secondary comparisons, body/both
presentations and authored sparklines. Missing or diagnostic values keep their
existing meaning. Comparisons use signed values and status tokens. Paragraphs,
inline code and code blocks apply their complete semantic roles.

Use the actual analytical document in `FoundationSpecimen`, not a copied HTML
example. The required workspace-theme browser check exercises section changes,
filters/presets, read-only tables and all five typography properties. Report
category color maps are validated in both compiled spec and fill artifacts, so
an existing authored map does not invalidate an export request.

The Blueprint pack separates input modality for non-text actions, tabs and links
within application/workspace/portal boundaries. A mouse click retains focus with
no outline; keyboard navigation uses the theme focus width/color/offset. Do not
blur controls or suppress text-entry focus. The specimen/browser checks use real
clicks followed by Tab/Shift+Tab/ArrowRight and preserve the selected underline.
Document mobile form size/leading aliases the body role through existing form
tokens, preventing the legacy mobile fallback from overriding explicit roles.

Document numeric axes reserve the measured formatted tick width with the existing
axis margin, including stack extrema and authored common small-multiple domains.
The axis-width token remains a minimum. Static dataset normalization preserves
an explicitly authored column `format` in column/chart field options, allowing
the existing compiler to retain currency and percentFraction units. Formatting
changes presentation only; do not infer units from field names or alter values.
The compiler regression is imported by the existing required theme contract.

### Analytical assessments and read-only records

Document `infoPanelBlock` and `calloutBlock` use the shared quiet assessment
surface, real icons, semantic tones and heading/body/metadata roles. Workspaces
may select reviewed values for the complete heading role at this boundary. Badges use
small; repeated collections use label/body/metadata/metric as appropriate.
List collections remain compact, while grid collections stack by container size.
Omitting the document viewer preserves legacy presentation.

A canonical read-only `tableBlock` can select `recordTitleField` using one of its
existing column keys. In the document viewer, each row becomes a native details
disclosure with the title in its summary and every remaining column in a
definition list. Formatting, links, display maps, filtering and paging use the
existing DashboardTableContent path. A table with row actions or multi-selection
retains its interactive table, so the record presentation cannot hide controls.
The title key must exist. Keyboard Enter/Space toggles the native disclosure;
keyboard focus remains visible, while pointer clicks do not add an outline.

Canonical columns now carry the existing table layout fields `width`, `minWidth`
and `flex` through normalization, spec/fill schema and backend decoding. Widths
must be at least 48. Give long names/explanations flexible space and align
quantities right. These fields choose layout, never typography or brand values.
Export retains all record columns as an ordinary table; it does not depend on
which disclosures are open. Backend decoding also preserves existing column
display/icon maps. No client-specific business decision lives in this renderer.

The actual analytical specimen exercises the richer metric, assessment, warning,
badge, stage list and read-only records. The required theme command includes
real disclosure keyboard/pointer checks, all five typography properties,
interactive-table fallbacks, schema/format regressions and materialized-sparkline
validation. Static sparklines validate fields against the snapshot column keys;
they never add backend query fields to an immutable materialized request.

### Document geographic evidence and timelines

The existing document viewer also selects shared map/timeline presentation.
State tiles use complete caption roles, selectable buttons and visible keyboard
focus; absent states remain inert. The selected region is announced, while
ranking and legend values retain their authored data. A local horizontal map
scroller preserves state geometry on narrow screens; touch tiles are 44px.
Details stack below the map when its container is narrow. World-map zoom/reset
uses the shared Button and its attribution uses caption. Data colors stay in the
existing geographic contract, not a workspace-specific map renderer.

Timeline events use an ordered list, metadata dates, label headings and existing
body markdown. Empty timelines and geographic errors/empty data use complete
roles. Legacy report appearance remains compatible. Existing neutral specimen
and required theme checks cover selection, pointer/keyboard focus, zero/empty
geography and role application.

Canonical tables may include `description` for coverage, units or source limits.
It survives normalization, spec/fill/backend decoding and print. The actual table
header displays it through metadata. Do not drop caveats when choosing a document
table or when splitting a wide table for print. Existing compiler/schema/backend
round-trip tests cover this optional field. Existing external table links use
`link: {kind: 'external', urlField: 'url'}`; shared validation admits HTTP/HTTPS
only and keeps missing/invalid destinations inert.

### Selectable review reports

`ReviewTable` composes the existing `DashboardTableContent`, shared actions and
metadata role. `tableBlock.selection: {mode: "checkbox", field: "selected"}`
opts a canonical table into local review choices. It does not authorize a save.
Checkboxes retain native semantics inside a 32px label target with a 16px visual
indicator (`--forge-selection-target-size`, `--forge-selection-indicator-size`).
Editable text-field geometry excludes checkbox/radio inputs. Pointer focus stays
quiet and keyboard focus remains visible. Wide review tables expose scroll guidance.

The host applies only full-source boolean choices through
`applyInlineReportTableSelections`; filtered rows map by source identity, so two
rows sharing a business ID remain distinct. Evidence and requests stay unchanged.
Current choices reach CSV and print snapshots, including an explicit Selected
column. Equal report content/revision must retain edits; new source revisions
reset them. The neutral specimen and existing workspace-theme runner exercise it.

Compound checkbox names use optional selection.labelFields; partial bulk selection uses the native indeterminate property and mixed ARIA state.


### Authored analytical documents

Document `stepperBlock` uses an ordered list with body copy and label-role headings.
Document `kanbanBlock` uses read-only grouped stages with label headings, small-role
badges and existing body markdown. Neither implies task mutation or drag behavior.
The neutral ReportDocumentSpecimen exercises both, including empty-state roles.

A document composite containing only KPI blocks defaults to a responsive metric
grid when no layout was authored. Detailed metrics use three, two or one columns
based on the report container. Plain summaries fit readable tracks to available
width, with a 220px default minimum and 128px below 600px. An explicit `stack`
or `responsiveGrid` keeps its prior behavior.
Document-table defaults give a non-identifier dimension the flexible column when
no `flex` was authored. Explicit flex selections keep priority; width applies
to bounded columns, while the flexible column uses minWidth. Measures and
identifiers stay bounded so readable names can grow. Legacy tables are unchanged.

Inline static datasets named `primary` resolve their own field catalog, like other
static dataset IDs. This supports both populated and empty primary charts without
weakening validation or modifying their rows. Live primary datasets retain the
existing builder context. Existing workspace-theme, compiler and model tests cover
these boundaries; no private branding belongs in these shared contracts.

### Independent viewer settings

Changing the chart/data switching policy must retain independent viewer settings.
`updateReportChartTableSwitch` validates the current viewer, updates only
`allowChartTableSwitch`, and removes only that property when returning to Default.
It preserves `appearance: document`; an empty legacy viewer still normalizes to
null. The production ReportBuilder and neutral analytical specimen use this same
helper. Existing required theme checks cover Allow, Hide and Default transitions
and confirm the specimen retains its actual document root and title role.

### Review locking and local form changes

ReviewTable accepts optional `disabled` and `showDownload` (default true).
Disabled review keeps the full evidence and selected state, disables native
checkboxes through DashboardTableContent's readOnly flag, and ignores selection
updates. Hiding download omits that action without adding a replacement. Existing
required theme checks and the host's actual neutral review specimen exercise it.
The icon catalog includes the same neutral Lucide help/pause/loading/link/retry
glyphs used by the host's request lifecycle; no workspace brand glyphs are added.

SchemaBasedForm forwards changed local values to its existing onChange prop.
Previously local controls updated their visible state without notifying that
caller. Notifications track value identity, so an inline callback change does
not repeat the event. Initial values and form-scope datasource behavior retain
their existing paths. The disabled prop reaches field-track controls, legacy
checkbox groups/lookups and submit actions. Ordinary legacy WidgetRenderer fields
retain their existing behavior and do not inherit the whole-form disabled prop.
Existing form layout/render checks and the host's mounted
approval test verify the actual field value reaches the saved decision payload.
This does not alter backend authorization, submit routing or business validation.

Field-track grids reuse their current context when no datasource is authored,
including local approval forms. Explicit datasource references still resolve
through Context and missing named sources still raise the existing error.
The schema-form render contract verifies a local form against the real strict
Context, rather than an always-successful context stub.

## Scoped document profiles

`ForgeThemeBoundary presentation="document"` marks only that renderer boundary
and its owned portal. It keeps the existing theme identity, mode and portal
ownership. Core's optional theme `presentations.document` mapping can supply an
existing workspace-owned profile at that marker. Omitting it retains the selected
theme. Native document-chat metadata marks its window; hosted document reports
and authored document Tool Feeds select their respective boundary. Legacy windows
remain unmarked. Use the existing optional contract rather than duplicating role
values in a component. Shared field-track select and lookup triggers use the same
Lucide chevron as SelectControl; legacy triggers keep their existing icon.

## Shared report filters

`ReportFilterBar` uses shared controls with lazy lookup loading, Apply/Reset,
required inputs, loading and retry states. Place it before report content inside
`forge-report-filter-layout`. Its `placement` accepts `top` (default), `left`,
or `right`; legacy `rail-left` and `rail-right` aliases are accepted. Both side
rails stack above the report below 760px. Hosts read the authored
`builderDefinition.reportBuilder.filterPresentation` so preview and hosted
reports use the same placement. Changing placement must preserve filter values.

```jsx
<div className="forge-report-filter-layout">
  <ReportFilterBar placement="right" controls={controls} values={values}
    onChange={setValue} onApply={apply} onReset={reset} loadChoices={loadChoices}/>
  <ReportContent/>
</div>
```

These controls do not change producer authorization or query semantics. Legacy
ReportBuilder drawer and sheet presentations remain outside this host migration.

### Authored tooltip details

Authored `chartSpec.tooltip` fields use the shared `ChartTooltip` body for pointer
inspection and the native detail selector for keyboard/touch access. Labels and
values consume label/body/metadata roles, wrap safely, and retain explicit
null/missing/grouped states. See [the tooltip contract and synthetic example](chart-tooltips.md)
for admitted field dependencies and the default paginated print detail policy.

### Categorical matrix charts

`chartSpec.type: heatmap` selects the shared categorical matrix primitive. Its
explicit row/column domains and numeric scale are producer-authored; browser and
canonical print share the matrix, colors and labels. The owning ChartSpecimen
includes independently invented occupancy and signed-temperature examples.
Cells consume the small role, retain complete accessible descriptions and keyboard
focus, and scroll locally at narrow widths. See [the heatmap contract and limits](categorical-heatmap.md).

### Category-local range charts

`chartSpec.type: category-range` opts into declared scalar bars, intervals and
comparator markers per category. The shared ChartSpecimen includes independently
invented room temperatures and signed offsets in both orientations. All marks
share one numeric extent; null endpoints remain unavailable. Labels and exact
values use the small role, wrap and scroll locally, with complete accessible
names and keyboard selection. Browser and canonical print use the same geometry.
See [the range contract and migration limits](category-range.md).

### Donut-center content

Optional donut `center` binds an explicit dataset measure with declared `scalar`
or `sum` semantics. The center consumes existing small/caption chart roles and
wraps within the hole; complete visible details follow the chart if the text does
not fit. Zero/unavailable states and canonical PDF use the same resolved value
and formatting. The shared specimen includes synthetic library and occupancy
examples. See [the contract, scope and limits](donut-center.md).

### Analytical table structure

`tableBlock.hierarchy` extends DashboardTableContent with keyed inline disclosure;
`tableBlock.pivot` materializes an explicitly declared categorical matrix into the
same table. Native grouped headers and shared buttons retain semantic typography,
focus, selection and local scrolling. The laboratory example is entirely invented.
See [table analytics](table-analytics.md) for totals, filter/sort/page semantics,
complete evidence exports and migration limits.

### Bound standalone report scope controls

Published native report windows now carry each dataset's explicit `queryPath` in
`datasetBindings`. A scope parameter can declare `filterBindings`, each with a
`datasetRef` and `path` relative to that dataset request's `filters`. Optional
`valuePath` selects a part of the control value, for example `start`/`end` for two
independent date inputs. Paths reject prototype traversal and overlapping writes.
Unbound scope parameters remain descriptive. Shared bindings must agree on the
current value for each value path; conflicting datasets fail rather than display
one arbitrary dataset's scope.

The existing inline filter control handles declared options, date ranges, and
scalar `integer`, `number`, or `text` values. Scalar fields use the shared input
part and label/body roles, commit on blur or Enter, and retain native required
and numeric validation. Each change batches all targeted inputs per datasource,
resets query offset and source page, and refreshes through the ordinary datasource
handlers. Fixed request/actor inputs remain intact. Pending, error, denied, and
empty results retain the ordinary report binding states; prior rows are hidden
before input mutation.

`report-scope-controls-preview.html` is an independently invented fixture of the
actual native renderer with a deliberately simulated datasource. Its Endly
workflow is `e2e/report-scope-controls/run.yaml`. It is UI contract evidence, not
an external producer or authorization integration claim. Existing ReportBuilder
controls and producer authorization remain separate owners; option discovery and
provider-specific input paths must come from authored producer metadata.

Document reports expose the same filter toggle with or without a section tab
rail, including stacked and single-section documents. The mounted controls
regression uses document appearance and opens the actual header toggle before
editing. Refresh keeps the renderer mounted with an empty pending fill: selected
tabs, open filters, and table sort survive while old rows and metric values are
removed. Local table pagination resets alongside request offset and source page.

Bound standalone date fields commit on blur or Enter, so a refresh cannot remove
the field halfway through typing. This opt-in uses the existing date input helper
in both document and legacy presentation. Relative presets still commit directly.
The expanded fixture checks declared `start`/`end` bindings, required multi-select
protection, optional multi-select clearing, and preservation of unrelated inputs.

Bound control defaults must satisfy required-value rules. Native validation and
the converter reject numeric values outside JavaScript's safe range before JSON
reaches the browser; a larger identifier requires a producer-declared string
input, never an implicit numeric-to-string conversion. Converter output runs the
native report validator before materialization, including overlapping-binding
checks. Split date inputs reconstruct explicit endpoint values without carrying
stale preset or expression metadata from their original defaults.

Editable bound controls report invalid drafts inline with `role="alert"`,
`aria-invalid`, and an associated description. Clearing an optional integer or
number commits explicit null; clearing a required field, entering an unsafe
integer, or entering an invalid/inverted date range preserves the effective
request and performs no fetch. Valid corrections clear the draft error. The
native browser fixture covers these real input/blur paths in the same Endly run.

Pending and failed bound reports pass their lifecycle state to both charts and
tables, so only a successful empty response displays “No data.” Tab contents
use `retainEmptySectionContent` only with an empty pending fill while the
transition is visible; hidden DOM
contains no previous rows or metric values. Missing datasource control handlers
produce the neutral unavailable state and leave scope inputs descriptive.

Optional text and date-edge clears preserve the shared input convention of an
empty string; numeric clears use null, and multi-select clears use an empty
array. These values are not coerced across producer types. Split date bindings
carry endpoints only, so preset buttons do not retain a pressed selection;
reapplying a preset can refresh its resolved dates.

An explicit static `reportFill` without populated `datasetBindings` remains a static
preview, including when its authored scope carries filter bindings. Those bound
inputs stay descriptive even if the host supplies legacy editing callbacks;
legacy scopes without filter bindings keep their existing host behavior. Missing
runtime bindings, handlers, or request defaults use the unavailable state;
malformed authored paths and non-object requests still fail explicitly. Bound
reports may show both an outer status banner and an inline chart/table status.

Bound controls do not delegate bulk clear or enable toggles to legacy host
callbacks. Mixed reports pass only legacy unbound filters to host Clear all.
Toggle permission is independent of value-edit permission, preserving existing
read-only-value controls whose host still permits enabling or disabling them.

Independent donut center datasets and explicit pie slice labels use the same
shared Chart and small/caption typography. Conditional centers retain exact
numeric formats and labels from the same admitted request, including null and
empty results. See [donut center and slice labels](donut-center.md) for complete
scalar input requirements and the independently invented native specimen.

### Source-bound narrative text

Native `markdownBlock` accepts an explicit `datasetRef` and optional
`templateRequestInputs`, whose aliases reuse the typed request-label mapping
contract. `${input.choice}` reads only that dataset's admitted request filters;
it never substitutes a workbook's saved default. Missing inputs, undeclared
aliases and unmatched typed values are errors. Request label text and
`${format(row.field,text)}` are escaped literal text, with no HTML execution or
template re-evaluation. The limited native Markdown renderer and canonical print
path preserve escaped punctuation identically. Null/missing row values use the
existing em-dash placeholder; they do not become a zero or a current date.

A static narrative may still omit datasetRef. Source date text without an authored
format retains the producer's display string. A freshness token must bind to an
actual producer freshness field; rendering time is not a substitute. Formatted
source text can preserve bold/italic spans and literal explanatory help, while
fonts and colors remain owned by the shared presentation system. Unsupported
source format patterns, nontext channels and plotted axes remain explicit
conversion responsibilities. The source-text checks run with
`npx vite-node src/reporting/reportTemplateRequestInputs.render.test.mjs`.

Repeated collection labels can retain authored numeric units through
`templateFieldDisplayMap[field].numericFormat`, reusing the shared numeric
format contract. Optional `markerColors` maps exact item-title categories to
six-digit hex swatches. The existing collection renderer places a small decorative
square beside its semantic label; the text remains readable without color.
Resolved marker colors and formatted text follow the same canonical print path.

KPI sparklines can opt into explicit point detail metadata and print policy.
The shared sparkline supplies keyboard, hover and tap access with caption-role
status text and a shared Dismiss action. See [sparkline point details](kpi-sparkline-details.md)
for the neutral reading-trend fixture and compatibility limits.


### Window viewport scrolling

`WindowManager` keeps rendered content in a bounded, scrollable frame. Custom
renderers such as reports can exceed the viewport without being clipped.
A window root declaring `sizingMode: content` scrolls at the window layout;
explicit fill-sized and split layouts retain their own internal scrolling.
The frame remains mounted across tab visits and docking changes.


Window hosts can place the existing runtime tabs in their header using
`workspaceRuntime.tabMount` on `WindowManager`. The same tabs control the
retained panels; keyboard selection and close admission remain shared.
Optional `tabListClassName`, `tabItemClassName`, and `renderTabLabel` adapt the
host's header appearance without creating a second navigation state.

## Document report presentation follow-up

Document prose fills the available width inside its padding. Empty Markdown lines
do not add spacer rows; flat numbered and bullet sequences retain semantic lists,
inline emphasis and original priorities. Fenced code stays literal. Nested lists
and continuation blocks are outside this bounded parser. Legacy prose retains its
existing spacing. Missing metric labels prefer an authored title through both the
browser compiler and embedded materializer; explicit labels remain authoritative.
Unavailable metrics retain their readable caption, and zero remains a value.

Document tables show horizontal-scroll guidance only when measured content
overflows. Sorting and row values survive resizing. Document section navigation
selects SectionTabRail overflowBehavior=menu: tabs remain when they fit, then a
labeled native select preserves section identity and disabled choices. Editable
or reorderable rails retain their existing scrolling controls. The native select
uses shared body roles and a 44px minimum height on narrow screens.

The maintained DocumentSpecimen and ReportDocumentSpecimen exercise these
capabilities with independently invented data. Existing required render/browser
checks cover wide/narrow composition, large/missing values, paragraph spacing,
list semantics, table overflow, section switching and legacy compatibility.


## Chat attachments

The legacy Chat attachment action opens AttachmentDialog using the shared
foundation overlay, Button variants and body/section/metadata roles. Its native
multiple-file picker, selection identity (name, size and modification time),
removal, upload callback and fresh-open reset remain unchanged. File names wrap
in a flexible list instead of competing with fixed progress columns. The body
scrolls within the viewport while Close and Upload remain available.

The picker receives initial keyboard focus; Tab stays within the Blueprint
dialog, Escape closes it and focus returns to the trigger. File picker and
icon actions retain coarse-pointer targets. Progress has an accessible value;
failed, completed and canceled states include text. Workspace palette, type,
spacing, focus, border and radius tokens determine appearance in both modes.
FoundationSpecimen's attachment example uses local files and a simulated failure,
never a network upload. Existing workspace-theme component/browser checks cover
selection, deduplication, removal, callbacks, progress, focus, token consumption
and narrow widths. Other chat dialogs and upload service behavior are outside
this migration.

Document Composer's optional `onDropFiles` callback uses the existing Chat upload
pipeline when uploads are available. The message shell shows a pointer-transparent,
label-role drop hint using selected-surface/text/interaction tokens. Files upload
without submitting or editing the message. Disabled and non-upload configurations
reject file drops while ordinary text drags retain native behavior. The picker
stays available for keyboard and touch. FoundationSpecimen's real Composer
demonstrates this with local files, and the existing component/browser checks
cover nested enter/leave, multiple files, draft retention, disabled drops and
the existing 16px phone textarea exception. Legacy composer rendering is unchanged.

AttachmentDialog also accepts drops over its body, including the native chooser
and selected file list. Its spacious chooser shows a paperclip, a plain drop
instruction and the complete Browse files action. Both native choices and drops
use the same selection merger, retaining exact-file deduplication by name, size
and modification time. A drop adds files for review; only Upload invokes the
existing upload callback. The selected-file count is announced politely. The
active drag follows selected-surface/interaction roles and takes precedence over
hover. Browse remains a native keyboard/touch file control with its focus ring.
The shared useFileDrop hook owns drag depth, file-only handling and reset for
both this modal and DocumentComposer. Closing the modal clears drag state and
reopening clears selection. No file policies, folder traversal or service change.
The real FoundationSpecimen and existing component/browser checks exercise both
consumers, mixed selection, repeated drops, manual Upload, dark mode and narrow
widths. Shared defaults stay neutral; workspaces retain their fonts and palette.


### Direct picker and visible upload lifecycle

Document Chat's Add photos or files action opens its native multiple-file picker
synchronously from the button gesture. Canceling the picker keeps the draft and
existing files. Opening it again does not reset or abort other uploads. Its
hidden input resets after each selection so the same file can be selected again.
The legacy presentation retains its separately documented dialog behavior.

Picker, drop, camera and audio files share useUpload. It stages files before
optional async preparation, then exposes preparing, uploading, finishing and
failed states to the real Composer through UploadChips. Each visible file has
progress and cancel; failures retain the file and offer Retry or remove. A transfer at 100%
still says Finishing upload until a valid response supplies a file URI.
Network/preparation/service/invalid-response failures remain visible rather than
being presented as successful attachments. Cancel/reset/unmount prevent pending
preparation and late responses from starting or restoring a canceled transfer.
Existing plain extraFields callers and synchronous returned IDs remain supported.

The draft stays editable. Button and keyboard submission wait for unresolved
uploads, including failures, so a message cannot silently omit an intended file.
Ready attachments keep their existing canonical payload and removal behavior.
Retry reruns normal preparation and permissions; no automatic retry, file policy,
new service or backend contract is added. UploadChips uses the existing small/
metadata roles, shared actions and palette, with reduced-motion behavior.
FoundationSpecimen exposes all upload stages through the real Composer. Existing
workspace checks include hook races/failures, state rendering, responsive and dark
presentation, motion, and unchanged legacy dialog behavior.


### Stable attachment cards

Document Composer uses one keyed UploadChips list for preparing, uploading,
finishing and ready attachments. A card retains its width and progress row
through completion, so changing status does not resize or replace it. Completed
progress is hidden visually and from assistive technology. Ready files say Ready
to send and retain the existing remove action. Filenames can wrap at narrow widths.
Chat keeps an internal, non-enumerable uploadId on ready files to preserve card
identity and selection order when uploads finish out of order; the message
payload fields stay unchanged. Canonical attachment indices still drive removal.
The real specimen and existing desktop/phone browser checks assert stable card
identity and dimensions, alongside component coverage for out-of-order completion
and correct removal. No size animation, dependency or service change is added.
