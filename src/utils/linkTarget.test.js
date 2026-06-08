import assert from 'node:assert/strict';

import { resolveLinkTarget } from './linkTarget.js';

const row = {
  id: 123,
  campaignId: 456,
  name: 'Order Alpha',
  url: 'https://example.com/orders/123',
};

assert.deepEqual(
  resolveLinkTarget({
    row,
    value: row.name,
    linkConfig: {
      href: 'url',
      label: 'name',
    },
  }),
  {
    kind: 'external',
    href: 'https://example.com/orders/123',
    text: 'Order Alpha',
    target: '_blank',
    rel: 'noopener noreferrer',
    title: '',
  },
);

assert.deepEqual(
  resolveLinkTarget({
    row,
    value: row.name,
    linkConfig: {
      kind: 'window',
      windowKey: 'order',
      windowTitleSource: 'value',
      parameters: {
        AdOrderId: { source: 'row', selector: 'id', wrap: 'array' },
      },
    },
  }),
  {
    kind: 'window',
    text: 'Order Alpha',
    title: '',
    windowKey: 'order',
    windowTitle: 'Order Alpha',
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
    },
  },
);

assert.deepEqual(
  resolveLinkTarget({
    row,
    value: row.name,
    linkConfig: {
      windowKey: 'order',
      windowTitle: 'Order',
      parameters: {
        AdOrderId: { source: 'row', selector: 'id', wrap: 'array' },
      },
    },
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
    },
  },
);

assert.deepEqual(
  resolveLinkTarget({
    row,
    value: row.name,
    linkConfig: {
      kind: 'window',
      windowKey: 'order',
      windowTitle: 'Order',
      parameters: {
        AdOrderId: { source: 'row', selector: 'id', wrap: 'array' },
        CampaignId: { source: 'row', selector: 'campaignId', wrap: 'array' },
      },
    },
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
