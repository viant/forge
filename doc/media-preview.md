# Media preview primitives

`mediaPreview` renders a media value supplied by a form or row. Supported kinds
are `image`, `audio`, `video` and `imageCard`. An image card uses neutral fields:
`title`, `description`, `caption`, `url`, optional `href`, `alt` and `identity`.
No field implies an advertiser, campaign or other business entity.

A table can configure its preview through metadata:

```yaml
columns:
  - id: preview
    name: Preview
    type: mediaPreview
    preview:
      label: View item
      ariaLabel: Item preview
      className: catalog-preview
      popoverClassName: catalog-preview-popover
```

For an image-card value, desktop and responsive rows use the same popover.
`mediaPreviewPopover` also exposes that generic trigger as a widget. Card text
is escaped, external destinations are limited to HTTP(S), and changing identity
closes a stale preview. Regular media values retain their existing navigation.

Values and bindings come from host metadata and data. These primitives introduce
no producer calls, business permissions, persistence, entity IDs or feature
flags. Appearance uses `forge-media-preview*` CSS classes and `--forge-*` tokens;
the host can supply additional classes. The Go `MediaPreviewOptions` and
`MediaPreviewValue` types preserve the same neutral metadata/value contract.
