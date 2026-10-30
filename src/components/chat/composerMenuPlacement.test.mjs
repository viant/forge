import assert from 'node:assert/strict';
import {composerMenuPlacement} from './composerMenuPlacement.js';

const viewport = {offsetTop: 0, height: 800};
assert.equal(composerMenuPlacement({top:200,bottom:244}, 228, viewport).placement, 'bottom-start');
assert.equal(composerMenuPlacement({top:600,bottom:644}, 228, viewport).placement, 'top-start');
assert.equal(composerMenuPlacement({top:300,bottom:344}, 228, viewport).placement, 'top-start');
assert.deepEqual(composerMenuPlacement({top:150,bottom:194}, 400, {offsetTop:0,height:300}), {placement:'top-start',maxHeight:130});
assert.deepEqual(composerMenuPlacement({top:70,bottom:114}, 400, {offsetTop:0,height:300}), {placement:'bottom-start',maxHeight:166});
assert.equal(composerMenuPlacement({top:350,bottom:394}, 228, {offsetTop:200,height:400}).placement, 'bottom-start');
console.log('Composer menu group placement passed');
