import {describe, expect, it} from 'vitest';
import {hasResolvedDependencies} from './DataSource.jsx';

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
