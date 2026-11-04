# Report filter choice presence

`ReportFilterBar` choice controls may declare `emptySelection: 'none'` when the
host and producer distinguish a supplied empty array from an omitted filter:

```jsx
<ReportFilterBar
  controls={[{id: 'items', label: 'Available items', kind: 'choice',
    dataSourceId: 'itemChoices', emptySelection: 'none'}]}
  values={{items: []}}
  onChange={onChange}
  loadChoices={loadChoices}
/>
```

An explicitly present `[]` displays `(None)`, preserving the existing opted-in
summary for both optional and required controls. For optional controls, omitted,
undefined and null values display `(All)`; required controls retain the existing
`Choose available items` prompt for those values. A nonempty selection retains
its selected count. Controls without the policy keep their existing appearance.
Loading and error states keep their existing text and retry behavior. The summary
always retains the full control label as its accessible name, and opening or
reopening the picker does not edit its controlled value.

The host owns preserving presence on Apply and omitting dependent selections on
context reset. The producer owns empty-set filtering and validation. This display
policy does not supply defaults, change choice domains, relax required choices,
or grant execution authority.
