import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const dom = new JSDOM('<div id="root"></div>', {pretendToBeVisual: true});
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'MutationObserver', 'Window', 'Document', 'Node', 'Range', 'DOMRect', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) Object.defineProperty(globalThis, key, {value: dom.window[key], configurable: true});
window.Range.prototype.getClientRects = () => [];
window.Range.prototype.getBoundingClientRect = () => new window.DOMRect();
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const {createRoot} = await import('react-dom/client');
const {default: SourceAssetTree} = await import('./SourceAssetTree.jsx');
const {default: NamedWindowSourceEditor} = await import('./NamedWindowSourceEditor');
const {act} = React;
// Exercise the real host cascade: generic editor buttons center their contents.
const styles = document.createElement('style');
styles.textContent = ['WindowYamlEditor.css', 'SourceAssetTree.css'].map(name => readFileSync(new URL(name, import.meta.url), 'utf8')).join('\n');
document.head.append(styles);
document.getElementById('root').className = 'fwe';
const files = {'extension/forge/windows/main.yaml': 'windowKey: demo', 'extension/forge/hooks.js': 'const value = 1;'};
let selected = Object.keys(files)[0];
function Host() {const [path, setPath] = React.useState(selected); return <SourceAssetTree files={files} selectedPath={path} onSelect={next => {selected = next; setPath(next);}}/>;}
const root = createRoot(document.getElementById('root'));
await act(() => root.render(<Host/>));
assert.equal(document.querySelectorAll('[role="treeitem"][tabindex="0"]').length, 1);
let chosen = document.querySelector('[aria-selected="true"]');
await act(() => {chosen.focus(); chosen.dispatchEvent(new window.KeyboardEvent('keydown', {key: 'Home', bubbles: true}));});
assert.equal(document.activeElement.getAttribute('aria-level'), '1');
await act(() => document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', {key: 'End', bubbles: true})));
assert.equal(document.activeElement.getAttribute('title'), 'extension/forge/hooks.js');
await act(() => document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', {key: 'Enter', bubbles: true})));
assert.equal(selected, 'extension/forge/hooks.js');
assert.equal(document.querySelectorAll('[aria-selected="true"]').length, 1);
// Read-only source editing still exposes normal, enabled file navigation.
await act(() => root.render(<NamedWindowSourceEditor sourceManifest={{binding: {windowKey: 'demo'}, files}} readOnly/>));
assert.ok(document.querySelector('[role="tree"]'));
assert.equal(document.querySelector('[role="treeitem"]').disabled, false);
assert.ok(document.querySelector('select[aria-label="Source file"]'));
for (const row of document.querySelectorAll('[role="treeitem"]')) {
  assert.equal(getComputedStyle(row).justifyContent, 'flex-start', 'tree rows must override centered editor action buttons');
  assert.equal(row.style.getPropertyValue('--source-level'), row.getAttribute('aria-level'));
}
assert.equal(getComputedStyle(document.querySelector('.fwe-authoring-actions button')).justifyContent, 'center', 'tree alignment must remain scoped');
await act(() => root.unmount());
console.log('Rendered source asset tree roving focus, keyboard selection, read-only navigation and native selector compatibility passed.');
process.exit(0);
