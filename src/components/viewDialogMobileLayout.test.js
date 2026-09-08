import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const css = readFileSync(fileURLToPath(new URL('./Container.css', import.meta.url)), 'utf8');
const treeBrowserCss = readFileSync(fileURLToPath(new URL('./tree-browser.css', import.meta.url)), 'utf8');
const source = readFileSync(fileURLToPath(new URL('./ViewDialog.jsx', import.meta.url)), 'utf8');
assert.match(css, /@media \(max-width: 600px\)[\s\S]*\.forge-view-dialog\s*\{[\s\S]*margin:\s*56px 8px 8px !important[\s\S]*width:\s*calc\(100vw - 16px\) !important[\s\S]*max-width:\s*calc\(100vw - 16px\) !important[\s\S]*max-height:\s*calc\(100vh - 64px\) !important/, 'phone dialogs must remain inside the viewport, clear the fixed app header, and retain a visible footer');
assert.match(source, /portalClassName=\{dialog\?\.properties\?\.portalClassName \|\| undefined\}/, 'nested dialogs must be able to declare an explicit portal stacking class');
assert.match(treeBrowserCss, /:has\(\.steward-targeting-tree-dialog\)[\s\S]*z-index:\s*30/, 'Targeting picker overlay must stack above its parent dialog');

console.log('view dialog mobile layout ✓');
