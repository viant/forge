import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const component = readFileSync(resolve(root, 'Basic.jsx'), 'utf8');
const css = readFileSync(resolve(root, 'Basic.css'), 'utf8');

assert.match(component, /container\?\.table\?\.density[\s\S]*is-compact-density/);
assert.match(css, /is-compact-density \.basic-table-filterbar[\s\S]*min-height:\s*36px !important/);
assert.match(css, /is-compact-density \.basic-table-paginationbar[\s\S]*min-height:\s*36px !important/);
assert.match(css, /is-compact-density table th[\s\S]*is-compact-density table td[\s\S]*height:\s*22px !important[\s\S]*white-space:\s*nowrap/);

console.log('compact table density contract passed');
