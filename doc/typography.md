# Shared design-system foundation

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
| Agently shell | Navigation, history, composer and viewer patterns are Agently-owned migration work. |

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
