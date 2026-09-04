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
    row: {advertiserId: 85141, firstPartyDataSource: 'Mock Commerce API'},
    column: {
      id: 'firstPartyDataSource',
      type: 'link',
      link: {
        kind: 'dialog',
        dialogId: 'advertiserCapiOnboardedData',
        parameters: {
          AdvertiserId: {source: 'row', selector: 'advertiserId'},
          FirstPartyDataSource: {source: 'row', selector: 'firstPartyDataSource'},
        },
      },
    },
    value: 'Mock Commerce API',
  }),
  {
    kind: 'dialog',
    text: 'Mock Commerce API',
    title: '',
    dialogId: 'advertiserCapiOnboardedData',
    awaitResult: false,
    parameters: {AdvertiserId: 85141, FirstPartyDataSource: 'Mock Commerce API'},
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

assert.equal(
  resolveTableCellText({
    row: { lifetimeSpend: null },
    column: { id: 'lifetimeSpend', name: 'Lifetime Spend', emptyText: 'No data' },
    value: null,
  }),
  'No data',
);

assert.equal(
  resolveTableCellText({
    row: {status: 0},
    column: {id: 'status', name: 'Status', valueMap: {'0': 'Inactive', '1': 'Active'}},
    value: 0,
  }),
  'Inactive',
);

assert.equal(
  resolveTableCellText({
    row: {campaignIds: [{id: 1}, {id: 2}]},
    column: {id: 'campaignIds', format: 'relationCount', singularLabel: 'Campaign'},
    value: [{id: 1}, {id: 2}],
  }),
  '2 Campaigns',
);

assert.equal(
  resolveTableCellText({
    row: {campaignIds: []},
    column: {id: 'campaignIds', format: 'relationCount', singularLabel: 'Campaign'},
    value: [],
  }),
  '0 Campaigns',
);

assert.equal(
  resolveTableLink({
    row: {campaignIds: []},
    column: {
      id: 'campaignIds',
      type: 'link',
      format: 'relationCount',
      singularLabel: 'Campaign',
      link: {kind: 'window', windowKey: 'campaign'},
    },
    value: [],
  }),
  null,
);

assert.equal(
  resolveTableCellText({
    row: {ad_order_ids: {}},
    column: {
      id: 'ad_order_ids',
      type: 'link',
      format: 'relationCount',
      singularLabel: 'Order',
      emptyText: '0 Orders',
      link: {kind: 'window', windowKey: 'order'},
    },
    value: {},
  }),
  '0 Orders',
);

assert.equal(
  resolveTableLink({
    row: {ad_order_ids: {}},
    column: {
      id: 'ad_order_ids',
      type: 'link',
      format: 'relationCount',
      singularLabel: 'Order',
      link: {kind: 'window', windowKey: 'order'},
    },
    value: {},
  }),
  null,
);

assert.equal(
  resolveTableCellText({
    row: {},
    column: {id: 'ad_order_ids', type: 'link', format: 'relationCount', singularLabel: 'Order'},
    value: undefined,
  }),
  '0 Orders',
);

assert.equal(
  resolveTableLink({
    row: {},
    column: {
      id: 'ad_order_ids',
      type: 'link',
      format: 'relationCount',
      singularLabel: 'Order',
      link: {kind: 'window', windowKey: 'order'},
    },
    value: undefined,
  }),
  null,
);

assert.equal(
  resolveTableCellText({
    row: {viewThroughWindowHours: 24},
    column: {id: 'viewThroughWindowHours', format: 'durationHours'},
    value: 24,
  }),
  '1d',
);

assert.equal(
  resolveTableCellText({
    row: {clickThroughWindowHours: 168},
    column: {id: 'clickThroughWindowHours', format: 'durationHours'},
    value: 168,
  }),
  '7d',
);

assert.equal(
  resolveTableCellText({
    row: {viewThroughWindowHours: 720},
    column: {id: 'viewThroughWindowHours', format: 'durationHours'},
    value: 720,
  }),
  '30d',
);

assert.equal(
  resolveTableCellText({
    row: {startDate: '2026-08-27T22:33:00Z', advertiserTimeZone: {ianaTimezoneStr: 'America/Los_Angeles'}},
    column: {id: 'startDate', format: 'dateTime24', timeZoneSelector: 'advertiserTimeZone.ianaTimezoneStr'},
    value: '2026-08-27T22:33:00Z',
  }),
  'Aug 27, 2026, 15:33',
);

assert.equal(
  resolveTableCellText({
    row: {size: {width: 300, height: 250}},
    column: {id: 'size', format: 'dimensions'},
    value: {width: 300, height: 250},
  }),
  '300x250',
);

assert.equal(
  resolveTableCellText({
    row: {metadata: {kind: 'opaque'}},
    column: {id: 'metadata'},
    value: {kind: 'opaque'},
  }),
  '',
);
