import React, { useMemo, useRef } from 'react';
import { Button, Card } from '@blueprintjs/core';
import { signal, useSignalEffect } from '@preact/signals-react';

import ReportBuilder from '../../components/dashboard/ReportBuilder.jsx';
import {
  resolveLegacyReportBuilderStateStorageScopes,
  reportBuilderStateStorageKey,
  resolveReportBuilderStateStorageScope,
} from '../../components/dashboard/reportBuilderPersistence.js';

const BASE_ROWS = [
  { eventDate: '2026-05-01', channelV2: 'Display', agegroupId: '18-24', country: 'US', avails: 18000, hhUniqs: 7400 },
  { eventDate: '2026-05-01', channelV2: 'Display', agegroupId: '25-34', country: 'US', avails: 22400, hhUniqs: 9100 },
  { eventDate: '2026-05-01', channelV2: 'CTV', agegroupId: '18-24', country: 'US', avails: 14200, hhUniqs: 6100 },
  { eventDate: '2026-05-01', channelV2: 'CTV', agegroupId: '25-34', country: 'US', avails: 20100, hhUniqs: 8600 },
  { eventDate: '2026-05-02', channelV2: 'Display', agegroupId: '18-24', country: 'US', avails: 19100, hhUniqs: 7800 },
  { eventDate: '2026-05-02', channelV2: 'Display', agegroupId: '25-34', country: 'US', avails: 23300, hhUniqs: 9500 },
  { eventDate: '2026-05-02', channelV2: 'CTV', agegroupId: '18-24', country: 'US', avails: 15100, hhUniqs: 6400 },
  { eventDate: '2026-05-02', channelV2: 'CTV', agegroupId: '25-34', country: 'US', avails: 20900, hhUniqs: 8900 },
  { eventDate: '2026-05-03', channelV2: 'Display', agegroupId: '18-24', country: 'CA', avails: 16200, hhUniqs: 6800 },
  { eventDate: '2026-05-03', channelV2: 'Display', agegroupId: '25-34', country: 'CA', avails: 20400, hhUniqs: 8400 },
  { eventDate: '2026-05-03', channelV2: 'CTV', agegroupId: '18-24', country: 'CA', avails: 13700, hhUniqs: 5700 },
  { eventDate: '2026-05-03', channelV2: 'CTV', agegroupId: '25-34', country: 'CA', avails: 19400, hhUniqs: 8100 },
  { eventDate: '2026-05-04', channelV2: 'Display', agegroupId: '18-24', country: 'CA', avails: 17500, hhUniqs: 7100 },
  { eventDate: '2026-05-04', channelV2: 'Display', agegroupId: '25-34', country: 'CA', avails: 21500, hhUniqs: 8800 },
  { eventDate: '2026-05-04', channelV2: 'CTV', agegroupId: '18-24', country: 'CA', avails: 14500, hhUniqs: 6000 },
  { eventDate: '2026-05-04', channelV2: 'CTV', agegroupId: '25-34', country: 'CA', avails: 20300, hhUniqs: 8500 },
];

const RAW_ROWS = BASE_ROWS.map((row, index) => ({
  ...row,
  siteType: row.channelV2 === 'CTV' ? 'Streaming' : 'Publisher Site',
  publisher: row.country === 'US' ? 'Acme Media' : 'North Star Media',
  advertiser: row.country === 'US' ? 'Northwind Health' : 'Maple Retail',
  campaign: row.agegroupId === '18-24' ? 'Prospect Sprint' : 'Family Reach',
  adOrder: row.channelV2 === 'CTV' ? 'Connected TV Burst' : 'Display Always-On',
  audience: row.agegroupId === '18-24' ? 'Young Adults' : 'Established Adults',
  deal: row.channelV2 === 'CTV' ? 'Premium OTT Deal' : 'Open Exchange',
  deviceType: index % 2 === 0 ? 'Mobile' : 'CTV',
  region: row.country === 'US' ? 'NA' : 'CA',
  channelsFilter: row.channelV2,
  scopeFilter: row.country === 'US' ? 'national' : 'regional',
  inventoryFilter: row.channelV2 === 'CTV' ? 'premium' : 'open',
  targetingFilter: row.country === 'US' ? 'audience' : 'geo',
  publisherFilter: row.country === 'US' ? 'Acme Media' : 'North Star Media',
  advertiserFilter: row.country === 'US' ? 'Northwind Health' : 'Maple Retail',
  campaignFilter: row.agegroupId === '18-24' ? 'Prospect Sprint' : 'Family Reach',
  deviceFilter: index % 2 === 0 ? 'Mobile' : 'CTV',
}));

