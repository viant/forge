import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ResponsiveCardRows} from './ResponsiveDataGrid.jsx';

const html = renderToStaticMarkup(<ResponsiveCardRows
  rows={[{id: 7, status: 1}]}
  columns={[{
    id: 'status',
    name: 'Status',
    badge: {
      field: 'status',
      valueMap: {'0': 'Pending', '1': 'Approved'},
      toneMap: {'0': 'neutral', '1': 'success'},
      replaceValue: true,
    },
  }]}
  context={{}}
/>);

assert.match(html, /forge-table-cell-badge is-success/);
assert.match(html, />Approved</);
assert.doesNotMatch(html, /<dd>1<\/dd>/);
console.log('responsive data-grid badge proof ✓');
