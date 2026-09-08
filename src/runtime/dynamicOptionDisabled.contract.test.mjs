import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('./WidgetRenderer.jsx', import.meta.url), 'utf8');
assert.match(source, /optionDisabledField[\s\S]*resolveSelector\(row, disabledSelector\)[\s\S]*\{value, label: displayLabel, disabled\}/);
console.log('dynamic datasource options preserve disabled rows');
