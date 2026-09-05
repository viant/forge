import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('./index.jsx', import.meta.url), 'utf8');
const currency = source.match(/registerWidget\(\s*'currency',[\s\S]*?registerEventAdapter\('currency',[\s\S]*?\n\s*\}\);/)?.[0] || '';

assert.ok(currency, 'currency widget contract should exist');
assert.match(currency, /\(\{ value = '', onValueChange, readOnly/);
assert.match(currency, /onValueChange=\{\(v\) => onValueChange\?\.\(v\)\}/);
assert.match(currency, /registerEventAdapter\('currency',[\s\S]*onValueChange:[\s\S]*adapter\.set\(v\)/);
assert.doesNotMatch(currency, /\(\{ value = '', onChange, readOnly/);

console.log('currency input event contract passed');
