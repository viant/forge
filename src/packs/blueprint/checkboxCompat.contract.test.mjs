import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const widgetSource = readFileSync(new URL('./index.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../components/Container.css', import.meta.url), 'utf8');

assert.match(widgetSource, /Checkbox[\s\S]*forge-blueprint-checkbox-compat/);
assert.match(css, /\.forge-blueprint-checkbox-compat\s*>\s*input\[type="checkbox"\][\s\S]*opacity:\s*0[\s\S]*position:\s*absolute/);

console.log('checkboxCompat ✓ hides the unclassed native Blueprint checkbox input');
