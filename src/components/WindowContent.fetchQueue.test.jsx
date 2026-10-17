import {expect, it} from 'vitest';
import {shouldPrimeDataSourceFetch, resolveWindowDataSourceFetchFlag} from './WindowContent.jsx';

it('queues changed parameters during an in-flight read without re-priming the same request', () => {
    const loading = {loaded: false, loading: true};
    const pending = shouldPrimeDataSourceFetch({}, {fetch: false}, [], true, loading);
    expect(resolveWindowDataSourceFetchFlag({fetchOwnedByContainer: true, paramsChanged: true, shouldFetch: pending})).toBe(true);
    // An unrelated window render while the old request is still running must
    // retain this intent for the datasource to consume after completion.
    expect(shouldPrimeDataSourceFetch({}, {fetch: true}, [], false, loading)).toBe(true);
    expect(shouldPrimeDataSourceFetch({}, {fetch: false}, [], false, loading)).toBe(false);
});

it('does not queue automatic requests for deferred or terminal denied data', () => {
    const loading = {loading: true};
    expect(shouldPrimeDataSourceFetch({autoFetch:false}, {}, [], true, loading)).toBe(false);
    expect(shouldPrimeDataSourceFetch({}, {}, [], true, loading, {deferAutomatic:true})).toBe(false);
    expect(shouldPrimeDataSourceFetch({}, {}, [], true, {loading:true,error:{status:403,code:'datasource_denied',scope:'dataset'}})).toBe(false);
});
