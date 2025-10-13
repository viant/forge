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
  columns: 5            # required
  labels:               # optional; defaults to {mode: left}
    mode: left          # left | top | none
    width: 160px        # (left mode) label column width; default max-content
    controlGap: 8       # px; extra space between label and control within a pair
    height: auto        # (top mode)
  gap: 12               # optional; can also use rowGap/columnGap
```

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
