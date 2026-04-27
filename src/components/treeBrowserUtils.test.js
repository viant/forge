import assert from 'node:assert/strict';
import { buildTreeBrowserNodes } from './treeBrowserUtils.js';

const flatRows = [
    { value: '1', path: ['IRIS Categories', 'Contextual', 'Sports'] },
    { value: '2', path: ['IRIS Categories', 'Contextual', 'Technology'] },
    { value: '3', path: ['IRIS Categories', 'Genre', 'Drama'] },
];

const flatTree = buildTreeBrowserNodes(flatRows, {});
assert.equal(flatTree.length, 1);
assert.equal(flatTree[0].label, 'IRIS Categories');
assert.equal(flatTree[0].childNodes.length, 2);
assert.equal(flatTree[0].childNodes[0].label, 'Contextual');
assert.equal(flatTree[0].childNodes[0].childNodes[0].label, 'Sports');
assert.equal(flatTree[0].childNodes[0].childNodes[0].fullValue, '1');

const nestedRows = [
    {
        id: 'root',
        label: 'Root',
        childNodes: [
            { id: 'child-1', label: 'Child 1' },
            { id: 'child-2', label: 'Child 2' },
        ],
    },
];

const nestedTree = buildTreeBrowserNodes(nestedRows, {
    labelField: 'label',
    valueField: 'id',
    childrenField: 'childNodes',
});
assert.equal(nestedTree.length, 1);
assert.equal(nestedTree[0].label, 'Root');
assert.equal(nestedTree[0].childNodes.length, 2);
assert.equal(nestedTree[0].childNodes[1].label, 'Child 2');
assert.equal(nestedTree[0].childNodes[1].fullValue, 'child-2');

console.log('treeBrowserUtils ✓');
