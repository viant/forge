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
assert.equal(formatDataSourceError({status: 500, message: 'GET error: 500 Internal Server Error: {"data":[{"name":"private draft"}],"violations":[{"Message":"Order must have at least one channel"}]}'}), 'Order must have at least one channel');
console.log('datasource errors ✓ user-safe 5xx/timeout/auth messages with raw diagnostics retained');

assert.equal(formatDataSourceError({}), 'Unable to load data. Please retry.');
assert.equal(formatDataSourceError({__forgeDataSourceError:true,displayMessage:'   '}), 'Unable to load data. Please retry.');

const invalidRequest = normalizeDataSourceError({status:422,message:'GET failed: {"status":"error","parameters":{"secret":"internal"}}'});
assert.equal(invalidRequest.displayMessage,'Some request parameters are invalid. Check the filters and retry.');
assert.match(invalidRequest.message,/secret/);
assert.equal(formatDataSourceError('HTTP 422: {"status":"error"}'),'Some request parameters are invalid. Check the filters and retry.');

const validation = normalizeDataSourceError({status:500,message:'PATCH failed: {"data":[{"secret":"private"}],"violations":[{"Message":"The selected mode is incompatible with the current goal."}]}'});
assert.equal(validation.displayMessage,'The selected mode is incompatible with the current goal.');
assert.equal(normalizeDataSourceError(validation).displayMessage,validation.displayMessage);
assert.equal(formatDataSourceError(normalizeDataSourceError(validation)),validation.displayMessage);
assert.equal(formatDataSourceError(normalizeDataSourceError(internal)),internal.displayMessage);
assert.doesNotMatch(formatDataSourceError(validation),/private|secret|PATCH failed/);
assert.equal(formatDataSourceError({__forgeDataSourceError:true,status:500,message:'Internal Server Error: {"secret":"private"}',displayMessage:'raw private diagnostics'}),'This data is temporarily unavailable. Retry in a moment.');
console.log('Repeated normalization preserves extracted validation and still sanitizes raw diagnostics.');

const typedValidation = normalizeDataSourceError({status:422,code:'business_validation',message:'The selected value is incompatible with the current settings.'});
assert.equal(formatDataSourceError(typedValidation),'The selected value is incompatible with the current settings.');
assert.equal(formatDataSourceError(normalizeDataSourceError(typedValidation)),typedValidation.displayMessage);
assert.equal(formatDataSourceError({status:403,code:'business_validation',message:'Do not reveal this message'}),'Access denied. You do not have permission to load this data.');
assert.equal(formatDataSourceError({status:401,code:'business_validation',message:'Do not reveal this message'}),'Authentication required. Please sign in to continue.');
