import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom = new JSDOM('<div id="root"></div>', {url: 'http://localhost'});
for (const key of ['window','document','navigator','HTMLElement']) Object.defineProperty(globalThis, key, {value: dom.window[key], configurable: true});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const {act} = React;
const {createRoot} = await import('react-dom/client');
const {Context} = await import('../core/context/Context.jsx');
const {default: Boundary} = await import('./MissingDataSourceBoundary.jsx');
const {default: WidgetRenderer} = await import('../runtime/WidgetRenderer.jsx');
const metadata = {actions: {import: () => ({})}, dataSource: {healthy: {selectionMode:'single', selectors:{}}}};
const context = Context('missing-source-render-test', metadata, 'healthy', {});
function Region({refName}) {const scoped = context.Context(refName); return <span>{scoped.identity.dataSourceRef}</span>;}
const root = createRoot(document.getElementById('root'));
// React reports caught render exceptions to its developer console in development.
// The boundary never adds those diagnostics to end-user message signals or UI.
const originalConsoleError = console.error;
console.error = () => {};
try {
    await act(() => root.render(<><Boundary metadata={metadata}><Region refName="absent"/></Boundary><span>Healthy sibling</span></>));
    assert.equal(document.getElementById('root').textContent, 'Healthy sibling');
    assert.throws(() => context.Context('absent'), error => error.code === 'DataSourceNotFound');
    // Normal widget rendering is guarded, not merely an artificial boundary use.
    await act(() => root.render(<><WidgetRenderer context={context} item={{id:'broken',type:'text',dataSourceRef:'absent'}} container={{id:'form'}}/><span>Healthy sibling</span></>));
    assert.equal(document.getElementById('root').textContent, 'Healthy sibling');
    // Replacing metadata clears the omission, allowing newly supplied definitions.
    await act(() => root.render(<Boundary metadata={{...metadata}}><Region refName="healthy"/></Boundary>));
    assert.equal(document.getElementById('root').textContent, 'healthy');
    const caught = [];
    class HostBoundary extends React.Component {
        state = {error: null};
        static getDerivedStateFromError(error) {return {error};}
        componentDidCatch(error) {caught.push(error);}
        render() {return this.state.error ? <span>Host failure</span> : this.props.children;}
    }
    function Failure({error}) {throw error;}
    for (const error of [Object.assign(new Error('Forbidden'), {code: 'Forbidden'}), Object.assign(new Error('Backend datasource unavailable'), {code: 'DataSourceNotFound'}), new Error('Network failed')]) {
        await act(() => root.render(<HostBoundary key={error.message}><Boundary metadata={metadata}><Failure error={error}/></Boundary></HostBoundary>));
        assert.equal(caught.at(-1), error, 'real failures must reach the existing host error boundary');
    }
    await act(() => root.unmount());
} finally {console.error = originalConsoleError;}
console.log('Missing references omit render regions, preserve siblings/strict Context and metadata recovery; auth/server/transport errors propagate.');
process.exit(0);
