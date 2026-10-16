# Content presentation widgets

The Blueprint pack registers three reusable widgets. They also export as React
components from `forge/components`. The host supplies records and handles
navigation; these widgets do not fetch data or decide business permissions.

| Widget | Bound value | Other properties |
| --- | --- | --- |
| `contentCarousel` | Array of `{id, title, description?, image?, imageAlt?, actionLabel?, disabled?}` | `autoRotateMs` (off by default), `aria-label` |
| `cardRail` | Array of `{id, title, subtitle?, description?, image?, imageAlt?, facts?: [{label, value}], tags?: string[], disabled?}` | `heading`, `description`, `emptyText` |
| `filterChips` | Array of selected option values | Standard `options` or datasource options, with optional `count` and `disabled` |

Carousel and card actions emit `onClick` with the original record in
`event.detail.item` and its ID in `event.target.value`. Filter chips emit a new
selection array through `onChange`; numeric and string values remain distinct.
Use stable, unique record IDs to preserve carousel selection across reordering.

```yaml
- id: featured
  type: contentCarousel
  wrapper: none
  scope: windowForm
  dataField: featuredItems
  properties:
    autoRotateMs: 6000
  on:
  - event: onClick
    handler: Content.openItem
```

Media accepts HTTP(S) and root-relative URLs, renders text through React, and
shows a neutral placeholder when an image cannot load. Rotation pauses during
hover, keyboard focus, explicit pause, disabled state and reduced-motion
preference. Carousel arrows support keyboard navigation. Rails use native
horizontal scrolling and expose controls only within the available bounds.

Styles are scoped to `forge-content-*`, `forge-card-rail` and
`forge-filter-chips`. Applications may override `--forge-content-accent`,
`--forge-content-border`, `--forge-content-surface`, `--forge-content-muted`,
`--forge-content-selected`, `--forge-carousel-height`,
`--forge-carousel-background`, `--forge-carousel-color`,
`--forge-carousel-heading-size`, `--forge-carousel-copy-size`,
`--forge-card-width` and `--forge-card-image-height`.

Focused checks:

```sh
node --no-warnings src/components/content/contentModel.test.js
node --no-warnings node_modules/vite-node/vite-node.mjs src/components/content/content.render.test.jsx
node --no-warnings src/runtime/widgetClassifier.test.js
```
