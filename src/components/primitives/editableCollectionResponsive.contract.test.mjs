import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css = readFileSync(new URL('./workflowPrimitives.css', import.meta.url), 'utf8');
assert.match(css, /\.forge-editable-collection__operation-bar\s*\{[\s\S]*display:\s*flex\s*!important[\s\S]*flex-direction:\s*row\s*!important[\s\S]*width:\s*100%[\s\S]*height:\s*auto\s*!important/);
assert.match(css, /@media\s*\(max-width:\s*700px\)[\s\S]*\.forge-editable-collection__operation-bar\s*\{[\s\S]*flex-wrap:\s*wrap[\s\S]*overflow-x:\s*visible/);
assert.match(css, /@media\s*\(max-width:\s*700px\)[\s\S]*\.forge-editable-collection__operation-bar\s*>\s*\.forge-mutation-command[\s\S]*flex:\s*0\s+0\s+auto/);
assert.doesNotMatch(css, /\.forge-editable-collection__operation-bar\s*\{[^}]*flex-direction:\s*column/);
const legacyDashboardCss = readFileSync(new URL('../dashboard/Dashboard.css', import.meta.url), 'utf8');
assert.match(legacyDashboardCss, /\.forge-editable-collection__actions\s*\{[^}]*width:\s*42px/);
assert.doesNotMatch(legacyDashboardCss, /forge-editable-collection__operation-bar/);
console.log('editable collection responsive action layout passed');
