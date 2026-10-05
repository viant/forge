# Grid Layout (Auto-Placement)

Forge now supports an explicit grid layout mode with auto-placement, colspan, and rowspan, while staying fully backward-compatible with the legacy flow layout.

Key points
- Activate with `container.layout.kind: "grid"`. Legacy containers (no `kind`) render unchanged.
- Provide `layout.columns` (required). Rows are inferred as items are placed.
- No explicit `row`/`col` per item. The engine places items in reading order, honoring `columnSpan` and `rowSpan` (both default to `1`).
- Labels default to dedicated cells on the left (`labels.mode = "left"`). Options: `"top"` or `"none"`.
- If labels are separate cells, wrappers do not render labels to avoid duplication.

Label modes
- `left` (default): CSS columns are doubled. For each logical column, we render a label column then a control column.
  - Control col start = `2*c`; control col span = `2*columnSpan - 1`.
  - Label sits at `2*c - 1` with span `1` across the same rows as the control.
  - If `hideLabel` or `isStandalone`, the control fills both columns: start `2*c - 1`, span `2*columnSpan`.
- `top`: CSS rows are doubled. For each logical row, we render a label row then a control row.
  - Control row start = `2*r`; control row span = `2*rowSpan - 1`.
  - Label sits at `2*r - 1` with span `1` across the same columns as the control.
- `none`: Labels render inside wrappers as today; grid has standard tracks (no doubling).

Container fields
```yaml
layout:
  kind: grid            # enables the new engine
  appearance: divided-sections # optional bounded semantic appearance
  columns: 5            # required
  labels:               # optional; defaults to {mode: left}
    mode: left          # left | top | none
    width: 160px        # (left mode) label column width; default max-content
    align: baseline     # baseline | center | start; see alignment contract below
    controlGap: 8       # px; extra space between label and control within a pair
    height: auto        # (top mode)
  gap: 12               # optional; can also use rowGap/columnGap
```

Layout appearance contract
- `layout.appearance` is optional. For a Container grid, the only supported
  value is `divided-sections`, for a grid whose direct entries are peer
  subsections sharing one parent surface. SchemaBasedForm owns a separate
  `field-tracks` appearance documented in [widgets.md](widgets.md).
- Values are trimmed and compared case-insensitively. Unsupported values are
  omitted rather than passed through as CSS hooks.
- Every rendered grid exposes `data-forge-part="grid"`. A supported appearance
  additionally exposes `data-forge-layout-appearance="divided-sections"`.
- Nested-container grid entries expose `data-forge-part="grid-item"`. When the
  child uses a supported `section.appearance`, its wrapper also exposes
  `data-forge-grid-item-section-appearance="primary|quiet"`.
- These attributes are stable semantic hooks. They do not change default
  visuals by themselves. An opt-in theme can use them to add tokenized
  dividers or responsive stacking without inspecting child IDs, order, or
  generated Blueprint markup.

```yaml
section: { appearance: primary, contentInset: flush }
layout:
  kind: grid
  appearance: divided-sections
  columns: 2
  labels: { mode: none }
containers:
  - id: firstGroup
    title: First group
    section: { appearance: quiet }
  - id: secondGroup
    title: Second group
    section: { appearance: quiet }
```

Alignment contract
- `baseline` is the default for `left` labels. Use it for text-to-text pairs.
  It aligns a label with the first line of either a single-line or multiline
  value, while later lines grow downward.
- `center` is an explicit container-level opt-in for rows whose values are
  compact controls and should share one control track.
- `start` is for mixed or non-text content that has no meaningful shared text
  baseline. `top` and `none` label modes use start alignment for their grid
  tracks by default.
- Alignment values are a bounded semantic vocabulary. The web renderer trims
  whitespace, compares values case-insensitively, and accepts only `baseline`,
  `center`, or `start`. Unknown values do not pass through to CSS; they use the
  label mode's documented default.
- Set alignment once with `layout.labels.align`. Do not compensate with
  per-item offsets or field-ID selectors. Theme CSS should preserve the
  renderer's label and control-cell alignment unless it intentionally changes
  the semantic alignment of the entire container.

Verification
- `npm run test:grid-layout-alignment` checks bounded alignment, layout and
  section appearances, Section content inset, semantic grid/item hooks, an
  actual server-rendered multiline label/value pair, and the real Container
  integration that emits these attributes.
- The same contract runs automatically as part of the default `npm test` gate.

Item fields (unchanged unless noted)
- `columnSpan?: number` (default 1)
- `rowSpan?: number` (default 1)
- `hideLabel?: boolean` (when true, label cell is not rendered)
- `isStandalone?: boolean` (label suppressed; control spans label+control columns)
- No `row`/`col` are needed or used in this mode.

Example
```yaml
id: sample
layout:
  kind: grid
  columns: 5
  labels: { mode: left }
items:
  - id: a
    label: A
  - id: b
    label: B
  - id: c
    label: C
    columnSpan: 2
  - id: d
    label: D
    rowSpan: 2
  - id: e
    label: E
```

Behavior
- Items are placed left→right, top→bottom, skipping occupied cells from prior spans.
- If an item’s `columnSpan` exceeds `layout.columns`, it is clamped and a dev warning is logged.
- The grid grows vertically as needed; you don’t need to specify `rows`.

Backward compatibility
- Containers without `layout.kind: "grid"` (or with any other value) continue to render using the legacy flow layout (`layout.columns` + `columnSpan` only; labels via wrappers).

Migration tips
- Start by adding `layout.kind: "grid"` and `columns` to a container.
- Keep item order and add `columnSpan`/`rowSpan` only where needed.
- If you prefer wrappers to render labels, set `labels.mode: "none"`.
