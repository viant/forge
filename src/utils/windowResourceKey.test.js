import assert from 'node:assert/strict';
import {resolveScopedWindowKey} from './windowResourceKey.js';

assert.equal(resolveScopedWindowKey('advertiser', 'window://sampleui/advertiserList'), 'window://sampleui/advertiser');
assert.equal(resolveScopedWindowKey('nested/detail', 'window://example/parent'), 'window://example/nested/detail');
assert.equal(resolveScopedWindowKey('window://other/detail', 'window://example/parent'), 'window://other/detail');
assert.equal(resolveScopedWindowKey('provider:legacy:detail', 'window://example/parent'), 'provider:legacy:detail');
assert.equal(resolveScopedWindowKey('detail', 'local/parent'), 'detail');
for (const name of ['../other', 'a/../b', '/detail', 'a//b', 'a?query', '%2e%2e/path']) {
    assert.throws(() => resolveScopedWindowKey(name, 'window://example/parent'));
}
console.log('scoped window routing contracts passed');

// A locator is retained only from the active runtime's full delivery identity.
const {scopedWindowProviderIdentity} = await import('./windowResourceKey.js');
const source={uri:'window://workspace/list',providerIdentity:'workspace-owner',kind:'stamped',revision:'17',contentFingerprint:'source-content',authorityBinding:'actor-workspace'};
assert.equal(scopedWindowProviderIdentity('window://workspace/detail',source),'workspace-owner');
assert.equal(scopedWindowProviderIdentity('window://foreign/detail',source),undefined);
assert.equal(scopedWindowProviderIdentity('detail',source),undefined);
for(const field of ['providerIdentity','kind','uri','contentFingerprint','authorityBinding']){
 const missing={...source};delete missing[field];assert.equal(scopedWindowProviderIdentity('window://workspace/detail',missing),undefined);
}
for(const target of ['window://workspace/../detail','window://workspace/detail?revision=17','window://workspace/detail#fragment','window://workspace//detail']){
 assert.equal(scopedWindowProviderIdentity(target,source),undefined);
}
assert.equal(scopedWindowProviderIdentity('window://workspace/detail',{...source,providerIdentity:'new-owner',authorityBinding:'new-actor'}),'new-owner');
assert.equal(source.revision,'17');
