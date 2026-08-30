import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./DashboardBlocks.jsx', import.meta.url)), 'utf8');
const editableTable = source.match(/export function DashboardEditableTable\([^]*?\n}\n\nfunction valueAtPath/)?.[0] || '';

assert.ok(editableTable, 'DashboardEditableTable source should be present');
assert.match(editableTable, /\{\s*useSignals\(\);/, 'editable tables must subscribe to external signal updates');

console.log('dashboard editable table signal coverage passed');
