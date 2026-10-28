# Proportional report groups

`compositeBlock` retains nested groups through native screen and canonical print.
Use `stack` for a vertical group. A `responsiveGrid` can declare positive relative
weights keyed by its child block IDs:

```json
{
  "id": "summary",
  "kind": "compositeBlock",
  "title": "Summary",
  "layout": "responsiveGrid",
  "childBlockIds": ["counts", "trend"],
  "runtime": {
    "chrome": "none",
    "childWeights": {"counts": 1, "trend": 3}
  }
}
```

Weights describe each child's share of available width after the native gap.
Every declared child needs a finite positive weight. Hiding a child preserves
the identity and relative weights of the remaining children. At phone widths,
the existing responsive column policy stacks content. The print renderer uses
the same weights and permits tall nested columns to continue on later pages.
Screen and print both stack a weighted row when any content track would be less
than 240 units wide. An explicit `runtime.minColumnWidth` overrides that default
(minimum 40) for deliberately compact groups. Each nested screen group measures
its own available width. The metadata does not impose fixed heights on charts or
clip their content.

`chrome: "none"` suppresses container decoration and its layout-only title.
An empty composite with `runtime: {"chrome":"none","spacerHeight":8}` reserves
eight units of vertical space, including print; ordinary empty composites remain
invalid. A zero-height spacer can reserve a weighted horizontal track. This is
layout metadata, not an invisible data block.

The fixtures and tests are independently authored synthetic examples. Run:

```
node --no-warnings src/reporting/reportCompositeLayout.test.js
node --no-warnings node_modules/vite-node/vite-node.mjs src/components/dashboard/ReportRuntime.composite.test.jsx
```

# Tooltip text templates

An optional `tooltip.lines` is a list of lines, each containing `{text: "..."}`
or `{field: "admittedField"}` segments. Fields must also appear in `tooltip.fields`
with their explicit format and aggregation. Repeated references and static-only
templates are supported; text is rendered as text, never HTML or executable code.
Native hover, the accessible inspector, ReportFill and canonical print retain
the same resolved lines. Limits are 16 fields, 64 lines and 128 segments per line.

# Complete-partition percentages

The existing `percentOfTotal` table computation accepts `nullPolicy: "null"`
to preserve NULL inputs and zero denominators, and `requireComplete: true` to
reject incomplete producer results. The latter requires explicit `hasMore:false`
and rejects truncation in payload or provenance. Compute over the full admitted
filtered partition before presentation paging; never use a visible page as its
denominator. Existing calculations retain their default zero behavior.
