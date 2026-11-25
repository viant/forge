# Forge design-system library

Forge implements the shared components and patterns. Host applications compose
them into workspaces and publish their own style definitions.

## Layers

### Foundations

Foundations are semantic roles and cross-platform behavior contracts:

- color: surfaces, text, borders, interaction, feedback and data roles;
- typography: family, size, weight, line height and tracking roles;
- geometry: spacing.1–6, control dimensions, radii, borders and focus;
- responsive behavior: phone/tablet/desktop form factors, touch target minimum,
  page gutters, section gaps and content max width;
- accessibility and motion: focus visibility, reduced motion, announced state,
  keyboard behavior and coarse-pointer targets;
- iconography: the shared Lucide/currentColor contract.

The workspace authoring service owns the theme CSS, semantic values, profile
catalog and fonts. Forge consumes the resulting `--forge-*` roles and supplies
neutral fallbacks for standalone previews. Appearance changes belong in the
selected theme; shared anatomy and interactions remain in Forge.

### Theme invariants

Light and Dark are presentation modes, not alternate content variants. A mode
change may alter semantic color values and other explicitly mode-aware tokens,
but it must not alter copy, component order, DOM anatomy, spacing scale, control
dimensions, typography metrics, or responsive breakpoints. The paired review
sheet is guarded by `forge-agently-theme-sheet.contract.test.mjs` so visual
review cannot silently drift into two different experiences.

### Components

Components own markup, anatomy, variants, states, interaction behavior,
accessibility, and semantic variable consumption. Examples include Button,
Typography, Icon, AccessibleSection, tables, dialogs, tabs, Chat and Composer.

### Patterns

Patterns compose components into reusable page-level solutions. They own
composition behavior and responsive rules, but not product data or brand
values. The first public pattern is `SectionPattern`, with `primary` and
`quiet` appearances and a `flush` content inset.

Direct consumers use `<SectionPattern appearance="primary" contentInset="flush" />`.
The public component maps those props to the same semantic attributes used by
authored Container metadata and includes its own pattern CSS. The host supplies
the Light/Dark values through `--forge-*` roles.

New patterns must include:

1. a public API and semantic state contract;
2. web, desktop and mobile behavior;
3. Light and Dark review specimens;
4. a Forge consumer and a product consumer;
5. contract, render and browser verification;
6. a migration note for any legacy consumer it replaces.

## Ownership and release flow

Forge changes are reviewed visually first, then released as a versioned
library. Agently updates its Forge dependency and composes the approved
patterns into the application shell. The owning workspace selects patterns in
its metadata and publishes the semantic catalog values. A token-value
change can flow through the catalog without a Forge code release; a component
or pattern behavior change requires a Forge release followed by consumer
updates.

The installed Forge version must be treated as the production truth. Local
worktree previews are review artifacts until the Forge package and consuming
applications are released and verified together.

A host can supply its own style export to inspect its Global → Alias → Semantic
graph, resolved Light/Dark values, typography, and geometry in a local preview.
Keep host token exports and font assets with their owner.

## Local component documentation

`design-system-2-library.html` is the shared library entry point. It contains
88 retained entries from the Astryx overview inventory, grouped in the same eleven
reference categories, plus ten Forge-specific entries. Typeahead, Typeahead Item
and the three rich-text editor entries were removed from the catalog by request.
Layout retains only Form Layout; its other nine entries were also removed.
Searchable Dropdown is the standalone searchable selection field. This is a
local review website; building it does not publish a site, a package, or a theme.

The gallery, searchable sidebar and component routes share
`src/demos/theme/componentCatalog.js`. Each entry records its implementation
owner, documented variants and states, anatomy, usage, practices to avoid,
interaction behavior, keyboard behavior, responsive behavior and semantic roles.
`CatalogExamples.jsx` uses the actual existing Forge/Blueprint components or
explicitly identified semantic HTML compositions. Compositions are not new
public component exports. The component page includes a live playground,
variant and state examples, source, documentation and resolved theme values.
The catalog uses one default control size in its gallery, examples, foundations
and documentation. Icon Button additionally offers Small through the existing
compact icon API, with its target supplied by the semantic theme.

