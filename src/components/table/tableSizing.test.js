import assert from 'node:assert/strict';

import {tableAvailableHeight, tableTrailingSpace, tableSurfaceWidth, tableRowSlots, preserveDeclaredColumnWidths, scrollableTableWidth, tableBackfillCount, withStickyColumnOffsets} from './tableSizing.js';

const columns = preserveDeclaredColumnWidths([{id: 'id', width: 90}, {id: 'name', width: 320}, {id: 'type', width: 150}]);
assert.deepEqual(columns.map((column) => column.minWidth), ['90px', '320px', '150px']);
assert.equal(scrollableTableWidth(columns, 500), 560);
assert.equal(scrollableTableWidth(columns, 800), 800);
assert.equal(tableBackfillCount(25, 4, false), 0);
assert.equal(tableBackfillCount(25, 4, true), 21);
assert.equal(tableBackfillCount(25, 0, false), 1);
const sticky = withStickyColumnOffsets(preserveDeclaredColumnWidths([
  {id: 'select', width: 42, sticky: 'left'},
  {id: 'id', width: 88, sticky: 'left'},
  {id: 'name', width: 280, sticky: 'left'},
  {id: 'spend', width: 120},
]));
assert.deepEqual(sticky.map((column) => column.stickyOffset), [0, 42, 130, undefined]);
assert.deepEqual(sticky.map((column) => column.stickyEdge), [false, false, true, false]);

console.log('tableSizing ✓');

const narrow = withStickyColumnOffsets([{id:'id',width:88,sticky:'left'},{id:'name',width:280,sticky:'left'}], 390);
assert.equal(narrow[0].stickyOffset,0);
assert.equal(narrow[1].sticky,false);
assert.equal(preserveDeclaredColumnWidths([{width:'140px'}])[0].minWidth,'140px');

assert.deepEqual(tableRowSlots({},3),{minRows:0,rowHeight:0,blanks:0});
assert.deepEqual(tableRowSlots({minRows:10},3),{minRows:10,rowHeight:32,blanks:7});
assert.equal(tableRowSlots({minRows:10},12).blanks,0);

assert.equal(tableSurfaceWidth({fullWidth:false},[{width:80},{width:160},{width:120},{width:140}]),'min(100%, 502px)');
assert.equal(tableSurfaceWidth({fullWidth:false},[{width:900},{width:900}]),'min(100%, 1802px)');
assert.equal(tableSurfaceWidth({fullWidth:true},[{width:80}]),'100%');
assert.equal(tableSurfaceWidth({fullWidth:false,width:'640px'},[{width:80}]),'640px');

assert.equal(tableSurfaceWidth({},[{width:499}],1000),'min(100%, 501px)');
assert.equal(tableSurfaceWidth({},[{width:500}],1000),'100%');
assert.equal(tableSurfaceWidth({},[{width:600}],1000),'100%');
assert.equal(tableSurfaceWidth({fullWidth:false},[{width:600}],1000),'min(100%, 602px)');

assert.deepEqual(tableTrailingSpace([{width:80},{width:220}],1000),{widths:[80,220],naturalWidth:300,fillerWidth:700});
assert.equal(tableTrailingSpace([{width:900},{width:900}],1000).fillerWidth,0);
assert.equal(tableSurfaceWidth({fillRemainingWidth:true},[{width:80}],1000),'100%');

// A 390×844 companion picker has a footer below its 688px body. The
// viewport-only cap was 738px, leaving the last checkbox behind that footer.
const body = {parentElement:null, clientTop:0, clientHeight:688,
    getBoundingClientRect:()=>({top:98}), style:{overflowY:'auto',paddingBottom:'16px',maxHeight:'688px',boxSizing:'border-box'}};
const table = {parentElement:body,getBoundingClientRect:()=>({top:114})};
assert.equal(tableAvailableHeight(table,844,node=>node.style),656);
const content = {parentElement:body,clientHeight:750,getBoundingClientRect:()=>({top:114}),style:{overflowY:'visible'}};
table.parentElement=content;
assert.equal(tableAvailableHeight(table,844,node=>node.style),656,'content-sized layout wrappers do not create a cap');
body.clientHeight=500;body.style.maxHeight='500px';
assert.equal(tableAvailableHeight(table,844,node=>node.style),468,'a resized dialog tightens the cap');
table.parentElement=null;
assert.equal(tableAvailableHeight(table,844,node=>node.style),714,'standalone tables keep the viewport margin');

body.clientHeight=100;body.style.maxHeight='688px';table.parentElement=body;
assert.equal(tableAvailableHeight(table,844,node=>node.style),656,'an empty dialog can grow as rows arrive without feeding back its old table cap');

body.style.maxHeight='100%';body.clientHeight=500;
assert.equal(tableAvailableHeight(table,844,node=>node.style),468,'unresolved percentages are not interpreted as pixel heights');
body.style.maxHeight='500px';body.style.boxSizing='content-box';body.style.paddingTop='16px';
assert.equal(tableAvailableHeight(table,844,node=>node.style),500,'content-box maxima include padding in the scrollport');
