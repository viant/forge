# Table Formatting Rules

Tables can color rows or cells from explicit metadata. Rules match a named field
on the row data and never infer status from labels or display text.

```yaml
table:
  formattingRules:
    - field: status
      target: cell
      operator: equals
      value: loading
      style:
        backgroundColor: "#edf4ff"
        color: "#1757bc"

    - field: status
      target: row
      operator: in
      values: [failed, error]
      className: forge-table-tone-danger
```

Rule fields:

- `field`: Row field to inspect. Dot paths are supported, for example `job.status`.
- `target`: `cell` colors the matching field column; `row` colors every cell in the row. Defaults to `row`.
- `operator`: `equals`, `notEquals`, `in`, or `contains`. Defaults to `equals`.
- `value` / `values`: Expected value or values.
- `style`: CSS style object applied to the rendered cell.
- `className`: CSS class applied in addition to the style. Built-in tone classes are `forge-table-tone-info`, `forge-table-tone-success`, `forge-table-tone-warning`, and `forge-table-tone-danger`.

## Link Columns

Links are explicit in column metadata. Use the display field as the column key,
then point `link.href` at the exact row field that contains the URL.

```yaml
table:
  columns:
    - id: customerName
      name: Customer
      type: link
      link:
        href: customerUrl

dashboard:
  table:
    columns:
      - key: city
        label: City
        type: link
        link:
          href: cityDashboardUrl
```

The row can also emit a structured link value directly:

```json
{
  "city": {
    "href": "https://example.com/demo/dma/seattle",
    "label": "Seattle"
  }
}
```
