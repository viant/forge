import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('./index.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../../runtime/WidgetRenderer.jsx', import.meta.url), 'utf8');
const block = source.match(/registerWidget\('button',[\s\S]*?registerEventAdapter\('button'/)?.[0] || '';
assert.ok(block, 'button widget registration must exist');
assert.match(source, /Button,\s*\n\s*Icon,/, 'button icon rendering requires the Blueprint Icon import');
assert.match(block, /icon, hideLabel/);
assert.match(block, /icon \? <Icon icon=\{icon\}/);
assert.match(block, /hideLabel \? null/);
assert.match(block, /hideLabel \? 'forge-button--icon-only'/);
assert.match(css, /\.forge-button--icon-only:not\(\.forge-action-icon\) \{ min-width: 30px/);
assert.doesNotMatch(block, /style=\{\{/);
assert.match(renderer, /'title', 'hideLabel'/, 'WidgetRenderer must pass top-level hideLabel to ordinary buttons');

console.log('button widget icon-only contract passed');
