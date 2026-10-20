# Embedded raster previews

The generic `mediaPreview` widget can carry a static raster illustration with an
authored window. This avoids a dependency on the original author's browser login
or an external image host. It is presentation data, not an authorization decision.

```yaml
items:
  - id: illustration
    type: mediaPreview
    value:
      kind: image
      alt: Product illustration
      image:
        mimeType: image/png
        payload: BASE64_ENCODED_PNG_BYTES
```

`payload` is standard padded base64, without a data-URL prefix or whitespace.
The decoded image is limited to 8 MiB. The MIME type must be `image/png`,
`image/jpeg`, `image/gif`, or `image/webp`, and the decoded header must match it.
This is a lightweight format check; browser decode failures still show the
existing preview failure state. The widget does not decode/re-encode images or
make them trusted application content. SVG, HTML, arbitrary data URLs, malformed
base64, and oversized payloads are rejected. An invalid explicit `image` does not
fall back to `url`. A failed embedded image does not offer an external source link.

Existing HTTP(S) media URLs and host-trusted blob previews retain their behavior.
Embedding does not enable audio/video data URLs or change the workspace CSS
network policy. The image bytes are visible to anyone admitted to read the window;
do not embed credentials or data the window's audience is not authorized to read.
Server resource and transport size limits still apply to the entire document.

This contract is implemented by the Forge web widget. Other native consumers
must add the same typed descriptor support before embedded images can be assumed
to render there. Source compilation alone does not prove visual parity.
