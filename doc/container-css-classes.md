# Metadata-authored Forge CSS classes

YAML references generic classes; Forge supplies their definitions. No workspace
CSS or inline `style` is required for the following supported variants.

| Metadata location | Class | Contract |
| --- | --- | --- |
| Container `className` | `forge-container-hidden` | Hide the outer surface; keep children mounted and datasource effects active. Does not grant/revoke permission or substitute for visibility/authorization rules. |
| Container `className` | `forge-fields-between` | Normal fields group uses a wrapping horizontal row with spaced ends, centered alignment, and the standard 8px gap. Not a replacement for an authored grid/split layout. |
| Container `className` | `forge-container-plain` | No border, shadow, or background on the outer surface. |
| Container `className` | `forge-container-subtle` | One neutral border and surface, without a shadow. |
| Toolbar item `className` | `forge-action-icon` | 32px icon hit area; 44px with coarse pointer. Pair with icon, hideLabel, ariaLabel and tooltip. Does not supply business behavior or hide text by itself. |

`container.className` is placed once on the outermost owned surface: plain root,
Card, or Section. Nested Card/Section composition does not duplicate the authored
class on each layer. `card.className` and `section.properties.className` remain
component-specific additions. Previously authored container classes appeared on
an inner framed body; selectors expecting that old location must migrate.

Owned classes: `forge-container`, `forge-container-card`,
`forge-container-section`, `forge-container-body`. Owned part attributes:
`data-forge-part=container-card`, `container-section`, `container-body`,
`container-content`, and `fields`. The logical `data-forge-container-id` anchor
remains available on the content body for framed containers and plain root.

## Semantic section contracts

Prefer the bounded Section contract over adding a product-specific class when
the requirement describes reusable hierarchy:

```yaml
id: workArea
title: Work area
section:
  appearance: primary
  contentInset: flush

containers:
  - id: details
    title: Details
    section: { appearance: quiet }
```

Supported `section.appearance` values are:

| Value | Semantic role |
| --- | --- |
| `primary` | A major bounded work surface that owns its heading and body. |
| `quiet` | A subordinate subsection that relies on heading, proximity, and a divider instead of another decorative card. |

Values are trimmed and compared case-insensitively. Unsupported or omitted
values preserve the existing Section output and do not emit an appearance
attribute. Supported values emit
`data-forge-section-appearance="primary|quiet"` on the outer Section. Existing
`section.properties.className` remains available and is not replaced.

`section.contentInset` is a separate bounded layout role. The only supported
value is `flush`. It marks a Section whose content owns its internal spacing and
can therefore meet the Section boundary without an additional theme-authored
body inset. Supported values emit
`data-forge-section-content-inset="flush"` on the outer Section. Values are
trimmed and compared case-insensitively. Unsupported or omitted values emit no
attribute and preserve the existing Section output.

The semantic attributes do not alter default visuals. An opt-in theme selects
their tokenized surface, spacing, divider, and responsive treatment. This keeps
legacy and production themes unchanged while allowing a workspace to adopt the
same component contract deliberately.

Forge consumes optional appearance-specific header tokens after its generic
section rule, so the role remains stable regardless of stylesheet injection
order. `--forge-section-primary-header-surface`,
`--forge-section-primary-header-font-size`, and
`--forge-section-primary-header-line-height` refine primary headers;
`--forge-section-quiet-header-surface`,
`--forge-section-quiet-header-font-size`, and
`--forge-section-quiet-header-line-height` refine quiet headers. Each falls back
to the generic section-header role when a theme does not provide it, preserving
existing visuals. A theme can therefore make a quiet subsection transparent
without flattening every section header in the workspace.

When quiet sections are direct children of a grid using
`layout.appearance: divided-sections`, Forge also places
`data-forge-grid-item-section-appearance="quiet"` on each owned grid-item
wrapper. Themes can therefore draw peer dividers without `:has()`, child IDs,
or positional selectors.

Hidden presentation suppresses rendering only through CSS. There is no hidden
class branch that skips children, datasource registration, or fetching. The
sizing helper omits inline display on that outer boundary so the core class can
hide it without `!important`. Do not use it for sensitive authorization gating.

Use `sizingMode`, `layout`, `tabs.fill`, `table.density`, and chart extent fields
for geometry. Do not encode arbitrary per-window pixel heights as class names.

```yaml
id: lookupBindings
className: forge-container-hidden
fetchData: true
dataSourceRef: lookup

# A separate toolbar item:
# className: forge-action-icon
# icon: undo
# hideLabel: true
# ariaLabel: Reset changes
# tooltip: Reset changes
```

Conditional table formatting accepts `formattingRules[].className` on row or
cell rules. Generic supported classes: `forge-table-tone-muted`,
`forge-table-tone-warning`, `forge-table-emphasis`. These replace inline
color/background/fontWeight rules. They do not alter selection, sort order,
permissions, or row geometry. Tone colors use the corresponding
`--forge-table-muted-*` / `--forge-table-warning-*` CSS appearance tokens.

Field actions support `item.className: forge-action-icon` through the default
Blueprint button widget. This variant leaves min-height/min-width/padding to
the class rather than inline defaults. Explicit inline styles still override
it for backward compatibility, but YAML class users do not need them.
Mutation commands support `mutationCommand.className: forge-action-icon` on the
actual button, retained by the Go model; keep `icon`, `hideLabel`, and `label`
for accessible naming. Command handlers, confirmation, validation and pending
state are unaffected.

Responsive form grids: prefer `layout.collapseAt: phone`, or explicitly author
`className: forge-grid-collapse-phone` on the grid-owning container. Both reach
the actual GridLayoutRenderer grid. This is an intentional exception to the
outer-surface-only class rule: grid rendering also receives container.className.
At viewport widths <=600px, tracks and child spans collapse to one column. Apply
the hook to the outer layout grid AND inner field grids that must stack; changing
only a nested field grid does not remove its parent's desktop columnSpan.
`forge-responsive-grid` belongs to the responsive table wrapper and should not be
used as a generic form-grid class.
