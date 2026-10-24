# Native producer criteria

An MCP reader with a string `Criteria` selector can consume named Forge filters
through an explicit backend mapping. This changes transport arguments only; the
producer still validates criteria and authorizes every read.

```yaml
filterMode: server
filterSet:
  - name: quick
    default: true
    template:
      - {id: Name, label: Name, operator: producer, type: string}
      - {id: Radius, label: Radius, operator: equal, type: int}
backend:
  kind: mcp_tool
  service: platform
  method: LocationList
  criteriaMapping:
    parameter: Criteria
    fields:
      - {input: Name, field: NAME, operator: contains, type: string}
      - {input: Radius, field: RADIUS, operator: equal, type: int}
```

Mappings accept literal top-level input names and authored column identifiers.
Operators are `equal`, `contains`, and `in`; types are `string`, `int`, `number`,
and `bool`. `in` consumes an already typed array. Invalid types, columns,
operators, duplicate inputs, and caller-supplied criteria fail before dispatch.
Missing/null/empty filters are omitted; zero and false remain predicates. Contains
escapes LIKE wildcard characters rather than treating user text as a pattern.

Mapped fields stay in the logical request and cache identity. Only the MCP
arguments consume those fields and receive the generated selector. A criteria
fingerprint also partitions caches with an explicit key policy. Reset removes
the generated selector. A pinned base criteria expression is combined with the
generated predicates; callers cannot replace it. Existing bindings without this
optional mapping retain their transport behavior.

Use `operator: producer` for a contains text control so the UI does not wrap the
value in wildcard characters before serialization. Continue declaring the
producer's actual paging/count selectors and required field projection.

String literals use SQL quote doubling. A producer must support that literal
grammar. The deployed legacy Datly0.39 Criteria parser rejects embedded quoted
strings. Bind those producers with `literalGrammar: simple` to reject quoted
values before dispatch; such values remain unsupported until that parser is upgraded.
Do not claim support for those values from a successful unquoted-name test.
