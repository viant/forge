import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom = new JSDOM('<div id="root"></div>', {url:'http://localhost'});
for (const key of ['window','document','navigator','HTMLElement']) Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const {act} = React;
const {createRoot} = await import('react-dom/client');
const {signal} = await import('@preact/signals-react');
const {default: ViewDialog, resolveViewDialogDataSourceContext} = await import('./ViewDialog.jsx');
let resolutions = 0;
const context = {metadata:{dataSource:{}}, identity:{windowId:'missing-dialog-test'}, signals:{message:signal({})}, handlers:{dialog:{isOpen:()=>true}}, Context(){resolutions++;throw new Error('Must not resolve an absent definition');}};
const root = createRoot(document.getElementById('root'));
await act(()=>root.render(<><ViewDialog context={context} dialog={{id:'optional',title:'Optional',dataSourceRef:'absent'}}/><span>Healthy window</span></>));
assert.equal(document.getElementById('root').textContent,'Healthy window');
assert.equal(document.querySelector('[role="dialog"]'),null);
assert.equal(resolutions,0,'missing metadata must not initialize datasource or dialog open actions');
assert.equal(resolveViewDialogDataSourceContext(context,'absent'),null);
const definition = {selectionMode:'single'};
const known = {...context,metadata:{dataSource:{known:definition}},identity:{dataSourceRef:'known'},dataSource:definition};
assert.equal(resolveViewDialogDataSourceContext(known,'known'),known);
for (const error of [Object.assign(new Error('Forbidden'),{code:'Forbidden'}),Object.assign(new Error('Server failed'),{code:'DataSourceNotFound'}),new Error('Transport failed')]) {
    const failed = {...known,identity:{},Context(){throw error;}};
    assert.throws(()=>resolveViewDialogDataSourceContext(failed,'known'),actual=>actual===error);
}
await act(()=>root.unmount());
console.log('Missing local dialog datasource silently omitted without initialization; existing context reused and real failures preserved.');
process.exit(0);
