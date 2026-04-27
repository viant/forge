import { getQuickFilterValue, mergeQuickFilterValue } from './viewDialogQuickFilters.js';

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

const filter = mergeQuickFilterValue({}, 'Body.treeLookupParam.filter.filter', 'wood');
assert(
    JSON.stringify(filter) === JSON.stringify({
        Body: { treeLookupParam: { filter: { filter: 'wood' } } },
    }),
    'mergeQuickFilterValue should build nested filter objects from dotted paths'
);

assert(
    getQuickFilterValue(filter, 'Body.treeLookupParam.filter.filter') === 'wood',
    'getQuickFilterValue should read nested quick-filter values from dotted paths'
);

console.log('viewDialogQuickFilters \u2713');
