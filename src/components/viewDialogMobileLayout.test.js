import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const css = readFileSync(fileURLToPath(new URL('./Container.css', import.meta.url)), 'utf8');
assert.match(css, /@media \(max-width: 600px\)[\s\S]*\.forge-view-dialog\s*\{[\s\S]*margin:\s*56px 8px 8px !important[\s\S]*width:\s*calc\(100vw - 16px\) !important[\s\S]*max-width:\s*calc\(100vw - 16px\) !important[\s\S]*max-height:\s*calc\(100vh - 64px\) !important/, 'phone dialogs must remain inside the viewport, clear the fixed app header, and retain a visible footer');

console.log('view dialog mobile layout ✓');
