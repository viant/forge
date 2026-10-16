import assert from 'node:assert/strict';
import {authorizationRenewalDelay,retainWindowAuthorizationLease,windowAuthorizationRenewalSignature} from './windowAuthorizationRefresh.js';
const held={authorizationSnapshot:{expiresAt:'2000-01-01T00:00:00Z'}};
const fresh={authorizationSnapshot:{expiresAt:'2999-01-01T00:00:00Z'}};
assert.equal(retainWindowAuthorizationLease(held,fresh,'same'),false);
assert.equal(held.authorizationSnapshot.expiresAt,'2000-01-01T00:00:00Z');
assert.equal(windowAuthorizationRenewalSignature(held),'');
assert.equal(authorizationRenewalDelay(held.authorizationSnapshot),Infinity);
console.log('UI permission lease renewal is retired ✓');
