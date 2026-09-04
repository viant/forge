import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'packs/blueprint/index.jsx'), 'utf8');
const widgetRenderer = fs.readFileSync(path.join(root, 'runtime/WidgetRenderer.jsx'), 'utf8');

assert.match(source, /children\s*\|\|\s*item\?\.label\s*\|\|\s*title/, 'button metadata label must render inside the button');
assert.match(source, /registerEventAdapter\(['"]button['"],\s*\{[\s\S]*?onClick:/, 'button must expose an onClick event adapter');
assert.match(widgetRenderer, /disabled:\s*dynDisabledGlobal === undefined \? item\.disabled : dynDisabledGlobal/, 'static disabled metadata must reach the widget');

console.log('blueprint button runtime ✓');
