import assert from "node:assert/strict";

import { clampPresentationText, normalizePresentationText } from "./presentationText.js";

assert.equal(normalizePresentationText("  Kroil\uFFFD\uFFFD creative\nname  "), "Kroil? creative name");
assert.equal(normalizePresentationText("Cafe\u0301"), "Café");
assert.deepEqual(clampPresentationText("abcdefghij", { lines: 1, maxCharacters: 6 }), {
  fullText: "abcdefghij",
  lines: ["abcde…"],
  truncated: true,
});
assert.deepEqual(clampPresentationText("👩‍💻abcdefghij", { lines: 2, maxCharacters: 5 }), {
  fullText: "👩‍💻abcdefghij",
  lines: ["👩‍💻abcd", "efgh…"],
  truncated: true,
});
