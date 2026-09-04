import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./TablePanel.jsx', import.meta.url), 'utf8');

assert.match(
  source,
  /columns=\{configuredColumns\}/,
  'TablePanel must pass hidden configured columns to Basic so Table Settings can reveal them',
);
assert.doesNotMatch(
  source,
  /columns=\{visibleColumns\}/,
  'TablePanel must not discard hidden columns before Basic builds Table Settings',
);

console.log('table hidden-column settings ✓');
