import assert from 'node:assert/strict';

import {resolveTableCellText, resolveTableLink} from './tableLink.js';

const row = {
  name: 'Primary account',
  url: 'https://example.com/accounts/primary',
  structured: {
    href: 'https://example.com/accounts/secondary',
    label: 'Secondary account',
  },
};

assert.deepEqual(
  resolveTableLink({
    row,
    column: {id: 'name', type: 'link', link: {href: 'url'}},
    value: row.name,
  }),
  {
    href: 'https://example.com/accounts/primary',
    text: 'Primary account',
    target: '_blank',
    rel: 'noopener noreferrer',
    title: '',
  },
);

assert.deepEqual(
  resolveTableLink({
    row,
    column: {id: 'structured', type: 'link'},
    value: row.structured,
  }),
  {
    href: 'https://example.com/accounts/secondary',
    text: 'Secondary account',
    target: '_blank',
    rel: 'noopener noreferrer',
    title: '',
  },
);

assert.equal(
  resolveTableCellText({
    row,
    column: {id: 'name', type: 'link', link: {href: 'url'}},
    value: row.name,
  }),
  'Primary account',
);

assert.equal(resolveTableLink({row, column: {id: 'name', type: 'link'}, value: ''}), null);