const FILTER_FIELD_ALIASES = {
  channelsFilter: 'channelsFilter',
  scopeFilter: 'scopeFilter',
  inventoryFilter: 'inventoryFilter',
  targetingFilter: 'targetingFilter',
  publisherFilter: 'publisherFilter',
  advertiserFilter: 'advertiserFilter',
  campaignFilter: 'campaignFilter',
  deviceFilter: 'deviceFilter',
};

function applyRequestFilters(rows, request = {}) {
  const filters = request?.filters || {};
  const from = String(filters?.from || '').trim();
  const to = String(filters?.to || '').trim();
  return rows.filter((row) => {
    if (from && String(row?.eventDate || '').trim() < from) {
      return false;
    }
    if (to && String(row?.eventDate || '').trim() > to) {
      return false;
    }
    return Object.entries(FILTER_FIELD_ALIASES).every(([filterId, fieldName]) => {
      const selected = filters?.[filterId];
      if (selected === undefined || selected === null || selected === '' || (Array.isArray(selected) && selected.length === 0)) {
        return true;
      }
      const allowed = Array.isArray(selected) ? selected : [selected];
      return allowed.map((entry) => String(entry || '').trim()).includes(String(row?.[fieldName] || '').trim());
    });
  });
}

function aggregateRows(rows, request = {}) {
  const filteredRows = applyRequestFilters(rows, request);
  const dimensions = Object.entries(request.dimensions || {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);
  const measures = Object.entries(request.measures || {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);
  const grouped = new Map();

  filteredRows.forEach((row) => {
    const bucket = JSON.stringify(dimensions.map((key) => row[key]));
    const existing = grouped.get(bucket) || {};
    dimensions.forEach((key) => {
      existing[key] = row[key];
    });
    measures.forEach((key) => {
      existing[key] = Number(existing[key] || 0) + Number(row[key] || 0);
    });
    grouped.set(bucket, existing);
  });

  const aggregated = Array.from(grouped.values());
  const [orderField = 'eventDate', orderDir = 'asc'] = String((request.orderBy || [])[0] || 'eventDate asc').split(/\s+/);
  aggregated.sort((left, right) => {
    const leftValue = left?.[orderField];
    const rightValue = right?.[orderField];
    if (leftValue === rightValue) return 0;
    const comparison = String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true });
    return String(orderDir || 'asc').toLowerCase() === 'desc' ? -comparison : comparison;
  });

  const offset = Math.max(0, Number(request.offset || 0) || 0);
  const limit = Math.max(1, Number(request.limit || aggregated.length) || aggregated.length);
  return {
    rows: aggregated.slice(offset, offset + limit),
    hasMore: offset + limit < aggregated.length,
  };
}

function ensurePreviewMetrics() {
  if (typeof window === 'undefined') {
    return null;
  }
  const current = window.__REPORT_BUILDER_PREVIEW__;
  if (current && typeof current === 'object') {
    return current;
  }
  const next = {
    fetchCollectionCount: 0,
    fetchRecordsCount: 0,
    windowFormChangeCount: 0,
    inputSignalChangeCount: 0,
    currentWindowFormJSON: '{}',
    currentInputJSON: '{}',
    lastWindowFormJSON: undefined,
    lastInputJSON: undefined,
    resetCounters() {
      this.fetchCollectionCount = 0;
      this.fetchRecordsCount = 0;
      this.windowFormChangeCount = 0;
      this.inputSignalChangeCount = 0;
      this.lastWindowFormJSON = this.currentWindowFormJSON;
      this.lastInputJSON = this.currentInputJSON;
    },
  };
  window.__REPORT_BUILDER_PREVIEW__ = next;
  return next;
}