Chat Composer showcases attachment, Tools, microphone and Send/Stop controls.
Its theme can keep these controls compact as the chat narrows into an overlay
or split panel. The tool-activity recipe uses independent native disclosures
for working steps and command output. The shared stylesheet supplies the neutral
`forge-text-shimmer` motion; the selected theme supplies its text colors, size
and duration, with a static treatment for reduced motion and forced colors.

Routes use `#components/<component-id>`, `#category/<category-id>`, `#variables`,
and `#guidelines`. Foundations use `#foundations` within the same library shell.
The existing broad review specimens remain at `#specimens`;
existing `#foundation-*` and `#ds2-*` specimen links remain supported.

The existing `VITE_DESIGN_SYSTEM_*` asset inputs supply the host theme. A local
review can load an export of the authoring service's Global CSS working draft;
reviewing that export does not require publishing the resource. Shared
catalog code defines no competing palette, font assets or runtime token source.
The Variables view reads the semantic variables actually emitted by the loaded
theme stylesheets. Component pages show the corresponding source variables
beside their Forge renderer roles. The display follows the active mode and does
not maintain a second token map. It complements the complete Global → Alias →
Semantic visualizer described above.

Coverage status distinguishes an existing component, a composition recipe and
an implementation gap. The remaining Splitter keyboard limitation is outside this catalog.
The removed rich-text entries do not add an editor capability.
Bottom Sheet, Bottom Sheet Switcher, Command Palette, Lightbox and Overlay are removed from the catalog.

Multi Selector and Tokenizer keep their 40px field height when many values are
present. Native OverflowList fits up to three tags and a remaining-count summary;
the existing popover exposes the complete editable collection. Multi Selector
uses native MultiSelect customTarget, items and selectedItems: selected options
are excluded from the available menu and return when their tags are removed.

Navigation examples reuse existing primitives. Breadcrumbs uses the native
breadcrumbRenderer and Select for sibling switching, including the current
document. Pagination defaults to compact ghost arrows and one count. Stepper
is a native button composition with numbered circles, descriptions and
icon-only completion/error feedback; its accessible button name retains status.
Validation belongs to the consuming form. Tab List uses SectionTabRail's native
keyboard and overflow behavior. Its underline appearance, stepper colors and
distinct Top Nav compositions consume the host's semantic theme. Layout contains
only Form Layout.

`ComponentCatalog.render.test.jsx` renders every listed variant and state and
checks actual action availability, switch changes and local field binding.
Run it with the existing runtime Vitest configuration. The catalog browser
check covers the gallery, search, component documentation, live button states,
Light/Dark and phone navigation. The original foundation browser check enters
through `#specimens`.

Drawer examples use the native right-side position and size APIs at 360, 560,
920 and 1200px. Customize View, Filter View with back navigation and Condition
Filter are local compositions of the shared controls. Toast uses native intents
and distinct shared icons for information, success, warning and danger.

Tooltips stay dark in both modes with the shared 8px control corner. A title
and description remain noninteractive; the Learn more example composes the
existing hover Popover so its link can receive focus or pointer input. Neither tooltip nor
popover surfaces display a triangular pointer.

Hover Card uses the existing Popover class slot and shared surface-radius role
for both panel layers. Structured hint typography keeps a semibold heading,
muted supporting text and a separate action. Toast close uses the native minimal
action slot with the shared X icon. Each status also has an auto-dismiss example
with no close action and the native four-second timeout, including native hover
and focus pause behavior.

Charts use the native renderer for every catalog variant and state: bars,
lines, area, stacked bars, long-label comparisons, pie, donut and heatmap.
Choose a type for the question being answered; keep units, period, complete
labels and the native table view available. The loaded theme supplies the six
series roles and readable primary/secondary chart text. The themed specimens
author their explicit range and matrix palettes from those same loaded values.
Independent fixture palettes and explicit producer metadata remain intact.
Legacy chat chart fences also consume these semantic roles for their default
palette, axes, legend and tooltip. Explicit authored palettes must be selected
from the approved workspace library by their producer.

