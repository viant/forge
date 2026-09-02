# Forge Widget Runtime v2

This document outlines the **framework-agnostic widget system** that will power **all** interactive controls inside Forge – from Schema-based forms and chat prompts to data-grid toolbars and dialogs.

The design replaces the hard-coded switch–case in `ControlRenderer.jsx` with a modular pipeline that can host Blueprint widgets (the current default) **or** any other UI framework without touching Forge core.

---

## 1  Components & Responsibilities

| Layer | File | Purpose |
|-------|------|---------|
| **Widget registry** | `runtime/widgetRegistry.js` | Global map `key → React component factory`.  Ships with Blueprint pack pre-loaded; projects may register/override at runtime. |
| **Classifier chain** | `runtime/widgetClassifier.js` | Ordered functions that resolve an `item`/`field` descriptor to a widget key.  Default rule set mirrors today’s logic. |
| **Binding helpers** | `runtime/binding.js` | Pluggable registries for: <br>• *State adapters* – read/write value to DataSource / local state / external store.<br>• *Event adapters* – translate Forge events to widget props.<br>• *Dynamic evaluators* – run `stateEvents` (`onReadonly`, `onProperties`, `onValue`). |
| **WidgetRenderer** | `runtime/WidgetRenderer.jsx` | Glue component.<br>1. Classifies the item.<br>2. Pulls widget from registry.<br>3. Builds `props` via binding helpers.<br>4. Wraps in `ControlWrapper` for labels / grid. |
| **ControlWrapper** | `runtime/ControlWrapper.jsx` | Handles label position, inline vs stacked layout, column span etc. In grid mode with label-cells, wrappers suppress labels (labels render as separate cells). |
| **Framework packs** | `packs/blueprint/`, `packs/mui/`, … | Each pack registers widgets, event adapters and optional classifiers in a single `registerPack()` call. |

### 1.1  Key APIs

```js
// widgetRegistry.js
registerWidget(key, factory, { defaults, framework })
getWidget(key)

// widgetClassifier.js
registerClassifier(fn, { priority })  // fn(item) → widgetKey | undefined
classify(item)

// binding.js
registerStateAdapter(scope, adapter)
registerEventAdapter(widgetKey|"*", map)
registerDynamicEvaluator(name, fn)
```

All registries are additive and *last registration wins*, enabling easy overrides.

---

## 2  Default Blueprint Pack

Located at `packs/blueprint/` it re-implements the current switch-case logic as individual components (TextInput, NumericInput, …) and registers them:

```js
export function registerPack() {
  registerWidget('text',       TextInput,   { framework: 'blueprint' });
  registerWidget('number',     NumericInput,   …);
  …

  // Event mappings
  registerEventAdapter('number', {
      onChange: ({ adapter }) => v => adapter.set(v)
  });

  // Classifier for Blueprint-specific heuristics
  registerClassifier((item) => {
     if (Array.isArray(item.enum)) return 'select';
  }, { priority: 100 });
}
```

The pack is executed at boot (`registerPack();`) so existing projects get identical UX out-of-the-box.

---

## 3  Extending / Overriding

Scenario examples:

### 3.1  Add a completely new widget

```js
import { registerWidget, registerClassifier } from 'forge/runtime';
import MarkdownEditor from './MarkdownEditor.jsx';

registerWidget('markdown', MarkdownEditor);

registerClassifier((item) => {
  if (item.format === 'markdown') return 'markdown';
}, { priority: 50 });
```

### 3.2  Replace Blueprint’s `select` with MUI

```js
import { registerWidget } from 'forge/runtime/widgetRegistry';
import MUISelect from './MUISelect.jsx';

registerWidget('select', MUISelect, { framework: 'mui' }); // overrides previous key
```

### 3.3  Custom state handling (Redux)

```js
import { registerStateAdapter } from 'forge/runtime/binding';
import store from './store';

registerStateAdapter('form', (ctx, item) => ({
   get: () => store.getState().form[item.id],
   set: (v) => store.dispatch({ type: 'SET_FORM', id: item.id, value: v })
}));
```

---

## 4  Compatibility Checklist

To ensure **zero regressions** the Blueprint pack and default helpers must replicate:

1. Supported `item.type` values (text, number, numeric, currency, textarea, checkbox, toggle, …).
2. Layout behaviour: `labelPosition`, `columnSpan`, `layout.columns`, inline labels.
3. Auto-generated placeholders, `dateFnsFormat`, timePrecision defaults.
4. Dynamic `stateEvents` logic (`onValue`, `onReadonly`, `onProperties`).
5. Implicit change handlers (`dataSource.setFormField`, `setFilterValue`, …).
6. Validation: required, enum membership, default value initialisation.
7. Fallback: unresolved widget keys render legacy InputGroup and log a warning.

---

## 5  Migration Path for Core Codebase

1. Implement runtime registries (`widgetRegistry`, `widgetClassifier`, `binding`).
2. Create `WidgetRenderer` + `ControlWrapper`.
3. Port switch-case bodies from `ControlRenderer.jsx` into Blueprint components and register via `packs/blueprint`.
4. Replace `ControlRenderer` implementation with a re-export of `WidgetRenderer`.
5. Delete legacy code after external imports have migrated.

---

## 6  Future Directions

• **SSR friendly** – registry can flag widgets that require browser APIs and provide fallbacks.
• **Theming** – packs may expose `registerTheme()` to offer light/dark or brand schemes.
• **Low-code studio** – visual editor simply lists `listWidgets()` and offers drag-&-drop.

---

*Last updated: 2025-06-26*
