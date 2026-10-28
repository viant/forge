# Styled text in canonical report exports

A canonical `ReportPrint` text element can carry optional `textRuns` for mixed emphasis. Its `text` remains the complete plain-text value; concatenating the run text must produce that exact value. This keeps search, accessibility and export content consistent.

```json
{
  "id": "period-note",
  "kind": "text",
  "box": {"x": 36, "y": 80, "width": 480, "height": 30},
  "fontSize": 12,
  "text": "Period: January",
  "textRuns": [
    {"text": "Period: ", "fontWeight": "bold"},
    {"text": "January", "fontWeight": "italic"}
  ]
}
```

An omitted run `fontWeight` inherits the element weight. `normal` resets emphasis; `bold italic` combines it. Numeric weights of 600 or greater are bold. Values are presentation metadata, never HTML or executable expressions.

Runs are supported on `text` elements. Empty arrays, empty runs, unknown run fields, null styles, and a mismatch with the full text are rejected. Omit `textRuns` for existing plain-text behavior. Newlines remain part of the text. Runs use normalized LF line breaks; carriage returns are rejected, including CRLF split across runs, rather than interpreted differently by exporters. Source text conversion normalizes CRLF before emitting runs.

PDF places runs using actual font advances. HTML uses SVG text spans; XLSX uses native rich text in cells, preserving literal text rather than interpreting it as a formula. The authored element still owns its box and pagination. PDF rejects rich text that exceeds the allocated height; callers must allocate enough space rather than depend on clipping.

Mixed emphasis does not add arbitrary font, color, or link markup to runs. Charts, table cells and other print primitives retain their existing contracts.
