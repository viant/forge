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
| `math`            | `<EditableMathField>`                | MathQuill equation editor. |
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

---

*Last updated: 2025-06-29*
