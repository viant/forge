# Forge built-in widgets (Blueprint pack)

This page lists the widgets that ship with Forge’s default **Blueprint** pack.  Each widget can be referenced by its *widget key* in form/item descriptors, or is selected automatically by the widget classifier.

| Key               | Renders                             | Notes |
|-------------------|--------------------------------------|-------|
| `text`            | `<InputGroup>`                       | Plain single-line text input. |
| `textarea`        | `<TextArea>`                         | Multi-line text area. |
| `number`          | `<NumericInput>`                     | Accepts numbers; arrow keys to step. |
| `currency`        | `<NumericInput leftIcon="dollar">`  | Same component with currency styling. |
| `checkbox`        | `<Checkbox>`                         | Boolean field. |
| `toggle`          | `<Switch>`                           | Alternative on/off UI. |
| `select`          | `<Select>`                           | Single-select dropdown; options array required. |
| `treeMultiSelect` | `TreeMultiSelect` custom component   | Hierarchical multi-select. |
| `date` / `dateTime` | `<DateInput3>`                     | Chosen automatically when `format: date` etc. |
| `link`            | `<AnchorButton>`                     | Read-only URL link. |
| `label`           | `<Label>`                            | Static label (non-interactive). |
| `button`          | `<Button>`                           | Action button inside forms/toolbars. |
| `progressBar`     | `<ProgressBar>`                      | Read-only progress indicator (0–1). |
| `math`            | `<InputGroup>`                       | Lightweight formula/LaTeX text input. |
| `markdown`        | `MarkdownView`                       | Renders Markdown text; use `type: markdown` or `format: markdown`. |

> **Tip**   You can override any widget or add new ones at runtime – see [widget-runtime.md](widget-runtime.md).

## Example descriptor

```yaml
items:
  - id: firstName
    label: First name
    type: text               # → widget "text"

  - id: role
    label: Role
    widget: select           # explicit widget key
    options:
      - { value: admin,  label: Admin }
      - { value: author, label: Author }

  - id: maths
    label: Favourite formula
    widget: math
```

## Overriding an existing widget

```js
import { registerWidget } from 'forge/runtime/widgetRegistry';
import MyCoolSelect from './MyCoolSelect.jsx';

// Replace Blueprint Select with custom component globally
registerWidget('select', MyCoolSelect, { framework: 'mui' });
```

## Adding a brand-new widget

```js
registerWidget('rating', StarRating);

registerClassifier((item) => {
  if (item.format === 'rating') return 'rating';
});
```

The classifier ensures descriptors that specify `format: rating` automatically
pick up the new widget.

## SchemaBasedForm field tracks

`SchemaBasedForm` keeps its existing two-column renderer unless a form opts in
to the bounded `field-tracks` appearance. Use the opt-in when several fields
should share label, control, helper, and logical row tracks.

```yaml
schemaBasedForm:
  id: campaignEditor
  layout:
    kind: grid
    appearance: field-tracks
    columns: 2
    labels:
      mode: top
      align: start
    collapseAt: phone
  fields:
    - { name: advertiserId, label: Advertiser, widget: lookup }
    - { name: objective, label: Objective, widget: select }
```

The contract is intentionally small:

- `kind` must be `grid` and `appearance` must be `field-tracks`.
- `columns` is clamped to 1 through 12.
- `labels.mode` accepts `left`, `top`, or `none`, and defaults to `top`.
- `labels.align` uses the grid alignment vocabulary from
  [grid-layout.md](grid-layout.md).
- `collapseAt: phone` stacks all label and control cells when the form container
  is 600px wide or narrower. The viewport rule remains as a compatibility
  fallback.
- Field order is preserved. Dense backfilling is disabled for form reading and
  keyboard order.

Forge owns the anatomy and responsive behavior. It emits
`data-forge-part="form|grid|label|control|helper-text|validation-message|form-actions"`,
`data-forge-form-appearance="field-tracks"`, and a shared
`data-forge-field-id` on each label and control cell. Lookup fields use the same
label and control anatomy as every other widget. Themes should use these hooks
instead of field IDs, child positions, or generated Blueprint classes.

Themes may set the shared field-track tokens on the opt-in form or a theme
ancestor:

| Token | Default | Purpose |
| --- | --- | --- |
| `--forge-form-column-gap` | `20px` | Space between logical field columns. |
| `--forge-form-row-gap` | `16px` | Space between logical field rows. |
| `--forge-form-label-control-gap` | `8px` | Space between a field label and its control. |
| `--forge-form-control-height` | `40px` | Desktop height for primary data-entry controls. |
| `--forge-form-control-padding-inline` | `12px` | Shared horizontal control inset. |

Container width controls when field tracks stack, while the actual viewport
controls phone-sized geometry. At phone viewport widths, Forge provides 44px
interactive targets and 16px input text. A narrow subsection inside a wide
desktop workspace therefore keeps the 40px desktop control scale instead of
being mistaken for a touch layout.
Labels use native `for` relationships. Required and invalid states are exposed
with `aria-required`, `aria-invalid`, `aria-describedby`, and alert semantics
for validation messages. Text, number, select, date range, boolean pill, and
lookup controls share `--forge-form-control-height` on desktop. Data-entry
controls fill their assigned field track by default; `fill: false` is the
explicit compact escape hatch for metadata that genuinely calls for it.
Field-track number and currency controls omit pointer-sized spinner buttons but
keep native keyboard stepping. Their field-track
appearance uses the existing semantic control, focus, disabled, and danger
tokens. Composite date ranges label the group and keep the visible field label
targeted to the start-date input.

Field-track selects expose stable target, portal, popover, menu, and option
classes owned by Forge. Their trigger text is left-aligned and ellipsized,
selected options use listbox semantics, and lists with ten or more options gain
search and a clear empty-result state. The menu matches the trigger, is bounded
to the viewport, and uses the same semantic surface, text, interaction, focus,
and overlay tokens as the rest of the workspace. Legacy selects remain
unchanged. A browse-only field-track lookup uses the same single-trigger
anatomy, with one outer border, one focus target, and an integrated trailing
caret. Lookups that also accept manual text keep their composite input and
separate browse or commit action because those are distinct interactions.
Dashboard lookup metadata may set `interactionMode: search` for a neutral,
integrated search action. Search mode keeps the text field available while a
request is busy, links loading and error feedback to the field, clears stale
results when the query is cleared, cancels an older request when a newer query
starts, announces selected counts, and labels capped local results truthfully.
Action-bearing results use list and list-item semantics rather than pretending
to be a keyboard-managed listbox. Omitting the mode preserves the legacy
appearance.

Omitting the appearance, using an unsupported appearance, or using a non-grid
kind follows the legacy SchemaBasedForm markup and visuals. This makes the
contract safe for theme-by-theme adoption.

Run `npm run test:schema-form-layout` to verify normalization, semantic hooks,
lookup anatomy, responsive CSS, accessibility state, and legacy fallback.

---

*Last updated: 2026-10-05*