function createDemoContext() {
  const collection = signal([]);
  const control = signal({ loading: false, error: null });
  const windowForm = signal({});
  const collectionInfo = signal({ hasMore: false });
  const input = signal({ parameters: {} });
  const ctx = {
    locale: 'en-US',
    identity: {
      dataSourceRef: 'demoReportSource',
      dataSourceId: 'demoReportSource',
      windowId: 'demoReportBuilderWindow',
    },
    signals: {
      collection,
      control,
      windowForm,
      collectionInfo,
      input,
    },
  };

  const fetchCollection = () => {
    const metrics = ensurePreviewMetrics();
    if (metrics) {
      metrics.fetchCollectionCount += 1;
    }
    const request = input.peek()?.parameters || {};
    control.value = { loading: true, error: null };
    const { rows, hasMore } = aggregateRows(RAW_ROWS, request);
    collection.value = rows;
    collectionInfo.value = { hasMore };
    control.value = { loading: false, error: null };
  };

  ctx.handlers = {
    dataSource: {
      setWindowFormData({ values }) {
        windowForm.value = {
          ...windowForm.peek(),
          ...(values || {}),
        };
      },
      setInputParameters(request) {
        input.value = {
          ...input.peek(),
          parameters: request,
        };
      },
      async fetchRecords({ parameters } = {}) {
        const metrics = ensurePreviewMetrics();
        if (metrics) {
          metrics.fetchRecordsCount += 1;
        }
        const { rows, hasMore } = aggregateRows(RAW_ROWS, parameters || {});
        return { rows, hasMore };
      },
      fetchCollection,
    },
  };
  ctx.Context = () => ctx;
  return ctx;
}

