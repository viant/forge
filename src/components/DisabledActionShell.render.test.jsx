import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import DisabledActionShell from './DisabledActionShell.jsx';

const html = renderToStaticMarkup(<DisabledActionShell reason="Unsafe writer" label="Save"><button disabled>Save</button></DisabledActionShell>);
assert.match(html, /class="forge-disabled-action-shell"/);
assert.match(html, /tabindex="0"/);
assert.match(html, /aria-label="Save\. Unsafe writer"/);
assert.match(html, /aria-expanded="false"/);
assert.match(html, /data-disabled-reason="Unsafe writer"/);
assert.match(html, /<button disabled="">Save<\/button>/);
console.log('disabled action explanation render contract passed');
