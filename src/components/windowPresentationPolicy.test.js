import assert from 'node:assert/strict';
import {windowFillsAllocatedSpace,showWindowSelectionFooter} from './windowPresentationPolicy.js';
assert.equal(windowFillsAllocatedSpace({isInTab:false,fillParent:true}),true);
assert.equal(showWindowSelectionFooter({isInTab:false,fillParent:true}),false);
assert.equal(showWindowSelectionFooter({isInTab:false,isModal:true}),true);
assert.equal(showWindowSelectionFooter({isInTab:false,footer:{ok:{label:'Select'}}}),true);
assert.equal(showWindowSelectionFooter({isInTab:false,isModal:true,footer:{hide:true}}),false);
console.log('Allocated floating content and explicit dialog-footer policy passed.');
