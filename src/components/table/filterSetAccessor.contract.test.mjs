import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('./Basic.jsx', import.meta.url), 'utf8');

assert.match(source, /getFilterSets\?\.\(\)[\s\S]*getFilterSet\?\.\(\)[\s\S]*dataSource\?\.filterSet/);

console.log('table filter-set accessor contract ✓');
