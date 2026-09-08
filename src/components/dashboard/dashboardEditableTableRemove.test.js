import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const source = readFileSync(resolve(import.meta.dirname, 'DashboardBlocks.jsx'), 'utf8');
const editableTable = source.match(/export function DashboardEditableTable\([^]*?\n}\n\nfunction valueAtPath/)?.[0] || '';

assert.ok(editableTable, 'DashboardEditableTable source should be present');
assert.match(editableTable, /container\?\.allowRemove !== false[\s\S]*removeRow/);
assert.match(editableTable, /rows\.length <= Math\.max\(0, Number\(container\?\.minRows \|\| 0\)\)/);
assert.match(editableTable, /editor\.type === 'date' \? 'date'/);

console.log('dashboard editable table remove coverage passed');
