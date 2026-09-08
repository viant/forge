import React from 'react';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import TableRow from './TableRow.jsx';

const columns = [
    {
        id: '__select__',
        type: 'checkbox',
        multiSelect: true,
        selectionDisabledWhen: {source: 'row', field: 'directAssociation', notEquals: true},
    },
    {
        id: 'name',
        type: 'link',
        link: {
            kind: 'dialog',
            dialogId: 'orderCreativeDetail',
            title: 'Review Creative details',
            parameters: {Id: {source: 'row', selector: 'id', wrap: 'array'}},
        },
    },
];
const row = {id: 24965775, name: 'Inherited Creative', directAssociation: false};
const html = renderToStaticMarkup(
    <table>
        <tbody>
            <TableRow
                context={{handlers: {dataSource: {isSelected: () => false}, window: {}}}}
                rowData={[
                    {id: 'select', value: false, displayedText: ''},
                    {id: 'name', value: row.name, displayedText: row.name},
                ]}
                rowSelection={{row, rowIndex: 0}}
                columns={columns}
                columnsHandlers={{__select__: {}, name: {}}}
                onRowClick={() => true}
                enforceColumnSize={false}
            />
        </tbody>
    </table>,
);

assert.match(html, /data-selection-disabled="true"/);
assert.doesNotMatch(html, /aria-disabled="true"/);
assert.match(html, /disabled="" aria-label="Row selection unavailable"/);
assert.match(html, /<button type="button" title="Review Creative details"/);
assert.doesNotMatch(html, /title="Review Creative details" disabled/);

console.log('selection-disabled rows retain actionable detail links');
