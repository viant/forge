import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {HorizontalBarValueLabel} from './Chart.jsx';
const label=value=>renderToStaticMarkup(<svg><HorizontalBarValueLabel value={value} formatter={v=>`$${Number(v).toFixed(2)}`}/></svg>);
for(const value of [undefined,null,NaN,Infinity,''])assert.equal(label(value),'<svg></svg>','Missing/nonfinite observations must not display as zero');
assert.match(label(0),/>\$0\.00</,'An explicit observed zero must remain visible');
assert.match(label(.76),/>\$0\.76</);
console.log('PASS horizontal bar labels distinguish missing observations from observed zero');
