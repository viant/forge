# Ordered calculation pipelines

Calculated fields form one dependency graph across row and table calculations.
A row expression may reference a table result; a table source, partition, or order
field may reference a row calculation. Fields run after their calculated
dependencies. Cross-field cycles are rejected before rows are changed. A field
may still refer to its own input value when deliberately replacing that key.
Existing delta, moving-average, running-total, percentage and dense-rank rules
retain their existing semantics.

`lag` requires `sourceField` and `orderBy`. `offset` defaults to 1 and is an integer
from 1 through 10000. It refers to prior row positions, including NULL-valued rows;
missing or NULL prior values produce NULL. It does not skip NULL rows. Equal
order keys retain input order; authors may supply explicit secondary order keys.
No domain-specific tie policy is implied.

`windowMax` requires an explicit frame:

- `frame: {type: "full"}` uses all supplied rows in each partition.
- `frame: {type: "rows", preceding: 2, following: 0}` requires `orderBy` and uses
  the current row plus the declared bounded preceding/following row positions.

Both operations accept `partitionBy`. Omitting it means the entire supplied,
selected dataset, never the warehouse or another source. `windowMax` excludes
nonfinite and NULL values; an empty numeric window returns NULL. Bounds are
nonnegative integers up to 10000. The caller owns data completeness and the trusted
execution scope; a calculation does not fetch additional rows or extend access.

For example a row expression may use an authored `previous` lag and explicit
`peak` window maximum. The functions implement only these declared mechanics;
they establish no business formula, first-row policy, source partition, NULL
fallback or tie policy. Those remain with the authored definition and producer.

The report builder exposes both functions in **Add Table Calculation**. Choose a
source field, partition dimensions and ordered fields (including secondary tie
keys). Lag exposes an offset of 1–10,000. Window Maximum requires an explicit
Full Partition or Bounded Rows frame; bounded frames expose preceding and
following counts of 0–10,000. Full partitions may retain optional ordering.
Reopening these definitions preserves every order key/direction, dataset scope
and output key. Row-calculation authoring also accepts table results and validates
the combined dependency graph before saving.

## Calculation identity and dataset scope

A declared `datasetRef` is preserved through builder documents, saved JSON,
lowering, fill and print. The normalizer option supplies a default only when the
definition does not declare one. Field IDs and output keys are aliases within
their dataset: two datasets may use the same output key or ID with different
formulas. Dependencies resolve against calculations in the same dataset; fields
from another dataset do not supply local calculation dependencies.

Within a dataset, duplicate IDs, duplicate keys, and ID/key alias collisions are
invalid. An unscoped fill calculation applies to all datasets, so its aliases
must not overlap scoped calculations. Validation reports the conflicting alias,
dataset, and calculation IDs instead of choosing one definition. A builder
selection without a dataset context must identify a unique calculation alias;
use a unique ID when multiple datasets share an output key.
