import assert from 'node:assert/strict';
import {formatDataSourceError, normalizeDataSourceError} from './dataSourceError.js';

const internal = normalizeDataSourceError({
    status: 500,
    message: 'GET error: 500 Internal Server Error: {"view":"tree","parameter":"Auth"}',
});
assert.equal(String(internal), 'This data is temporarily unavailable. Retry in a moment.');
assert.match(internal.message, /parameter.*Auth/, 'raw diagnostics remain available to logs');
assert.equal(formatDataSourceError('seed "AudienceParse": {"status":"error","message":"Internal Server Error"}'), 'This data is temporarily unavailable. Retry in a moment.');
assert.equal(formatDataSourceError({status: 504, message: 'upstream timeout'}), 'The request timed out. Retry in a moment.');
assert.equal(formatDataSourceError({status: 403, message: 'forbidden'}), 'Access denied. You do not have permission to load this data.');
console.log('datasource errors ✓ user-safe 5xx/timeout/auth messages with raw diagnostics retained');