Charts and Metrics have native examples at full report width, 560px split
width and 320px chat width. Metrics reuse report KPI blocks and distinguish
zero, unavailable, failed and long values. The document report root supplies
the existing container-query boundary so metric groups stack inside narrow
panels independently of the browser width.


### DS2 export menus

When an authored List Page supplies Actions and a native export, compose Export
inside Actions. Keep Actions available without selection while row operations
retain their original permission and selection rules. Export, CSV and XLSX are
text-only options; Export keeps its trailing Lucide chevron, vertically centered
with the label in the standard menu row. Standalone Export also uses text and a
trailing chevron. Preserve native hover/focus submenus, the shared anchored-panel
gap, keyboard-only inset focus, and pointer activation without a ring or shadow.
Keep the native exporter mounted through menu dismissal and preserve formats,
scope, file naming, column order, limits and error announcements. Baseline keeps
its existing icons and presentation.

### Shared action-menu trigger adoption

Dropdown Menu composes the existing Secondary Button for outlined action
triggers. Pages reuse that variant’s default, hover, pressed/open and disabled
semantic colors and borders, content width, 40px control height, 8px radius,
16px inline padding and 8px icon gap. Native aria-expanded retains the pressed
appearance until the owning menu closes. Ghost and field selectors retain their
own documented variants; List Page must not stretch Actions to field width.
Creation and Actions use spacing-4 (16px), including grouped operations.
Pointer/touch adds no focus decoration; native keyboard modality retains the
shared inset indicator in both modes. Baseline and legacy remain unchanged.

Table Export reuses native MenuItem and the shared 8px panel gap. Its native
collision handling prefers right, then left; vertical shifting keeps the options
within a short viewport before vertical fallback is considered. This setting
belongs to Table Export only; ordinary menu limits and navigation rules stay
with their own components. The transparent hover surface keeps constant geometry
during a flip; only the inner panel aligns to its opening direction. Blueprint’s
300ms hover-close delay permits pointer transit to CSV/XLSX without a second
listener, state owner or timing mechanism. Leaving both surfaces closes the
submenu normally. Keep native option activation, disabled admission, Escape
and focus return. Catalog and consumers load the exact exported Global CSS
definition and retain its revision/hash receipt.

### Left-navigation flyout limits and foreground

In DS2 only, direct destinations and menu categories share the navigation
semantic default foreground for both Lucide icon and label. Hover, current
destination, open, disabled and inset keyboard focus retain their independent
native states. An unselected category retains hover styling while its menu is open.
Only its native current destination selects it.

Only left-navigation flyouts remove the shared menu row cap. Show every current
category destination together while retaining the existing outer viewport
constraint and native collision placement. Other menus, field selectors,
filters and date pickers keep their defined limits. Verify both color modes,
real pointer and Tab/Shift+Tab, and restoration of Baseline and legacy themes.

### Left-navigation state contract

Side Nav exposes Fixed rail with one level of category options. There is no
nested-menu variant in this component.

Default, hover and selected are distinct states. Default uses a transparent
background and navigation foreground. Hover uses the neutral navigation
background with semantic blue for both Lucide icon and label. An unselected
category retains that hover treatment while its menu is open. Only the native
current destination (`aria-current`) selects its category after a destination
is chosen; opening or focusing its menu does not select it. The current category
keeps its selected treatment when another category is open.

This is a left-navigation category exception to the ordinary ghost-dropdown
open-state policy. Other dropdowns and settings panels retain their own
documented behavior. Keep the shared 2px menu-row gap; only left-navigation
flyouts omit the ordinary row cap, retaining the outer viewport constraint.

Check default, hover, pressed, open, selected, disabled, validation and keyboard
states wherever the component supports them. Compare each component with its
own catalog specification on the actual consumer in both color modes; retain
the native pointer and inset keyboard-focus behavior and every other theme.
