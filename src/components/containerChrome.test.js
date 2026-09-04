import assert from 'node:assert/strict';

import {mergeSectionOpenState, resolveSectionOpenState, resolveSectionProperties} from './containerChrome.js';

assert.deepEqual(resolveSectionProperties(), {collapsible: false});
assert.deepEqual(resolveSectionProperties({collapsible: true}), {collapsible: true});
assert.deepEqual(
    resolveSectionProperties({
        collapsible: true,
        properties: {
            className: 'compact-section-shell',
            compact: true,
            collapseProps: {defaultIsOpen: true, keepChildrenMounted: true},
        },
    }),
    {
        className: 'compact-section-shell',
        compact: true,
        collapsible: true,
        collapseProps: {defaultIsOpen: true, keepChildrenMounted: true},
    },
);

console.log('containerChrome ✓');

const persistentSection = {
    collapsible: true,
    persistState: true,
    stateKey: 'profileProperties',
    properties: {collapseProps: {defaultIsOpen: true}},
};
assert.equal(resolveSectionOpenState(persistentSection, {}), true);
assert.equal(resolveSectionOpenState(persistentSection, {sections: {profileProperties: {isOpen: false}}}), false);
assert.deepEqual(
    mergeSectionOpenState({tabs: {root: 'details'}}, 'profileProperties', false),
    {tabs: {root: 'details'}, sections: {profileProperties: {isOpen: false}}},
);
