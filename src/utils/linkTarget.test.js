import assert from 'node:assert/strict';

import { resolveLinkTarget } from './linkTarget.js';

assert.deepEqual(resolveLinkTarget({
  row: {recordId: 42},
  value: 'Record 42',
  linkConfig: {hrefTemplate: 'https://example.test/records/{{recordId}}', text: 'Open record'},
}), {
  kind: 'external',
  href: 'https://example.test/records/42',
  text: 'Open record',
  target: '_blank',
  rel: 'noopener noreferrer',
  title: '',
});

const row = {
  id: 123,
  campaignId: 456,
  name: 'Order Alpha',
  url: 'https://example.com/orders/123',
};

assert.equal(resolveLinkTarget({
  row,
  value: [],
  linkConfig: {kind: 'association', windowKey: 'order', dialogId: 'associatedOrders'},
}), null);

assert.deepEqual(resolveLinkTarget({
  row,
  value: [{id: 123, name: 'Order Alpha'}],
  linkConfig: {
    kind: 'association',
    windowKey: 'order',
    dialogId: 'associatedOrders',
    parameters: {AdOrderId: {source: 'value', selector: 'id', wrap: 'array'}},
  },
}), {
  kind: 'window',
  text: 'order',
  title: '',
  windowKey: 'order',
  windowTitle: '',
  inTab: true,
  newInstance: false,
  autoIndexTitle: false,
  awaitResult: false,
  modal: false,
  size: undefined,
  width: undefined,
  height: undefined,
  footer: undefined,
  parameters: {AdOrderId: [123]},
});

assert.deepEqual(resolveLinkTarget({
  row,
  value: [{id: 123}, {id: 124}],
  linkConfig: {kind: 'association', windowKey: 'order', dialogId: 'associatedOrders'},
}), {
  kind: 'dialog',
  text: 'associatedOrders',
  title: '',
  dialogId: 'associatedOrders',
  awaitResult: false,
  parameters: {associations: [{id: 123}, {id: 124}], associationIds: [123, 124]},
});

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
      identityParameters: ['AdOrderId'],
      parameters: {
        AdOrderId: {source: 'row', selector: 'id', wrap: 'array'},
        CampaignId: {source: 'row', selector: 'campaignId', wrap: 'array'},
      },
    },
  }).identityParameters,
  ['AdOrderId'],
);

assert.deepEqual(
  resolveLinkTarget({
    row,
    value: row.name,
    linkConfig: {
      kind: 'window',
      windowKey: 'order',
      windowTitleSource: 'row',
      windowTitleTemplate: '{{name}} ({{id}})',
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
    windowTitle: 'Order Alpha (123)',
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
