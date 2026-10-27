# Compound report visibility

Report blocks may combine independent runtime conditions with `all`. Every child
must match; leaf selectors and comparisons retain their existing behavior.

```yaml
runtime:
  visibleWhen:
    all:
      - selector: dashboard.filters.mode
        equals: detail
      - source: metrics
        selector: ready
        equals: true
```

Children may themselves contain `all`. Selection/filter selector prefixes are
normalized at every level. Web rendering and server-generated print evaluate the
same condition model. Display values such as numeric zero and boolean false are
preserved without truthiness coercion.

An empty/non-array `all`, invalid child type, more than 32 direct children,
nesting beyond 16 levels, or evaluation beyond 128 nodes hides the block. Existing
single-selector conditions and an absent condition remain compatible. Conditions
control presentation only; they do not grant data access or replace producer
authorization.
