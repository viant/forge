import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('./SectionTabRail.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./SectionTabRail.css', import.meta.url), 'utf8');

assert.match(source, /aria-controls=\{panelId \|\| undefined\}/);
assert.match(source, /tabIndex=\{selected[\s\S]*?0\s*:\s*-1\}/);
assert.match(source, /ArrowRight[\s\S]*ArrowLeft[\s\S]*Home[\s\S]*End/);
assert.match(source, /selected\.offsetLeft[\s\S]*rail\.clientWidth[\s\S]*selected\.offsetWidth/);
assert.match(source, /Math\.max\(0,\s*Math\.min\(maxLeft,\s*centered\)\)/);
assert.match(source, /Scroll tabs left/);
assert.match(source, /Scroll tabs right/);
assert.match(styles, /scroll-padding-inline:\s*44px/);
assert.match(styles, /scroll-margin-inline:\s*44px/);
assert.match(styles, /\.forge-section-tab\s*\{[\s\S]*?flex:\s*0 0 auto/);
assert.match(styles, /\.forge-section-tab-rail\s*\{[\s\S]*?flex:\s*1 1 auto/);
assert.match(styles, /\.forge-section-tab-rail\.is-compact\s*\{[\s\S]*?min-height:\s*35px/);
assert.match(styles, /\.forge-section-tab\.is-selected\s*\{[\s\S]*?border-bottom-color/);
assert.doesNotMatch(styles, /position:\s*absolute/);
assert.doesNotMatch(styles, /@media\s*\(min-width:[\s\S]*?\.forge-section-tab[^}]*flex:\s*1/);
assert.match(styles, /@media\s*\(max-width:\s*480px\)[\s\S]*?min-height:\s*40px/);

console.log('sectionTabRail contract ✓');
