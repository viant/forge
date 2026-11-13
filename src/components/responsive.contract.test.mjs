import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FORGE_FORM_FACTOR_BREAKPOINTS, FORGE_RESPONSIVE_VARIABLES, forgeFormFactorForWidth} from './responsive.js';

assert.deepEqual(FORGE_FORM_FACTOR_BREAKPOINTS, {phoneMaxWidth: 767, tabletMaxWidth: 1099});
assert.equal(forgeFormFactorForWidth(390), 'phone');
assert.equal(forgeFormFactorForWidth(768), 'tablet');
assert.equal(forgeFormFactorForWidth(1100), 'desktop');
assert.equal(FORGE_RESPONSIVE_VARIABLES.touchTargetMin, '--forge-touch-target-min');

const styles = fs.readFileSync(new URL('./foundations.css', import.meta.url), 'utf8');
for (const variable of Object.values(FORGE_RESPONSIVE_VARIABLES)) assert.match(styles, new RegExp(variable));
for (const variable of ['--forge-spacing-1', '--forge-spacing-3', '--forge-spacing-4', '--forge-spacing-5', '--forge-spacing-6', '--forge-radius-surface', '--forge-focus-width']) {
    assert.match(styles, new RegExp(variable));
}

console.log('responsive foundation contract ✓ shared form factors and responsive roles are defined once');
