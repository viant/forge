# Media preview primitives

`mediaPreview` renders a media value supplied by a form or row. Supported kinds
are `image`, `audio`, `video`, `imageCard` and `frame`. An image card uses neutral fields:
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

For image-card and frame values, desktop and responsive rows use the same popover.
`mediaPreviewPopover` also exposes that generic trigger as a widget. Card text
is escaped, external destinations are limited to HTTP(S), and changing identity
closes a stale preview. Regular media values retain their existing navigation.

Values and bindings come from host metadata and data. These primitives introduce
no producer calls, business permissions, persistence, entity IDs or feature
flags. Appearance uses `forge-media-preview*` CSS classes and `--forge-*` tokens;
the host can supply additional classes. The Go `MediaPreviewOptions` and
`MediaPreviewValue` types preserve the same neutral metadata/value contract.

A frame value embeds an authored URL and may offer named source choices:

```json
{
  "kind": "frame",
  "identity": "document-42",
  "title": "Document preview",
  "url": "https://preview.example.test/document/42",
  "width": 350,
  "height": 280,
  "sources": [
    {"label": "HTTPS", "url": "https://preview.example.test/document/42"},
    {"label": "SOURCE", "url": "view-source:https://preview.example.test/document/42"}
  ]
}
```

Changing the source updates both the frame and Open link. Changing the value or
identity resets source selection; popovers close on identity changes, Escape,
outside interaction, or Cancel. Standalone frames have no Cancel control unless
the host supplies `onClose`. Dimensions are HTML attributes bounded by responsive
CSS classes and tokens. No markup or `srcdoc` is accepted. Frame URLs allow HTTP(S)
and browser `view-source:` wrappers around HTTP(S), rejecting embedded credentials
and executable schemes. Browser source viewing, frame policies and mixed-content
restrictions still apply; selecting a URL is not evidence the remote page loaded.
