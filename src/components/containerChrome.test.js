import assert from 'node:assert/strict';

import {
    mergeSectionOpenState,
    resolveSectionAppearance,
    resolveSectionContentInset,
    resolveSectionOpenState,
    resolveSectionProperties,
    sectionAppearanceAttributes,
    sectionContentInsetAttributes,
} from './containerChrome.js';

assert.equal(resolveSectionAppearance(), '');
assert.equal(resolveSectionAppearance({appearance: ' PRIMARY '}), 'primary');
assert.equal(resolveSectionAppearance({appearance: 'Quiet'}), 'quiet');
assert.equal(resolveSectionAppearance({appearance: 'card'}), '');
assert.deepEqual(sectionAppearanceAttributes(), {});
assert.deepEqual(
    sectionAppearanceAttributes({appearance: 'quiet'}),
    {'data-forge-section-appearance': 'quiet'},
);
assert.equal(resolveSectionContentInset(), '');
assert.equal(resolveSectionContentInset({contentInset: 'flush'}), 'flush');
assert.equal(resolveSectionContentInset({contentInset: ' FLUSH '}), 'flush');
assert.equal(resolveSectionContentInset({contentInset: 'compact'}), '');
assert.deepEqual(sectionContentInsetAttributes(), {});
assert.deepEqual(
    sectionContentInsetAttributes({contentInset: 'flush'}),
    {'data-forge-section-content-inset': 'flush'},
);
assert.deepEqual(sectionContentInsetAttributes({contentInset: 'compact'}), {});

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
