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
assert.match(editableTable, /<input aria-label=[\s\S]*onInput=\{\(event\) => updateCell[\s\S]*editableNumberValue\(event\.target\.value\)/, 'editable inputs must commit native input events and preserve clear-then-type number editing');
assert.match(editableTable, /replaceCollection === 'function'[\s\S]*setCollection === 'function'[\s\S]*dataSourceContext\?\.signals\?\.collection[\s\S]*dataSourceContext\.signals\.collection\.value = nextRows/, 'editable inputs must prefer replaceCollection, fall back to setCollection, then publish the signal');
assert.match(editableTable, /\[draftRows, setDraftRows\] = useState\(null\)[\s\S]*sourceSignature = JSON\.stringify\(sourceRows\)[\s\S]*useEffect\(\(\) => setDraftRows\(null\), \[dataSourceRef, sourceSignature\]\)[\s\S]*currentRows = \(\) => draftRows \|\| sourceRows[\s\S]*setDraftRows\(nextRows\)/, 'editable inputs must retain local drafts while allowing an external source refresh to reset them');

console.log('dashboard editable table signal coverage passed');
