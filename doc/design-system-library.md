# Steward AI design-system library

Forge is the canonical implementation library for Steward AI. Agently and
Steward AI are consumers and composers; they do not create competing versions
of shared components or patterns.

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

Theme values are published by Steward’s managed style catalog. Forge consumes
the resulting `--forge-*` roles and supplies neutral fallbacks for standalone
previews.

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
patterns into the application shell. Steward AI selects the patterns in
product metadata and publishes the semantic catalog values. A token-value
change can flow through the catalog without a Forge code release; a component
or pattern behavior change requires a Forge release followed by consumer
updates.

The installed Forge version must be treated as the production truth. Local
worktree previews are review artifacts until the Forge package and consuming
applications are released and verified together.

The canonical Design System 2.0 variable visualizer is generated from
Steward’s token export at
`steward_ai/deployment/steward/extension/forge/styles/tokens/design-system.tokens.json`.
It exposes the complete Global → Alias → Semantic graph, resolved Light/Dark
values, typography and geometry scales, and a shared component recipe. It is a
review artifact, not a second runtime token source.
