import assert from "node:assert/strict";

import { clampPresentationText, normalizePresentationClampConfig, normalizePresentationText } from "./presentationText.js";

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
assert.deepEqual(normalizePresentationClampConfig({ lines: 2, maxCharacters: 44 }), { lines: 2, maxCharacters: 44 });
assert.equal(normalizePresentationClampConfig({ lines: 3 }), null);
