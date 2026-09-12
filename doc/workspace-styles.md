# Workspace styles and appearance

Use metadata `className` plus external CSS for repeatable presentation. Prefer
Forge's semantic classes and owned part attributes over generated IDs or broad
Blueprint selectors. See [CSS classes](container-css-classes.md) and
[container layout](container-layout.md). Do not replace layout metadata with CSS
pixel heights or use presentation classes as authorization rules.

## Built-in appearance and named themes

Forge default is the framework fallback, with restrained pastel surfaces: blue
table headers/selection, lavender section headings, and light blue actions.
It is selected when no named workspace theme is active. Classic and Slate are
workspace-defined themes, not mandatory framework presets.

A theme and a color mode are different settings. A theme chooses tokens and
optional CSS; `light` and `dark` choose its palette. `system` follows OS appearance
and resolves to one of those two modes. System and Light should look identical
when the OS uses light mode; System is not a third palette.

The Agently host reads `extension/forge/styles/manifest.yaml`. Minimal example:

```yaml
version: 1
defaultTheme: slate
defaultMode: system
files: [shared.css]
themes:
  - id: slate
    label: Slate
    fallbackMode: light
    tokens:
      control.minHeight: 32
      control.radius: 4
    modes:
      light:
        tokens:
          surface: '#e5edf4'
          text: '#203544'
          control.background: '#f5f8fa'
          control.foreground: '#203544'
          control.border: '#8da0ae'
          focus.color: '#2563eb'
      dark:
        tokens:
          surface: '#101c25'
          text: '#e8f1f5'
          control.background: '#20323d'
          control.foreground: '#e8f1f5'
          control.border: '#718b9c'
          focus.color: '#82aaff'
overrides: [overrides.css]
```

Paths are relative to `styles/`. Shared files load before selected theme/mode
files; `overrides` loads last. Normal CSS specificity still applies. Tokens use
literal dotted semantic names, not arbitrary CSS property keys. The host validates
and publishes style revisions; Forge consumes them at the theme boundary,
including portalled controls. An invalid update must not replace the last valid
appearance. Reload workspace appearance refreshes the host's style catalog;
built-in Forge CSS changes still need a frontend rebuild.

Scope overrides to `.agently-workspace[data-forge-window-key="advertiser"]` or
owned `data-forge-part` selectors. Avoid globally changing `.bp6-*` containers:
chat, history, and business windows have different sizing responsibilities.

Input semantics remain independent of theme identity: lookup fields use a pastel
green surface; required ordinary inputs a pastel red surface; required lookups a
green surface with red border. Focus is blue. Use `--forge-lookup-*`,
`--forge-required-*`, and `--forge-focus-color` rather than inline colors.

For the complete host manifest/token contract, see
[agently-core workspace CSS](../../agently-core/workspace-css.md). Native token support is
explicit; arbitrary web CSS does not apply to native renderers.
