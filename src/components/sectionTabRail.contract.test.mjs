import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('./SectionTabRail.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./SectionTabRail.css', import.meta.url), 'utf8');

assert.match(source, /aria-controls=\{panelId \|\| undefined\}/);
assert.match(source, /tabIndex=\{selected[\s\S]*?0\s*:\s*-1\}/);
assert.match(source, /ArrowRight[\s\S]*ArrowLeft[\s\S]*Home[\s\S]*End/);
assert.match(source, /scrollIntoView/);
assert.match(source, /Scroll tabs left/);
assert.match(source, /Scroll tabs right/);
assert.match(source, /hasOverflow[\s\S]*?inline:\s*hasOverflow\s*\?\s*['"]center['"]\s*:\s*['"]nearest['"]/);
assert.match(styles, /\.forge-section-tab\s*\{[\s\S]*?flex:\s*0 0 auto/);
assert.match(styles, /\.forge-section-tab-rail\s*\{[\s\S]*?flex:\s*0 0 auto/);
assert.match(styles, /\.forge-section-tab-rail\.is-compact\s*\{[\s\S]*?min-height:\s*35px/);
assert.match(styles, /\.forge-section-tab\.is-selected\s*\{[\s\S]*?border-bottom-color/);
assert.match(styles, /\.forge-section-tab-rail-frame\.has-right-overflow::after/);
assert.doesNotMatch(styles, /@media\s*\(min-width:[\s\S]*?\.forge-section-tab[^}]*flex:\s*1/);
assert.match(styles, /@media\s*\(max-width:\s*480px\)[\s\S]*?min-height:\s*40px/);

console.log('sectionTabRail contract ✓');
