import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {normalizeChartExtent} from './chartExtent.js';
for(const value of [300,'300',' 300 ','300.0']) {
 assert.equal(normalizeChartExtent(value,240),300);
 assert.match(renderToStaticMarkup(React.createElement('div',{style:{height:normalizeChartExtent(value,240)}})),/height:300px/);
}
for(const value of ['300px','100%','calc(100vh - 80px)']) assert.equal(normalizeChartExtent(value,240),value);
for(const value of ['',null,undefined,NaN,Infinity]) assert.equal(normalizeChartExtent(value,240),240);
assert.equal(normalizeChartExtent('0',240),0);
console.log('Chart extents preserve units and normalize serialized pixel dimensions.');
