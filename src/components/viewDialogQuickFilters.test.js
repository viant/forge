import { getQuickFilterValue, mergeQuickFilterValue, buildQuickFilterSeed, withoutQuickFilterParameters } from './viewDialogQuickFilters.js';

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



const initialParameters = {AdOrderId: [2706757], AdvertiserId: 42};
const specs = [{field: 'AdOrderId'}];
const seed = buildQuickFilterSeed(initialParameters, specs);
const fixed = withoutQuickFilterParameters(initialParameters, specs);
assert(seed.AdOrderId === '2706757', 'selected order seeds the editable filter');
assert(fixed.AdOrderId === undefined && fixed.AdvertiserId === 42, 'only quick-filter parameters are removed');
const cleared = mergeQuickFilterValue(seed, 'AdOrderId', '');
assert(({...fixed, ...cleared}).AdOrderId === undefined, 'clearing the ID cannot restore the initial selected ID');
assert(initialParameters.AdOrderId[0] === 2706757, 'caller parameters remain unchanged');
const nestedParameters = {Body: {query: 'initial', account: 42}, Limit: 20};
const nestedFixed = withoutQuickFilterParameters(nestedParameters, [{field: 'Body.query'}]);
assert(nestedFixed.Body.query === undefined && nestedFixed.Body.account === 42 && nestedFixed.Limit === 20, 'nested quick filters preserve sibling scope and paging');
assert(nestedParameters.Body.query === 'initial', 'nested caller parameters remain unchanged');

console.log('viewDialogQuickFilters \u2713');
