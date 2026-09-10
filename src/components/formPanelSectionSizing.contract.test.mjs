import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('./FormPanel.jsx', import.meta.url), 'utf8');
const containerSource = readFileSync(new URL('./Container.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./Container.css', import.meta.url), 'utf8');
const tabStyles = readFileSync(new URL('./SectionTabRail.css', import.meta.url), 'utf8');

assert.match(source, /fillSectionTabs\s*=\s*container\?\.tabs\?\.fill\s*===\s*true/);
assert.match(source, /forge-form-panel-section-tabs[\s\S]*is-fill/);
assert.match(styles, /\.form-panel\.forge-form-panel-section-tabs\s*\{[\s\S]*?flex:\s*0 0 auto;[\s\S]*?height:\s*auto;[\s\S]*?overflow:\s*visible;/);
assert.match(styles, /\.forge-form-panel-section-tabs__panel\s*\{[\s\S]*?flex:\s*0 0 auto;[\s\S]*?overflow:\s*visible;/);
assert.match(styles, /\.form-panel\.forge-form-panel-section-tabs\.is-fill\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?height:\s*100%;/);
assert.match(styles, /\.form-panel\.forge-form-panel-section-tabs\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?scrollbar-gutter:\s*stable;/);
assert.match(styles, /\.forge-form-panel-section-tabs__panel\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?contain:\s*inline-size;/);
assert.match(styles, /\.forge-form-panel-section-tabs__panel\s*>\s*\*\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?min-width:\s*0;/);
assert.match(tabStyles, /\.forge-section-tab\s*\{[\s\S]*?--forge-section-tab-font-weight:\s*700;[\s\S]*?font-weight:\s*var\(--forge-section-tab-font-weight\);/);
assert.match(tabStyles, /\.forge-section-tab\.is-selected\s*\{[\s\S]*?font-weight:\s*var\(--forge-section-tab-font-weight\);/);
assert.match(containerSource, /overflow:\s*isLast\s*\?\s*['"]visible['"]\s*:\s*['"]hidden['"]/);

console.log('formPanel section sizing contract ✓');
