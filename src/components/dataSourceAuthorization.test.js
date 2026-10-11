import assert from 'node:assert/strict';
import {isProtectedUpstreamDenial} from './dataSourceAuthorization.js';

const protectedContext = {identity: {windowId: 'orders'}, metadata: {authorizationSnapshot: {authorizationVersion: 'v1'}}};
assert.equal(isProtectedUpstreamDenial(protectedContext, {status: 403}), true);
assert.equal(isProtectedUpstreamDenial(protectedContext, {status: 401}), true);
assert.equal(isProtectedUpstreamDenial(protectedContext, {status: 500}), false);
assert.equal(isProtectedUpstreamDenial({identity: {windowId: 'orders'}, metadata: {}}, {status: 403}), false);
assert.equal(isProtectedUpstreamDenial({identity: {}, metadata: protectedContext.metadata}, {status: 403}), false);
assert.equal(isProtectedUpstreamDenial(protectedContext, {status:403,code:'datasource_denied',scope:'dataset'}),false);
assert.equal(isProtectedUpstreamDenial(protectedContext, {status:401,code:'datasource_denied',scope:'dataset'}),true);
assert.equal(isProtectedUpstreamDenial(protectedContext, {status:403,message:'datasource_denied'}),true);

assert.equal(isProtectedUpstreamDenial(protectedContext,{status:409,code:'conflict'}),true);

for (const scope of [undefined, 'window', 'other']) {
 assert.equal(isProtectedUpstreamDenial(protectedContext, {status:403,code:'datasource_denied',scope}),true);
}
