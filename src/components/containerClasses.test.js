import assert from 'node:assert/strict';
import {hasContainerClass,containerSurfaceClass} from './containerClasses.js';
import {containerSizingStyle} from './containerSizing.js';
assert.equal(hasContainerClass({className:'other forge-container-hidden'},'forge-container-hidden'),true);
assert.equal(hasContainerClass({className:'forge-container-hiddenish'},'forge-container-hidden'),false);
assert.equal(containerSizingStyle({className:'forge-container-hidden'}).display,undefined);
assert.equal(containerSizingStyle({className:'forge-container-hidden'},'fill',{chrome:true}).display,'flex');
assert.equal(containerSurfaceClass({className:'forge-container-plain'},'section','compact'),'forge-container forge-container-section forge-container-plain compact');
console.log('Container class ownership and hidden mounted-body sizing passed.');
