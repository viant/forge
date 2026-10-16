// Compatibility exports only. A UI must never extend a delivered permission
// lease. Canonical artifact expiry requires a distinct server delivery.
export function windowAuthorizationRenewalSignature() { return ''; }
export function retainWindowAuthorizationLease() { return false; }
export function authorizationRenewalDelay() { return Infinity; }
