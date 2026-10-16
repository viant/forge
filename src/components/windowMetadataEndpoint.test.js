import assert from 'node:assert/strict';
import {windowMetadataEndpoint} from './windowMetadataEndpoint.js';

for (const key of ['window://example/StudioRecords', 'window://example/folder/nested/records', 'chat/new', 'orders/detail', 'order']) {
    const endpoint = windowMetadataEndpoint('/window', key);
    assert.equal(endpoint, `/window/${encodeURIComponent(key)}`);
    assert.equal(decodeURIComponent(endpoint.slice('/window/'.length)), key);
    const parsed = new URL(endpoint, 'http://fixture.local');
    assert.equal(parsed.pathname.split('/').length, 3, 'the key must occupy one encoded path segment');
    assert.equal(parsed.search, '');
    assert.equal(parsed.hash, '');
}
assert.equal(windowMetadataEndpoint('/window/', 'chat/new'), '/window/chat%2Fnew');
assert.equal(windowMetadataEndpoint('/window', 'window://example/space name'), '/window/window%3A%2F%2Fexample%2Fspace%20name');
console.log('window metadata endpoint path encoding passed');
const scoped = new URL(windowMetadataEndpoint('/window', 'window://external/picker', {resourceRef:{uri:'window://external/picker',revision:'working'},providerIdentity:'source'}),'http://fixture.local');
assert.deepEqual(JSON.parse(scoped.searchParams.get('resourceRef')),{uri:'window://external/picker',revision:'working'});
assert.equal(scoped.searchParams.get('providerIdentity'),'source');
