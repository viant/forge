import React from 'react';
import {act, create} from 'react-test-renderer';
import {renderToStaticMarkup} from 'react-dom/server';
import assert from 'node:assert/strict';
import ImageLabelCell from './ImageLabelCell.jsx';
import TableCell from './TableCell.jsx';
import {ResponsiveCardRows} from '../../primitives/ResponsiveDataGrid.jsx';

let view;
act(() => {view = create(<ImageLabelCell value={{src: '/logos/one.png', label: 'One'}}/>);});
assert.equal(view.root.findByType('img').props.alt, '');
assert.equal(view.root.findByType('img').props.loading, 'lazy');
act(() => view.root.findByType('img').props.onError());
assert.equal(view.root.findAllByType('img').length, 0);
assert.match(JSON.stringify(view.toJSON()), /One/);
act(() => view.update(<ImageLabelCell value={{src: '/logos/two.png', label: 'Two'}}/>));
assert.equal(view.root.findByType('img').props.src, '/logos/two.png', 'a new row/image recovers after a failure');
act(() => view.update(<ImageLabelCell value={{label: 'Missing image'}}/>));
assert.equal(view.root.findAllByType('img').length, 0);
assert.match(JSON.stringify(view.toJSON()), /Missing image/);
act(() => view.update(<ImageLabelCell value={null} emptyText="Unavailable"/>));
assert.match(JSON.stringify(view.toJSON()), /Unavailable/);
act(() => view.unmount());

const value = {src: '/logos/provider.png', label: 'Provider'};
const row = {id: 7, publisher: value};
const col = {id: 'publisher', name: 'Publisher', type: 'image'};
const desktop = renderToStaticMarkup(<table><tbody><tr><TableCell context={{}} cell={{value, displayedText: '[object Object]'}} cellSelection={{row, col}}/></tr></tbody></table>);
const cards = renderToStaticMarkup(<ResponsiveCardRows rows={[row]} columns={[col]} context={{}}/>);
for (const markup of [desktop, cards]) {
    assert.match(markup, /src="\/logos\/provider.png"/);
    assert.match(markup, />Provider<\/span>/);
    assert.doesNotMatch(markup, /\[object Object\]/);
}
console.log('Image table cells render on desktop and cards; missing/error labels and source recovery pass.');
