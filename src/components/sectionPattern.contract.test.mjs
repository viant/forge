import assert from 'node:assert/strict';
import fs from 'node:fs';

const section = fs.readFileSync(new URL('./AccessibleSection.jsx', import.meta.url), 'utf8');
const exports = fs.readFileSync(new URL('./index.js', import.meta.url), 'utf8');
const patterns = fs.readFileSync(new URL('./patterns/index.js', import.meta.url), 'utf8');
const container = fs.readFileSync(new URL('./Container.jsx', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('./Container.css', import.meta.url), 'utf8');

assert.match(section, /data-forge-component="section"/);
assert.match(section, /data-forge-state=\{collapsible \? \(isOpen \? 'open' : 'closed'\) : 'static'\}/);
assert.match(section, /data-forge-part="section-header"/);
assert.match(section, /aria-expanded=\{collapsible \? isOpen : undefined\}/);
assert.match(section, /data-forge-part="section-content"/);
assert.match(container, /import \{SectionPattern\} from '\.\/patterns\/index\.js'/);
assert.match(container, /container\.section\.appearance \? SectionPattern : Section/);
assert.match(exports, /AccessibleSection.*AccessibleSection\.jsx/);
assert.match(exports, /SectionPattern.*patterns\/index\.js/);
assert.match(patterns, /component: 'SectionPattern'/);
assert.match(patterns, /appearances: Object\.freeze\(\['primary', 'quiet'\]\)/);

const canonicalSectionStyles = styles.match(/\/\* Canonical section pattern[\s\S]*?\/\* Legacy section classes/);
assert.ok(canonicalSectionStyles, 'Forge must own the canonical section pattern');
assert.match(canonicalSectionStyles[0], /data-forge-section-appearance="primary"/);
assert.match(canonicalSectionStyles[0], /data-forge-section-appearance="quiet"/);
assert.match(canonicalSectionStyles[0], /data-forge-section-content-inset="flush"/);
assert.match(canonicalSectionStyles[0], /forge-section-primary-content-padding/);
assert.match(canonicalSectionStyles[0], /forge-section-quiet-header-margin-bottom/);
assert.match(canonicalSectionStyles[0], /@media \(max-width: 767px\)/);
assert.doesNotMatch(canonicalSectionStyles[0], /#[0-9a-f]{3,8}\b/i);
assert.match(canonicalSectionStyles[0], /var\(--forge-(?:surface|border-color|text|spacing|radius|type|section)/);

console.log('section pattern contract ✓ Forge owns reusable section anatomy and semantic styling');
