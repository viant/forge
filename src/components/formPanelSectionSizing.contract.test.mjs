import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('./FormPanel.jsx', import.meta.url), 'utf8');
const containerSource = readFileSync(new URL('./Container.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./Container.css', import.meta.url), 'utf8');

assert.match(source, /fillSectionTabs\s*=\s*container\?\.tabs\?\.fill\s*===\s*true/);
assert.match(source, /forge-form-panel-section-tabs[\s\S]*is-fill/);
assert.match(styles, /\.form-panel\.forge-form-panel-section-tabs\s*\{[\s\S]*?flex:\s*0 0 auto;[\s\S]*?height:\s*auto;[\s\S]*?overflow:\s*visible;/);
assert.match(styles, /\.forge-form-panel-section-tabs__panel\s*\{[\s\S]*?flex:\s*0 0 auto;[\s\S]*?overflow:\s*visible;/);
assert.match(styles, /\.form-panel\.forge-form-panel-section-tabs\.is-fill\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?height:\s*100%;/);
assert.match(containerSource, /overflow:\s*isLast\s*\?\s*['"]visible['"]\s*:\s*['"]hidden['"]/);

console.log('formPanel section sizing contract ✓');
