import {describe, expect, it} from 'vitest';
import {hasResolvedDependencies} from './dataSourceDependencies.js';
import {applyFetchTransform} from './dataSourceTransform.js';

describe('applyFetchTransform', () => {
    it('lets a datasource transform a completed empty response into derived rows', () => {
        const events = {
            onFetch: {
                isDefined: () => true,
                execute: ({collection}) => [...collection, {id: 'derived'}],
            },
        };

        expect(applyFetchTransform(events, [])).toEqual([{id: 'derived'}]);
    });

    it('preserves the collection when a callback has no array result', () => {
        const events = {
            onFetch: {
                isDefined: () => true,
                execute: () => undefined,
            },
        };

        expect(applyFetchTransform(events, [])).toEqual([]);
    });
});

describe('hasResolvedDependencies', () => {
    it('does not deactivate a datasource for unresolved optional parameters', () => {
        const parameters = [
            {name: 'AgencyId', required: false},
            {name: 'Name', required: false},
        ];
        expect(hasResolvedDependencies(parameters, {}, {})).toBe(true);
    });

    it('still requires unresolved parameters by default', () => {
        expect(hasResolvedDependencies([{name: 'AdvertiserId'}], {}, {})).toBe(false);
    });
});
