import assert from 'node:assert/strict';
import { compactTableColumnWidth, frozenIdentifierColumn, withFrozenIdentifierColumn } from './tableFrozenIdentifier.js';

// Independently invented compound identities: keys, labels and print identity
// anchors never imply a different presentation order or column width.
for (const firstKey of ['teamName', 'TeamName', 'team_name']) {
    const columns = [{key:firstKey,label:'Team'}, {key:'teamId',label:'Team ID',rowIdentity:true}, {key:'itemName',label:'Item'}, {key:'itemId',label:'Item ID',rowIdentity:true}];
    assert.equal(frozenIdentifierColumn(columns), columns[0]);
    const decorated = withFrozenIdentifierColumn(columns);
    assert.deepEqual(decorated.map(column=>column.key), columns.map(column=>column.key));
    assert.deepEqual(decorated.map(column=>column.frozen), [true,false,false,false]);
    assert.deepEqual(decorated.map(column=>column.resolvedCompactWidth), [148,148,148,148]);
    assert.deepEqual(decorated.filter(column=>column.rowIdentity).map(column=>column.key), ['teamId','itemId']);
    const explicitColumns = columns.map((column,index)=>({...column,frozen:index===2}));
    assert.equal(frozenIdentifierColumn(explicitColumns), explicitColumns[2], 'Explicit frozen metadata still wins');
    assert.deepEqual(withFrozenIdentifierColumn(explicitColumns).map(column=>column.key), ['itemName',firstKey,'teamId','itemId']);
    assert.equal(columns.some(column=>'frozen' in column),false,'Source metadata is not mutated');
}
for(const width of [100,220,280])assert.equal(compactTableColumnWidth({key:'item',width}),width);
assert.equal(compactTableColumnWidth({width:20}),76);
assert.equal(compactTableColumnWidth({width:400}),280);
for(const width of [0,-1,NaN,Infinity,undefined])assert.equal(compactTableColumnWidth({width}),148);
assert.equal(frozenIdentifierColumn([]),null);
assert.equal(frozenIdentifierColumn(null),null);
assert.deepEqual(withFrozenIdentifierColumn([]),[]);
assert.deepEqual(withFrozenIdentifierColumn(null),[]);
console.log('tableFrozenIdentifier ✓ source order, explicit frozen metadata, compound identities and neutral widths');
