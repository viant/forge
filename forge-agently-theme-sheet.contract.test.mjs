import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(root, 'forge-agently-theme-sheet.html'), 'utf8');

function sheet(theme) {
  const pattern = new RegExp(`<section class="sheet" data-theme-sheet="${theme}">([\\s\\S]*?)</section>`);
  const match = source.match(pattern);
  assert.ok(match, `missing ${theme} theme sheet`);
  return match[1];
}

function normalize(markup) {
  return markup
    .replace(/data-theme-sheet="(?:light|dark)"/g, 'data-theme-sheet="mode"')
    .replace(/(Forge|Agently) · (?:Light|Dark)/g, '$1 · Theme')
    .replace(/\s+/g, ' ')
    .trim();
}

const light = normalize(sheet('light'));
const dark = normalize(sheet('dark'));
assert.equal(dark, light, 'Light and Dark review sheets must share identical content and structure');
assert.match(source, /<strong>Theme invariant<\/strong>/, 'preview must state the theme invariant');
assert.doesNotMatch(source, /Dark surface, border, focus, selected, and type roles/);
assert.doesNotMatch(source, /Check whether shell status colors and Forge control states agree/);

console.log('Forge × Agently theme-sheet invariant passed: Light and Dark share content, order, and density.');
