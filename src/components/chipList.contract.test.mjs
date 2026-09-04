import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./ChipList.jsx', import.meta.url), 'utf8');
const pack = fs.readFileSync(new URL('../packs/blueprint/index.jsx', import.meta.url), 'utf8');
assert.match(source, /is-excluded/);
assert.match(source, /Remove \$\{chip\.label\}/);
assert.match(source, /\+\{hiddenCount\} more/);
assert.match(pack, /registerWidget\('chipList'/);
assert.match(pack, /registerEventAdapter\('chipList'/);
console.log('chip list contract ✓ include/exclude, local removal, and compact overflow');
