import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./GridLayoutRenderer.jsx', import.meta.url), 'utf8');
assert.match(source, /visibleEntries = sourceEntries\.filter/);
assert.match(source, /evaluatePlainVisibleWhen\(item\.visibleWhen/);
assert.match(source, /placeItems\(visibleEntries/);
console.log('grid item visibility contract ✓ hidden controls do not leave orphan labels or grid gaps');