const container = {
  id: 'demoReportBuilder',
  stateKey: 'demoReportBuilder',
  title: 'Report Builder Demo',
  kind: 'dashboard.reportBuilder',
  dataSourceRef: 'demoReportSource',
  dashboard: {
    reportBuilder: {
      filterPresentation: 'rail-left',
      measures: [
        { id: 'avails', key: 'avails', label: 'Avails', format: 'compactNumber', default: true, color: '#2f6de1' },
        { id: 'hhUniqs', key: 'hhUniqs', label: 'HH Uniques', format: 'compactNumber', default: true, color: '#13a36f' },
      ],
      dimensions: [
        { id: 'eventDate', key: 'eventDate', label: 'Date', chartAxis: true, default: true },
        { id: 'channelV2', key: 'channelV2', label: 'Channel', default: true },
        { id: 'agegroupId', key: 'agegroupId', label: 'Age Group', default: true },
        { id: 'country', key: 'country', label: 'Country' },
        { id: 'siteType', key: 'siteType', label: 'Site Type' },
        { id: 'publisher', key: 'publisher', label: 'Publisher' },
        { id: 'advertiser', key: 'advertiser', label: 'Advertiser' },
        { id: 'campaign', key: 'campaign', label: 'Campaign' },
        { id: 'adOrder', key: 'adOrder', label: 'Ad Order' },
        { id: 'audience', key: 'audience', label: 'Audience' },
        { id: 'deal', key: 'deal', label: 'Deal' },
        { id: 'deviceType', key: 'deviceType', label: 'Device Type' },
        { id: 'region', key: 'region', label: 'Region' },
      ],
      staticFilters: [
        {
          id: 'dateRange',
          label: 'Date Range',
          type: 'dateRange',
          required: true,
          default: { start: '2026-05-01', end: '2026-05-04' },
          startParamPath: 'filters.from',
          endParamPath: 'filters.to',
        },
        {
          id: 'channelsFilter',
          label: 'Channels',
          multiple: true,
          options: [
            { label: 'Display', value: 'Display' },
            { label: 'CTV', value: 'CTV' },
          ],
        },
        {
          id: 'scopeFilter',
          label: 'Scope',
          multiple: true,
          options: [
            { label: 'National', value: 'national' },
            { label: 'Regional', value: 'regional' },
            { label: 'Local', value: 'local' },
          ],
        },
        {
          id: 'inventoryFilter',
          label: 'Inventory',
          multiple: true,
          options: [
            { label: 'Premium', value: 'premium' },
            { label: 'Open Exchange', value: 'open' },
          ],
        },
        {
          id: 'targetingFilter',
          label: 'Targeting',
          multiple: true,
          options: [
            { label: 'Contextual', value: 'contextual' },
            { label: 'Audience', value: 'audience' },
            { label: 'Geo', value: 'geo' },
          ],
        },
        {
          id: 'publisherFilter',
          label: 'Publisher',
          multiple: true,
          options: [
            { label: 'Acme Media', value: 'Acme Media' },
            { label: 'North Star Media', value: 'North Star Media' },
          ],
        },
        {
          id: 'advertiserFilter',
          label: 'Advertiser',
          multiple: true,
          options: [
            { label: 'Northwind Health', value: 'Northwind Health' },
            { label: 'Maple Retail', value: 'Maple Retail' },
          ],
        },
        {
          id: 'campaignFilter',
          label: 'Campaign',
          multiple: true,
          options: [
            { label: 'Prospect Sprint', value: 'Prospect Sprint' },
            { label: 'Family Reach', value: 'Family Reach' },
          ],
        },
        {
          id: 'deviceFilter',
          label: 'Device',
          multiple: true,
          options: [
            { label: 'Mobile', value: 'Mobile' },
            { label: 'CTV', value: 'CTV' },
          ],
        },
      ],
      result: {
        showResultHeader: true,
        chartCreationMode: 'explicit',
        autoApplyDefaultChartOnResult: true,
        defaultMode: 'table',
        viewModes: ['table', 'chart'],
        chartDataMode: 'fullQuery',
        chartRowLimit: 1000,
        quickPresets: {
          autoFetchOnSelect: true,
          selectionPolicy: 'replace',
        },
        chartWizard: {
          supportedTypes: ['line', 'bar', 'area', 'pie', 'donut', 'horizontal_bar', 'funnel_bar'],
        },
        defaultChartSpecs: [
          {
            title: 'Avails by Date',
            type: 'line',
            xField: 'eventDate',
            yFields: ['avails'],
          },
          {
            title: 'Avails + HH Uniques by Date',
            type: 'bar',
            xField: 'eventDate',
            yFields: ['avails', 'hhUniqs'],
            seriesOptions: {
              avails: { type: 'bar', axis: 'left', stackId: 'reach' },
              hhUniqs: { type: 'line', axis: 'right' },
            },
          },
          {
            title: 'Avails by Date and Channel',
            type: 'area',
            xField: 'eventDate',
            yFields: ['avails'],
            seriesField: 'channelV2',
          },
          {
            title: 'Avails by Channel',
            type: 'pie',
            xField: 'channelV2',
            yFields: ['avails'],
          },
          {
            title: 'HH Uniques by Country',
            type: 'donut',
            xField: 'country',
            yFields: ['hhUniqs'],
          },
          {
            title: 'Avails by Age Group',
            type: 'horizontal_bar',
            xField: 'agegroupId',
            yFields: ['avails', 'hhUniqs'],
          },
          {
            title: 'Avails Funnel by Channel',
            type: 'funnel_bar',
            xField: 'channelV2',
            yFields: ['avails'],
          },
        ],
        pageSize: 50,
        orderFields: [
          { value: 'eventDate', field: 'eventDate', default: true, defaultDirection: 'asc' },
          { value: 'avails', field: 'avails', defaultDirection: 'desc' },
          { value: 'hhUniqs', field: 'hhUniqs', defaultDirection: 'desc' },
        ],
      },
      request: {
        autoFetch: true,
        limit: 50,
      },
    },
  },
};

const DEMO_STATE_STORAGE_SCOPE = resolveReportBuilderStateStorageScope({
  stateKey: container.stateKey,
  windowId: 'demoReportBuilderWindow',
  dataSourceRef: 'demoReportSource',
  containerId: container.id,
});
const DEMO_LEGACY_STORAGE_SCOPES = resolveLegacyReportBuilderStateStorageScopes({
  stateKey: container.stateKey,
  stateStorageScope: DEMO_STATE_STORAGE_SCOPE,
});
const DEMO_CHART_PRESET_STORAGE_KEY = `reportBuilder.chartPresets.${DEMO_STATE_STORAGE_SCOPE}`;
const DEMO_LEGACY_CHART_PRESET_STORAGE_KEYS = DEMO_LEGACY_STORAGE_SCOPES.map((scope) => `reportBuilder.chartPresets.${scope}`);

