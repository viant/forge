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
