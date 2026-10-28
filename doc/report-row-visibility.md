# Presentation-only row visibility

An authored block can exclude displayed members after calculations:

```json
{
  "runtime": {
    "rowVisibility": {
      "exclude": [{"field": "category", "values": ["Unclassified", null]}]
    }
  }
}
```

This affects supported chart, collection and flat-table views. It never changes
producer requests, authorization predicates, or the complete dataset used for
table calculations. For example, visible value 20 plus hidden value 80 retains
a 20% full-partition ratio. It must not silently become 100%.

Values are typed scalars; null and the string `"Unknown"` are different identities.
Field names must be safe, distinct identifiers. Missing row fields fail explicitly.
There are at most 32 excluded fields and 128 values per field.

Pie/donut hidden-angle geometry, pivots and hierarchies are not supported by this
primitive and are rejected. Hiding is not a permission control: producer-enforced
authorization must already apply to every retained dataset row. Exporting raw
dataset evidence is distinct from exporting the visible block representation.
