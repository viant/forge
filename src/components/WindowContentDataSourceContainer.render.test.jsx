import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

const dom = new JSDOM('<div id="root"></div>', {url: 'http://localhost'});
for (const key of ['window', 'document', 'navigator', 'HTMLElement']) {
    Object.defineProperty(globalThis, key, {value: dom.window[key], configurable: true});
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const {act} = React;
const {createRoot} = await import('react-dom/client');
const {MissingDataSourceReferenceError} = await import('../core/context/dataSourceReference.js');
const {default: DataSourceContainer} = await import('./WindowContentDataSourceContainer.jsx');

const metadata = {dataSource: {healthy: {}}};
const missing = new MissingDataSourceReferenceError('missing', {windowId: 'order'});
const windowContext = {metadata, useDsContext: () => {throw missing;}};
const root = createRoot(document.getElementById('root'));
const originalConsoleError = console.error;
console.error = () => {};
try {
    await act(() => root.render(<>
        <DataSourceContainer windowContext={windowContext} dsKey="missing" />
        <span>Healthy sibling</span>
    </>));
    assert.equal(document.getElementById('root').textContent, 'Healthy sibling');
} finally {
    console.error = originalConsoleError;
    await act(() => root.unmount());
}
console.log('Missing root datasource mount omits only its own region.');
