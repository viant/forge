import assert from 'node:assert/strict';
import {resolveScopedWindowKey} from './windowResourceKey.js';

assert.equal(resolveScopedWindowKey('advertiser', 'window://dspui/advertiserList'), 'window://dspui/advertiser');
assert.equal(resolveScopedWindowKey('nested/detail', 'window://example/parent'), 'window://example/nested/detail');
assert.equal(resolveScopedWindowKey('window://other/detail', 'window://example/parent'), 'window://other/detail');
assert.equal(resolveScopedWindowKey('provider:legacy:detail', 'window://example/parent'), 'provider:legacy:detail');
assert.equal(resolveScopedWindowKey('detail', 'local/parent'), 'detail');
for (const name of ['../other', 'a/../b', '/detail', 'a//b', 'a?query', '%2e%2e/path']) {
    assert.throws(() => resolveScopedWindowKey(name, 'window://example/parent'));
}
console.log('scoped window routing contracts passed');
