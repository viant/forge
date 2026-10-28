import assert from 'node:assert/strict';import React from 'react';import{renderToStaticMarkup}from'react-dom/server';import KpiSparkline from './KpiSparkline.jsx';
const html=renderToStaticMarkup(<KpiSparkline label="Impressions daily trend" content={{values:[3,null,0],comparisonValues:[2,4]}}/>);
assert.match(html,/role="img"/);assert.match(html,/aria-label="Impressions daily trend \(solid:/);assert.match(html,/solid: selected period; dashed: prior period/);assert.match(html,/stroke-dasharray="3 2"/);assert.equal((html.match(/<circle/g)||[]).length,2);assert.ok(!html.includes('<button'));assert.ok(!html.includes('NaN'));assert.match(html,/max-width:100%/);
assert.equal(renderToStaticMarkup(<KpiSparkline content={{values:[null,null]}}/>),'');assert.match(renderToStaticMarkup(<KpiSparkline content={{values:[0,0]}}/>),/<path/);
console.log('KpiSparkline ✓ accessible label, null gaps, isolated observations, real zero, responsive SVG, no controls');

const colored=renderToStaticMarkup(<KpiSparkline content={{values:[0,100,null,50],valueColor:{field:'amount',colors:['#000000','#ffffff'],domain:[0,100],opacity:.4}}}/>);
assert.match(colored,/stroke-opacity="0.4"/);assert.match(colored,/fill-opacity="0.4" fill="#808080"/);assert.doesNotMatch(colored,/forge-report-chart-primary|NaN|linearGradient/);
assert.ok((colored.match(/<path/g)||[]).length>20);
