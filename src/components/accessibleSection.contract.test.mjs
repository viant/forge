import assert from 'node:assert/strict';
import fs from 'node:fs';

const section = fs.readFileSync(new URL('./AccessibleSection.jsx', import.meta.url), 'utf8');
const container = fs.readFileSync(new URL('./Container.jsx', import.meta.url), 'utf8');
assert.match(section, /aria-expanded=\{isOpen\}/);
assert.match(section, /aria-label=\{isOpen \? 'collapse section' : 'expand section'\}/);
assert.match(section, /keepChildrenMounted/);
assert.match(container, /sectionProperties\.collapsible === true \? AccessibleSection : Section/);
console.log('accessible section contract ✓ visual and announced expansion state share one source');
