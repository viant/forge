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
    kind: 'external',
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
    kind: 'external',
    href: 'https://example.com/accounts/secondary',
    text: 'Secondary account',
    target: '_blank',
    rel: 'noopener noreferrer',
    title: '',
  },
);

assert.deepEqual(
  resolveTableLink({
    row: { adOrderId: 123, campaignId: 456, name: 'Order Alpha' },
    column: {
      id: 'name',
      type: 'link',
      link: {
        kind: 'window',
        windowKey: 'order',
        windowTitle: 'Order',
        parameters: {
          AdOrderId: { source: 'row', selector: 'adOrderId', wrap: 'array' },
          CampaignId: { source: 'row', selector: 'campaignId', wrap: 'array' },
        },
      },
    },
    value: 'Order Alpha',
  }),
  {
    kind: 'window',
    text: 'Order Alpha',
    title: '',
    windowKey: 'order',
    windowTitle: 'Order',
    inTab: true,
    newInstance: false,
    autoIndexTitle: false,
    awaitResult: false,
    modal: false,
    size: undefined,
    width: undefined,
    height: undefined,
    footer: undefined,
    parameters: {
      AdOrderId: [123],
      CampaignId: [456],
    },
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

assert.equal(
  resolveTableCellText({
    row: { orderId: 553524 },
    column: { id: 'orderId', name: 'Order ID' },
    value: 553524,
  }),
  '553524',
);

assert.equal(
  resolveTableCellText({
    row: { spend: 12345.67 },
    column: { id: 'spend', name: 'Spend', format: 'currency' },
    value: 12345.67,
  }),
  '$12,346',
);
