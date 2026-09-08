import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./DashboardBlocks.jsx', import.meta.url)), 'utf8');
const editableTable = source.match(/export function DashboardEditableTable\([^]*?\n}\n\nfunction valueAtPath/)?.[0] || '';

assert.ok(editableTable, 'DashboardEditableTable source should be present');
assert.match(editableTable, /\{\s*useSignals\(\);/, 'editable tables must subscribe to external signal updates');
assert.match(editableTable, /addRowConfig\?\.deriveHandler[\s\S]*context\.lookupHandler[\s\S]*collection:\s*latest/, 'editable tables should support generic metadata-driven row derivation');
assert.match(editableTable, /visibleRuntimeColumns[\s\S]*evaluatePlainVisibleWhen\(column\.visibleWhen/, 'editable columns should support authorization and capability visibility');
assert.match(editableTable, /editorDisabled[\s\S]*disabled=\{editorDisabled\}/, 'editable cells should honor row-scoped disabled conditions');

console.log('dashboard editable table signal coverage passed');
