import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./index.jsx', import.meta.url), 'utf8');

assert.match(source, /aria-pressed=\{selected\}/);
assert.match(source, /data-selected=\{selected \? 'true' : 'false'\}/);
assert.match(source, /className="forge-pill-label"/);

console.log('Blueprint pill multi-select contract passed');
