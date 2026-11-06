# Numeric table tones

A tone cell can use `cellVisual.colorField` to select its existing rules from a
separate field. The column keeps its ordinary display value and format. The
[independent synthetic example](examples/colored-numeric-tone.json) shows a
measurement changing from danger to success while displaying `123.46` in both
states. It uses the existing semantic tone and optional explicit paint rules.
`colorField` uses the existing field selector: `assessment.status` reads the
nested status property. Literal keys containing dots are not selector fallbacks.

Missing or unmatched status values leave the normal cell appearance. Rules can
match an explicit null status. A null measurement retains the normal unavailable
value display, even when its status matches. Blank or whitespace-only display
values keep an ordinary empty cell unless the matching rule supplies a label. A nonempty rule `label` deliberately
overrides the visible text, including canonical PDF and visual XLSX. CSV and XLSX
source sheets retain the original values and precision.

Without `colorField`, tone and badge keep their existing raw-value rule matching
and label behavior. `colorField` is supported by tone and the existing dataBar,
progressBar and sparkBar kinds; it is not supported by badge, delta or rank.

Run the example through the real table, fill, schema, CSV and print paths with:

```sh
node --no-warnings ./node_modules/vite-node/vite-node.mjs src/components/dashboard/reportTableNumericTone.render.test.mjs
```

The [calculated tone example](examples/calculated-numeric-tone.json) references
a calculated status only from `colorField`. Lowering retains its expression and
rank dependencies and requests their native inputs; unrelated calculations and
fields remain pruned.

Native PDF and XLSX coverage lives in
`backend/reporting/export/xlsx/numeric_tone_test.go`.
