import React, { useMemo } from 'react';
import { Button, Card } from '@blueprintjs/core';
import { signal } from '@preact/signals-react';

import ReportBuilder from '../../components/dashboard/ReportBuilder.jsx';

const RAW_ROWS = [
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

function aggregateRows(rows, request = {}) {
  const dimensions = Object.entries(request.dimensions || {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);
  const measures = Object.entries(request.measures || {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);
  const grouped = new Map();

  rows.forEach((row) => {
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

function createDemoContext() {
  const collection = signal([]);
  const control = signal({ loading: false, error: null });
  const windowForm = signal({});
  const collectionInfo = signal({ hasMore: false });
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
    },
  };

  const fetchCollection = () => {
    const request = windowForm.peek()?.demoReportBuilder?.lastRequest || {};
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
        const current = windowForm.peek() || {};
        const currentBuilder = current.demoReportBuilder || {};
        windowForm.value = {
          ...current,
          demoReportBuilder: {
            ...currentBuilder,
            lastRequest: request,
          },
        };
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
      measures: [
        { id: 'avails', key: 'avails', label: 'Avails', format: 'compactNumber', default: true, color: '#2f6de1' },
        { id: 'hhUniqs', key: 'hhUniqs', label: 'HH Uniques', format: 'compactNumber', default: true, color: '#13a36f' },
      ],
      dimensions: [
        { id: 'eventDate', key: 'eventDate', label: 'Date', chartAxis: true, default: true },
        { id: 'channelV2', key: 'channelV2', label: 'Channel', default: true },
        { id: 'agegroupId', key: 'agegroupId', label: 'Age Group', default: true },
        { id: 'country', key: 'country', label: 'Country' },
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
      ],
      result: {
        chartCreationMode: 'explicit',
        defaultMode: 'table',
        viewModes: ['table', 'chart'],
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

export default function ReportBuilderPreview() {
  const context = useMemo(() => createDemoContext(), []);

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
                  window.localStorage.removeItem('reportBuilder.chartPresets.demoReportBuilder');
                  window.location.reload();
                }
              }}
            >
              Clear Saved Charts
            </Button>
          </div>
        </Card>
        <ReportBuilder container={container} context={context} />
      </div>
    </div>
  );
}
