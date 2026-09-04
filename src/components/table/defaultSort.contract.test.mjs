import assert from 'node:assert/strict';
import fs from 'node:fs';

const basic = fs.readFileSync(new URL('./Basic.jsx', import.meta.url), 'utf8');
const model = fs.readFileSync(new URL('../../../backend/types/model.go', import.meta.url), 'utf8');

assert.match(basic, /container\?\.table\?\.defaultSort\?\.columnId/);
assert.match(basic, /defaultSort\?\.direction/);
assert.match(model, /DefaultSort\s+\*TableSort/);
assert.match(model, /type TableSort struct/);

console.log('table default sort contract ✓ metadata initializes sortable presentation state');
