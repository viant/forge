import assert from 'node:assert/strict';
import {findPaginationScrollContainer, resetPaginationScroll} from './paginationScroll.js';

const windowScroller = {
    scrollTop: 1118,
    scrollLeft: 40,
    clientHeight: 600,
    scrollHeight: 1700,
    parentElement: null,
    getBoundingClientRect: () => ({top: 0}),
};
const visibleParent = {
    scrollTop: 0,
    clientHeight: 500,
    scrollHeight: 1600,
    parentElement: windowScroller,
};
const scroller = {
    scrollTop: 480,
    scrollLeft: 120,
    clientHeight: 1457,
    scrollHeight: 1457,
    parentElement: visibleParent,
    getBoundingClientRect: () => ({top: -900}),
};
const styleReader = (element) => ({
    overflowY: element === windowScroller ? 'auto' : 'visible',
});

assert.equal(findPaginationScrollContainer(scroller, styleReader), windowScroller);
assert.equal(resetPaginationScroll(scroller, false, styleReader), true);
assert.equal(scroller.scrollTop, 0);
assert.equal(scroller.scrollLeft, 120);
assert.equal(windowScroller.scrollTop, 218);
assert.equal(windowScroller.scrollLeft, 40);

scroller.scrollTop = 320;
windowScroller.scrollTop = 1118;
assert.equal(resetPaginationScroll(scroller, true, styleReader), false);
assert.equal(scroller.scrollTop, 320);
assert.equal(windowScroller.scrollTop, 1118);

assert.equal(resetPaginationScroll(null), false);

console.log('pagination scroll tests passed');