export default function ReportBuilderPreview() {
  const context = useMemo(() => createDemoContext(), []);
  const lastHandledFetchInputRef = useRef(null);
  const lastObservedWindowFormJSONRef = useRef(undefined);
  const lastObservedInputJSONRef = useRef(undefined);

  if (typeof window !== 'undefined') {
    ensurePreviewMetrics();
  }

  useSignalEffect(() => {
    const metrics = ensurePreviewMetrics();
    if (!metrics) {
      return;
    }
    const current = JSON.stringify(context?.signals?.windowForm?.value || {});
    metrics.currentWindowFormJSON = current;
    if (lastObservedWindowFormJSONRef.current === undefined) {
      lastObservedWindowFormJSONRef.current = current;
      if (metrics.lastWindowFormJSON === undefined) {
        metrics.lastWindowFormJSON = current;
      }
      return;
    }
    if (lastObservedWindowFormJSONRef.current !== current) {
      metrics.windowFormChangeCount += 1;
      metrics.lastWindowFormJSON = current;
      lastObservedWindowFormJSONRef.current = current;
    }
  });

  useSignalEffect(() => {
    const metrics = ensurePreviewMetrics();
    if (!metrics) {
      return;
    }
    const current = JSON.stringify(context?.signals?.input?.value || {});
    metrics.currentInputJSON = current;
    if (lastObservedInputJSONRef.current === undefined) {
      lastObservedInputJSONRef.current = current;
      if (metrics.lastInputJSON === undefined) {
        metrics.lastInputJSON = current;
      }
      return;
    }
    if (lastObservedInputJSONRef.current !== current) {
      metrics.inputSignalChangeCount += 1;
      metrics.lastInputJSON = current;
      lastObservedInputJSONRef.current = current;
    }
  });

  useSignalEffect(() => {
    const inputState = context?.signals?.input?.value;
    if (!inputState?.fetch) {
      return;
    }
    if (lastHandledFetchInputRef.current === inputState) {
      return;
    }
    lastHandledFetchInputRef.current = inputState;
    context?.handlers?.dataSource?.fetchCollection?.();
  });

  return (
    <div style={{ padding: '28px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <Card elevation={0} style={{ borderRadius: '18px', border: '1px solid #d8e4ec', background: 'linear-gradient(180deg, #ffffff 0%, #f6fafe 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '18px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#738694', marginBottom: '8px' }}>
                Forge Demo
              </div>
              <h1 style={{ margin: 0, fontSize: '30px', color: '#182026' }}>Explicit Report Builder Chart Demo</h1>
              <p style={{ margin: '10px 0 0', fontSize: '13px', lineHeight: 1.55, color: '#4c6172', maxWidth: '76ch' }}>
                This local demo seeds a multi-dimension dataset with Date, Channel, Age Group, and Country. Use the expanded chart wizard to create multi-line, multi-color bar, split-series, pie, donut, horizontal bar, and funnel-style charts, then reapply them from <strong>Previous</strong> to verify compatibility rules.
              </p>
            </div>
            <Button
              outlined
              icon="trash"
              onClick={() => {
                if (typeof window !== 'undefined' && window.localStorage) {
                  window.localStorage.removeItem(reportBuilderStateStorageKey(DEMO_STATE_STORAGE_SCOPE));
                  DEMO_LEGACY_STORAGE_SCOPES.forEach((scope) => window.localStorage.removeItem(reportBuilderStateStorageKey(scope)));
                  window.localStorage.removeItem(DEMO_CHART_PRESET_STORAGE_KEY);
                  DEMO_LEGACY_CHART_PRESET_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
                  window.location.reload();
                }
              }}
            >
              Reset Preview
            </Button>
          </div>
        </Card>
        <ReportBuilder container={container} context={context} />
      </div>
    </div>
  );
}
