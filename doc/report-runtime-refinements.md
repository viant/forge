# Portable runtime refinement fields

The trusted ReportDocument lowerer retains dimension filter bindings on their
owning table and chart blocks as `runtime.refinementFields`. Hosts can inspect
these mappings in a portable ReportSpec without retaining its builder source.
A chart-only dataset does not need an evidence table to admit a selection.

```yaml
runtime:
  refinementFields:
    - key: region
      sourceKey: region
      displayKey: region
      label: Region
      runtimeFilter:
        includeParamPath: filters.values.regions
```

Each field has a key, optional source/display keys and label, and a runtimeFilter.
The filter supports the existing includeParamPath (or paramPath), excludeParamPath,
format and parentField metadata. Paths must be explicit safe `filters.*` paths;
include and exclude cannot target the same path. Prototype, backend and source
segments, unknown properties, duplicate aliases and ambiguous declarations do
not admit an action. The catalog is bounded to 256 fields per block. The normal
runtime metadata normalizer and ReportSpec validator validate this small shape;
runtime lookups also fail closed on malformed catalogs.

Generated entries come only from dimensions declared for that block's logical
dataset and referenced by the block. A same-named field on another dataset or
another producer is never a fallback. An explicit empty catalog admits no fields.
Omitting the authored catalog generates entries from the owning dataset. An
explicit nonempty catalog can only select a subset of those exact declared
bindings; an undeclared field or altered path is rejected during lowering.
Older ReportSpecs without this property retain the existing table-column lookup.

These bindings describe selection capability, not business authorization. A host
still forwards only producer-admitted inputs through its existing execution
contract. The producer validates every request. Selecting a mark displays the
available authored actions; it does not automatically apply a Keep or Exclude.
