import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import Toolbar from './Toolbar.jsx';

const signal = (value) => ({value, peek() { return this.value; }});
const context = {
  identity: {dataSourceRef: 'records'},
  signals: {control: signal({inactive: false}), formStatus: signal({dirty: false}), selection: signal({}), windowForm: signal({enabled: true}), form: signal({})},
  handlers: {dataSource: {}},
  Context() { return this; },
};
const html = renderToStaticMarkup(<Toolbar context={context} toolbarItems={[{id: 'enabled', type: 'checkbox', scope: 'windowForm', dataField: 'enabled', label: 'Enabled'}]}/>);
assert.match(html, /type="checkbox"/);
assert.match(html, /aria-label="Enabled"/);
assert.match(html, /checked=""/);
console.log('toolbar boolean render passed');
