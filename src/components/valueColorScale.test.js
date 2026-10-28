import assert from 'node:assert/strict';
import {normalizeValueColor,resolveValueColor,valueColorAt,valueColorGradient} from './valueColorScale.js';
// Thirteen independently invented neutral stops, not a retained source palette.
const colors=Array.from({length:13},(_,i)=>'#'+[16+i*16,24+i*16,32+i*16].map(v=>v.toString(16).padStart(2,'0')).join(''));
const config={field:'temperature',colors,domain:{mode:'diverging',center:0,fullRange:false},opacity:.8};
const model=resolveValueColor(config,[{temperature:-10},{temperature:100},{temperature:null}]);
assert.deepEqual(model.domain,[-100,0,100]);assert.equal(valueColorAt(model,0),colors[6]);assert.equal(valueColorAt(model,100),colors[12]);assert.equal(valueColorAt(model,-100),colors[0]);
const reverse=resolveValueColor({...config,reverse:true},[{temperature:100}]);assert.equal(valueColorAt(reverse,100),colors[0]);
const full=valueColorGradient(model,[-100,100]);assert.equal(full.stops.length,13);assert.deepEqual(full.stops.map(stop=>stop.color),colors);
assert.equal(valueColorGradient(model,[0,0]).color,colors[6]);assert.equal(valueColorAt(model,null),null);
assert.deepEqual(resolveValueColor({...config,domain:{mode:'extent'}},[{temperature:0}]).domain,[0,0]);assert.equal(resolveValueColor(config,[]).domain,null);
assert.throws(()=>resolveValueColor(config,[{}]),/missing/);assert.throws(()=>normalizeValueColor({...config,domain:{mode:'diverging'}}),/finite center/);
assert.throws(()=>normalizeValueColor({...config,colors:['red','#ffffff']}),/hex/);
console.log('explicit quantitative color domain, 13 stops, reverse, opacity, null and degenerate gradients passed');

const asymmetric=resolveValueColor({...config,domain:{mode:'diverging',center:0,fullRange:true}},[{temperature:-10},{temperature:0},{temperature:100}]);
assert.deepEqual(asymmetric.domain,[-10,0,100]);assert.equal(valueColorAt(asymmetric,-10),colors[0]);assert.equal(valueColorAt(asymmetric,0),colors[6]);assert.equal(valueColorAt(asymmetric,100),colors[12]);
assert.notEqual(valueColorAt(model,-10),colors[0]);assert.equal(valueColorGradient(asymmetric,[-10,0,100]).stops.length,13);

const fixed=resolveValueColor({...config,domain:{mode:'fixed',min:0,max:10}},[{temperature:-100},{temperature:100}]);
assert.deepEqual(fixed.domain,[0,10]);assert.equal(valueColorAt(fixed,-100),colors[0]);assert.equal(valueColorAt(fixed,100),colors[12]);
