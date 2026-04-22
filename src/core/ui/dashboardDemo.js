import {getCollectionSignal} from '../store/signals.js';

export const DEFAULT_DASHBOARD_DEMO_VARIANT = 'performance';

export function createDashboardDemoMetadata() {
  return {
    ns: ['demo', 'dashboard'],
    dataSource: {
      perf: { selectionMode: 'none', service: { endpoint: 'demo', uri: 'perf' } },
      weeklyTrend: { selectionMode: 'single', service: { endpoint: 'demo', uri: 'weeklyTrend' } },
      byCountry: { selectionMode: 'single', service: { endpoint: 'demo', uri: 'byCountry' } },
      eligibilityFunnel: { selectionMode: 'none', service: { endpoint: 'demo', uri: 'eligibilityFunnel' } },
      audit: { selectionMode: 'none', service: { endpoint: 'demo', uri: 'audit' } },
      detailTrend: { selectionMode: 'none', service: { endpoint: 'demo', uri: 'detailTrend' } },
    },
    actions: {
      import: () => {
        const detailSeries = {
          US: [
            { week: '2026-02-01', series: 'US', spend: 30000 },
            { week: '2026-02-08', series: 'US', spend: 28000 },
            { week: '2026-02-15', series: 'US', spend: 32000 },
          ],
          CA: [
            { week: '2026-02-01', series: 'CA', spend: 8000 },
            { week: '2026-02-08', series: 'CA', spend: 7000 },
            { week: '2026-02-15', series: 'CA', spend: 9000 },
          ],
          GB: [
            { week: '2026-02-01', series: 'GB', spend: 4000 },
            { week: '2026-02-08', series: 'GB', spend: 3500 },
            { week: '2026-02-15', series: 'GB', spend: 4200 },
          ],
        };

        return {
          dashboardDemo: {
            eligibilityFunnel: [
              { feature_label: '1. profile.agg', reduction_pct: 14.4 },
              { feature_label: '2. ad.pmp.deal.id', reduction_pct: 12.8 },
              { feature_label: '3. location.postalcode.list', reduction_pct: 9.6 },
              { feature_label: '4. media.format', reduction_pct: 7.1 },
              { feature_label: '5. adsize', reduction_pct: 6.9 },
              { feature_label: '6. external.pmp.deal', reduction_pct: 5.5 },
              { feature_label: '7. media.api.protocol', reduction_pct: 4.7 },
              { feature_label: '8. sitelet.agg', reduction_pct: 2.6 },
            ],
            updateDetailTrend: ({context: handlerContext, item}) => {
              const windowId = handlerContext?.identity?.windowId;
              const country = item?.country || 'US';
              const dataSourceId = `${windowId}DSdetailTrend`;
              getCollectionSignal(dataSourceId).value = detailSeries[country] || detailSeries.US;
              return true;
            },
          },
        };
      },
    },
    view: {
      dataSourceRef: 'perf',
      content: {
        id: 'demoDashboard',
        kind: 'dashboard',
        title: 'Performance Dashboard Demo',
        subtitle: 'Generic Forge dashboard blocks with seeded in-memory data',
        toolbar: {
          items: [
            {
              id: 'resetDashboardFilters',
              label: 'Reset Dashboard',
              icon: 'reset',
              align: 'right',
              on: [
                { event: 'onClick', handler: 'window.resetDashboardState', args: ['demoDashboard'] },
              ],
            },
            {
              id: 'exportDashboard',
              label: 'Download HTML',
              icon: 'download',
              align: 'right',
              on: [
                { event: 'onClick', handler: 'window.exportDashboard', args: ['dashboard-demo.html'] },
              ],
            },
          ],
        },
        layout: {
          kind: 'grid',
          columns: 12,
          gap: '16px',
        },
        containers: [
          {
            id: 'filters',
            kind: 'dashboard.filters',
            title: 'Filters',
            columnSpan: 12,
            items: [
              {
                id: 'dateRange',
                label: 'Date Range',
                field: 'dateRange',
                options: [
                  { label: '30D', value: '30d' },
                  { label: '90D', value: '90d', default: true },
                  { label: 'YTD', value: 'ytd' },
                ],
              },
              {
                id: 'region',
                label: 'Region',
                field: 'region',
                multiple: true,
                options: [
                  { label: 'NA', value: 'NA', default: true },
                  { label: 'EMEA', value: 'EMEA' },
                  { label: 'APAC', value: 'APAC' },
                ],
              },
              {
                id: 'dateRange',
                type: 'dateRange',
                label: 'Date Range',
                field: 'dateRange',
              },
            ],
          },
          {
            id: 'summary',
            kind: 'dashboard.summary',
            title: 'Overview',
            columnSpan: 7,
            dataSourceRef: 'perf',
            metrics: [
              { id: 'spend', label: 'Spend', selector: 'summary.total_spend', format: 'currency' },
              { id: 'impressions', label: 'Impressions', selector: 'summary.total_impressions', format: 'compactNumber' },
              { id: 'ctr', label: 'CTR', selector: 'summary.overall_ctr_pct', format: 'percent' },
            ],
          },
          {
            id: 'compare',
            kind: 'dashboard.compare',
            title: 'Period Compare',
            columnSpan: 5,
            dataSourceRef: 'perf',
            items: [
              {
                id: 'spendChange',
                label: 'Spend',
                current: 'summary.total_spend',
                previous: 'summary.previous_total_spend',
                format: 'currency',
                deltaFormat: 'currencyDelta',
                deltaLabel: 'vs prior period',
              },
              {
                id: 'ctrChange',
                label: 'CTR',
                current: 'summary.overall_ctr_pct',
                previous: 'summary.previous_overall_ctr_pct',
                format: 'percent',
                deltaFormat: 'percentDelta',
                deltaLabel: 'vs prior period',
              },
            ],
          },
          {
            id: 'trend',
            kind: 'dashboard.timeline',
            title: 'Weekly Trend',
            columnSpan: 8,
            dataSourceRef: 'weeklyTrend',
            filterBindings: {
              region: 'region',
            },
            chart: {
              type: 'area',
              width: '100%',
              height: '420px',
              xAxis: { dataKey: 'week', label: 'Week', tickFormat: 'MM/dd' },
              yAxis: { label: 'Spend' },
              cartesianGrid: { strokeDasharray: '3 3' },
              series: {
                nameKey: 'series',
                valueKey: 'spend',
                values: [
                  { label: 'Spend', value: 'spend', name: 'Spend' },
                  { label: 'Impressions', value: 'impressions', name: 'Impressions' },
                ],
                palette: ['#137cbd', '#0f9960', '#d9822b'],
              },
            },
          },
          {
            id: 'eligibilityFunnel',
            kind: 'dashboard.timeline',
            title: 'Eligibility funnel',
            columnSpan: 6,
            dataSourceRef: 'eligibilityFunnel',
            chart: {
              type: 'funnel_bar',
              width: '100%',
              height: '360px',
              categoryField: 'feature_label',
              valueField: 'reduction_pct',
              valueLabel: 'Reduction %',
              format: 'percent',
              palette: ['#2f6de1', '#7a46d8', '#db2f7d', '#f55d1f', '#d79619', '#2aa84a', '#24a0c7', '#5a5ce6'],
            },
          },
          {
            id: 'messages',
            kind: 'dashboard.messages',
            title: 'Messages',
            columnSpan: 4,
            dataSourceRef: 'perf',
            items: [
              {
                severity: 'warning',
                title: 'High zero-spend rate',
                body: '${quality.zero_spend_rate}% of rows currently have zero spend.',
                visibleWhen: { selector: 'quality.zero_spend_rate', gt: 40 },
              },
              {
                severity: 'info',
                title: 'US concentration',
                body: 'US continues to dominate spend in the ${filters.dateRange} window.',
              },
              {
                severity: 'success',
                title: 'Selected Country ${selection.entityKey}',
                body: 'Detail trend is focused on ${selection.entityKey}.',
                visibleWhen: { source: 'selection', field: 'entityKey', notEmpty: true },
              },
              {
                severity: 'info',
                title: 'Active Region Filter',
                body: 'Regions: ${filters.region}.',
                visibleWhen: { source: 'filters', field: 'region', notEmpty: true },
              },
            ],
          },
          {
            id: 'byCountry',
            kind: 'dashboard.dimensions',
            title: 'Spend by Country',
            columnSpan: 6,
            dataSourceRef: 'byCountry',
            filterBindings: {
              region: 'region',
            },
            dimension: { key: 'country', label: 'Country' },
            metric: { key: 'spend', label: 'Spend', format: 'currency' },
            viewModes: ['chart', 'table'],
            limit: 8,
            on: [
              { event: 'onSelect', handler: 'dashboardDemo.updateDetailTrend' },
            ],
          },
          {
            id: 'status',
            kind: 'dashboard.status',
            title: 'Data Health',
            columnSpan: 4,
            dataSourceRef: 'perf',
            checks: [
              {
                id: 'zeroSpend',
                label: 'Zero spend rows',
                selector: 'quality.zero_spend_rate',
                format: 'percent',
                tone: { warningAbove: 25, dangerAbove: 40 },
              },
              {
                id: 'nullCountry',
                label: 'Null country rows',
                selector: 'quality.null_country_rate',
                format: 'percent',
                tone: { warningAbove: 1, dangerAbove: 2 },
              },
            ],
          },
          {
            id: 'kpiTable',
            kind: 'dashboard.kpiTable',
            title: 'Metric Table',
            columnSpan: 8,
            dataSourceRef: 'perf',
            rows: [
              { id: 'spend', label: 'Total Spend', value: 'summary.total_spend', format: 'currency', context: 'Financial', contextTone: 'info' },
              { id: 'impressions', label: 'Impressions', value: 'summary.total_impressions', format: 'compactNumber', context: 'Reach', contextTone: 'success' },
              { id: 'ctr', label: 'CTR', value: 'summary.overall_ctr_pct', format: 'percent', context: 'Engagement', contextTone: 'warning' },
            ],
          },
          {
            id: 'report',
            kind: 'dashboard.report',
            title: 'Report',
            columnSpan: 6,
            sections: [
              {
                id: 'overview',
                title: 'Executive Summary',
                tone: 'info',
                body: [
                  'Total spend is ${summary.total_spend} with overall CTR at ${summary.overall_ctr_pct}.',
                  'Zero-spend rows remain at ${quality.zero_spend_rate}% and should be reviewed before the next reporting cycle.',
                ],
              },
              {
                id: 'action',
                title: 'Recommended Action',
                tone: 'warning',
                body: [
                  'Prioritize cleanup of zero-spend rows and review country attribution for smaller markets.',
                ],
              },
              {
                id: 'selectedCountry',
                title: 'Selected Country: ${selection.entityKey}',
                tone: 'success',
                visibleWhen: { source: 'selection', field: 'entityKey', notEmpty: true },
                body: [
                  'The detail trend below is filtered for ${selection.entityKey}.',
                ],
              },
            ],
          },
          {
            id: 'detail',
            kind: 'dashboard.detail',
            title: 'Selected Country Detail',
            columnSpan: 8,
            visibleWhen: { source: 'selection', field: 'entityKey', notEmpty: true },
            containers: [
              {
                id: 'detailTrend',
                kind: 'dashboard.timeline',
                title: 'Country Trend',
                dataSourceRef: 'detailTrend',
                chart: {
                  type: 'line',
                  width: '100%',
                  height: '320px',
                  xAxis: { dataKey: 'week', label: 'Week', tickFormat: 'MM/dd' },
                  yAxis: { label: 'Spend' },
                  cartesianGrid: { strokeDasharray: '3 3' },
                  series: {
                    nameKey: 'series',
                    valueKey: 'spend',
                    values: [
                      { label: 'Spend', value: 'spend', name: 'Spend' },
                    ],
                    palette: ['#137cbd'],
                  },
                },
              },
            ],
          },
          {
            id: 'audit',
            kind: 'dashboard.feed',
            title: 'Audit Trail',
            columnSpan: 4,
            dataSourceRef: 'audit',
            filterBindings: {
              region: 'region',
            },
            fields: {
              timestamp: 'timestamp',
              title: 'title',
              body: 'body',
            },
          },
          {
            id: 'spendPie',
            kind: 'dashboard.timeline',
            title: 'Spend Distribution',
            columnSpan: 4,
            dataSourceRef: 'byCountry',
            chart: {
              type: 'pie',
              width: '100%',
              height: '340px',
              series: {
                nameKey: 'country',
                valueKey: 'spend',
                palette: ['#137cbd', '#0f9960', '#d9822b', '#8f398f', '#c23030'],
              },
            },
          },
          {
            id: 'countryTable',
            kind: 'dashboard.table',
            title: 'Country Detail Table',
            columnSpan: 8,
            dataSourceRef: 'byCountry',
            filterBindings: {
              region: 'region',
            },
            columns: [
              { key: 'country', label: 'Country' },
              { key: 'region', label: 'Region' },
              { key: 'spend', label: 'Spend', format: 'currency' },
            ],
            limit: 20,
          },
        ],
      },
    },
  };
}

export function createDashboardDemoSeed() {
  return {
    perf: {
      metrics: {
        summary: {
          total_spend: 123000,
          previous_total_spend: 118000,
          total_impressions: 5400000,
          overall_ctr_pct: 2.3,
          previous_overall_ctr_pct: 2.0,
        },
        quality: {
          zero_spend_rate: 47.2,
          null_country_rate: 1.1,
        },
      },
    },
    weeklyTrend: {
      collection: [
        { week: '2026-02-01', series: 'US', region: 'NA', spend: 30000, impressions: 1200000 },
        { week: '2026-02-08', series: 'US', region: 'NA', spend: 28000, impressions: 1180000 },
        { week: '2026-02-15', series: 'US', region: 'NA', spend: 32000, impressions: 1260000 },
        { week: '2026-02-01', series: 'CA', region: 'NA', spend: 8000, impressions: 260000 },
        { week: '2026-02-08', series: 'CA', region: 'NA', spend: 7000, impressions: 240000 },
        { week: '2026-02-15', series: 'CA', region: 'NA', spend: 9000, impressions: 290000 },
        { week: '2026-02-01', series: 'GB', region: 'EMEA', spend: 4000, impressions: 170000 },
        { week: '2026-02-08', series: 'GB', region: 'EMEA', spend: 3500, impressions: 160000 },
        { week: '2026-02-15', series: 'GB', region: 'EMEA', spend: 4200, impressions: 175000 },
      ],
    },
    byCountry: {
      collection: [
        { country: 'US', region: 'NA', spend: 100000 },
        { country: 'CA', region: 'NA', spend: 12000 },
        { country: 'GB', region: 'EMEA', spend: 6000 },
        { country: 'AU', region: 'APAC', spend: 3000 },
        { country: 'DE', region: 'EMEA', spend: 2000 },
      ],
    },
    eligibilityFunnel: {
      collection: [
        { feature_label: '1. profile.agg', reduction_pct: 14.4 },
        { feature_label: '2. ad.pmp.deal.id', reduction_pct: 12.8 },
        { feature_label: '3. location.postalcode.list', reduction_pct: 9.6 },
        { feature_label: '4. media.format', reduction_pct: 7.1 },
        { feature_label: '5. adsize', reduction_pct: 6.9 },
        { feature_label: '6. external.pmp.deal', reduction_pct: 5.5 },
        { feature_label: '7. media.api.protocol', reduction_pct: 4.7 },
        { feature_label: '8. sitelet.agg', reduction_pct: 2.6 },
      ],
    },
    detailTrend: {
      collection: [
        { week: '2026-02-01', series: 'US', spend: 30000 },
        { week: '2026-02-08', series: 'US', spend: 28000 },
        { week: '2026-02-15', series: 'US', spend: 32000 },
      ],
    },
    audit: {
      collection: [
        { timestamp: '2026-04-07 09:00', region: 'NA', title: 'Loaded metrics', body: 'Summary and quality metrics seeded into the demo context.' },
        { timestamp: '2026-04-07 09:01', region: 'NA', title: 'Loaded trend data', body: 'Weekly trend collection prepared for timeline rendering.' },
        { timestamp: '2026-04-07 09:02', region: 'EMEA', title: 'Loaded dimensions', body: 'Country spend ranking seeded with five countries.' },
      ],
    },
  };
}

export function createOperationsDashboardDemoMetadata() {
  return {
    ns: ['demo', 'dashboard', 'operations'],
    dataSource: {
      ops: { selectionMode: 'none', service: { endpoint: 'demo', uri: 'ops' } },
      incidentTrend: { selectionMode: 'none', service: { endpoint: 'demo', uri: 'incidentTrend' } },
      byService: { selectionMode: 'single', service: { endpoint: 'demo', uri: 'byService' } },
      opsAudit: { selectionMode: 'none', service: { endpoint: 'demo', uri: 'opsAudit' } },
    },
    view: {
      dataSourceRef: 'ops',
      content: {
        id: 'opsDashboard',
        kind: 'dashboard',
        title: 'Operations Dashboard Demo',
        subtitle: 'A second dashboard variant showing service health and incident flow',
        toolbar: {
          items: [
            {
              id: 'resetDashboardState',
              label: 'Reset Dashboard',
              icon: 'reset',
              align: 'right',
              on: [
                { event: 'onClick', handler: 'window.resetDashboardState', args: ['opsDashboard'] },
              ],
            },
            {
              id: 'exportDashboard',
              label: 'Download HTML',
              icon: 'download',
              align: 'right',
              on: [
                { event: 'onClick', handler: 'window.exportDashboard', args: ['operations-dashboard-demo.html'] },
              ],
            },
          ],
        },
        layout: {
          kind: 'grid',
          columns: 12,
          gap: '16px',
        },
        containers: [
          {
            id: 'filters',
            kind: 'dashboard.filters',
            title: 'Filters',
            columnSpan: 12,
            items: [
              {
                id: 'severity',
                label: 'Severity',
                field: 'severity',
                multiple: true,
                options: [
                  { label: 'Critical', value: 'critical', default: true },
                  { label: 'Warning', value: 'warning', default: true },
                  { label: 'Info', value: 'info' },
                ],
              },
            ],
          },
          {
            id: 'summary',
            kind: 'dashboard.summary',
            title: 'Incident Summary',
            columnSpan: 6,
            dataSourceRef: 'ops',
            metrics: [
              { id: 'openIncidents', label: 'Open Incidents', selector: 'summary.open_incidents', format: 'number' },
              { id: 'sev1', label: 'SEV-1', selector: 'summary.sev1_open', format: 'number' },
              { id: 'mttr', label: 'MTTR (min)', selector: 'summary.mttr_minutes', format: 'number' },
            ],
          },
          {
            id: 'compare',
            kind: 'dashboard.compare',
            title: 'Week over Week',
            columnSpan: 6,
            dataSourceRef: 'ops',
            items: [
              {
                id: 'incidentChange',
                label: 'Open Incidents',
                current: 'summary.open_incidents',
                previous: 'summary.previous_open_incidents',
                format: 'number',
                deltaFormat: 'numberDelta',
                deltaLabel: 'vs last week',
                positiveIsUp: false,
              },
            ],
          },
          {
            id: 'trend',
            kind: 'dashboard.timeline',
            title: 'Incident Trend',
            columnSpan: 8,
            dataSourceRef: 'incidentTrend',
            filterBindings: {
              severity: 'severity',
            },
            chart: {
              type: 'bar',
              width: '100%',
              height: '360px',
              xAxis: { dataKey: 'day', label: 'Day', tickFormat: 'MM/dd' },
              yAxis: { label: 'Incidents' },
              cartesianGrid: { strokeDasharray: '3 3' },
              series: {
                nameKey: 'service',
                valueKey: 'count',
                values: [{ label: 'Incidents', value: 'count', name: 'Incidents' }],
                palette: ['#c23030', '#d9822b', '#137cbd'],
              },
            },
          },
          {
            id: 'messages',
            kind: 'dashboard.messages',
            title: 'Operator Notes',
            columnSpan: 4,
            dataSourceRef: 'ops',
            items: [
              {
                severity: 'danger',
                title: 'Critical incidents active',
                body: '${summary.sev1_open} SEV-1 incidents are currently open.',
                visibleWhen: { selector: 'summary.sev1_open', gt: 0 },
              },
              {
                severity: 'info',
                title: 'Severity filter',
                body: 'Active severity filters: ${filters.severity}.',
                visibleWhen: { source: 'filters', field: 'severity', notEmpty: true },
              },
            ],
          },
          {
            id: 'status',
            kind: 'dashboard.status',
            title: 'Service Health',
            columnSpan: 4,
            dataSourceRef: 'ops',
            checks: [
              {
                id: 'availability',
                label: 'Availability',
                selector: 'health.availability_pct',
                format: 'percent',
                tone: { warningBelow: 99.5, dangerBelow: 99.0 },
              },
              {
                id: 'errorRate',
                label: 'Error Rate',
                selector: 'health.error_rate_pct',
                format: 'percent',
                tone: { warningAbove: 1, dangerAbove: 2 },
              },
            ],
          },
          {
            id: 'byService',
            kind: 'dashboard.dimensions',
            title: 'Incidents by Service',
            columnSpan: 8,
            dataSourceRef: 'byService',
            filterBindings: {
              severity: 'severity',
            },
            dimension: { key: 'service', label: 'Service' },
            metric: { key: 'incidents', label: 'Incidents', format: 'number' },
            viewModes: ['chart', 'table'],
            limit: 6,
          },
          {
            id: 'report',
            kind: 'dashboard.report',
            title: 'Operations Report',
            columnSpan: 6,
            sections: [
              {
                id: 'overview',
                title: 'Shift Summary',
                tone: 'info',
                body: [
                  'Open incidents: ${summary.open_incidents}.',
                  'Current MTTR is ${summary.mttr_minutes} minutes.',
                ],
              },
            ],
          },
          {
            id: 'audit',
            kind: 'dashboard.feed',
            title: 'Operations Trail',
            columnSpan: 6,
            dataSourceRef: 'opsAudit',
            filterBindings: {
              severity: 'severity',
            },
            fields: {
              timestamp: 'timestamp',
              title: 'title',
              body: 'body',
            },
          },
        ],
      },
    },
  };
}

export function createOperationsDashboardDemoSeed() {
  return {
    ops: {
      metrics: {
        summary: {
          open_incidents: 7,
          previous_open_incidents: 10,
          sev1_open: 2,
          mttr_minutes: 43,
        },
        health: {
          availability_pct: 99.3,
          error_rate_pct: 1.4,
        },
      },
    },
    incidentTrend: {
      collection: [
        { day: '2026-04-01', service: 'api', severity: 'critical', count: 2 },
        { day: '2026-04-02', service: 'api', severity: 'warning', count: 3 },
        { day: '2026-04-03', service: 'billing', severity: 'warning', count: 2 },
        { day: '2026-04-04', service: 'search', severity: 'info', count: 1 },
      ],
    },
    byService: {
      collection: [
        { service: 'api', severity: 'critical', incidents: 3 },
        { service: 'billing', severity: 'warning', incidents: 2 },
        { service: 'search', severity: 'info', incidents: 1 },
      ],
    },
    opsAudit: {
      collection: [
        { timestamp: '2026-04-07 08:00', severity: 'critical', title: 'SEV-1 opened', body: 'API latency exceeded threshold.' },
        { timestamp: '2026-04-07 08:15', severity: 'warning', title: 'Rollback initiated', body: 'Billing deployment rolled back.' },
        { timestamp: '2026-04-07 08:35', severity: 'info', title: 'Mitigation posted', body: 'Customer comms published to status page.' },
      ],
    },
  };
}

export function createQualityDashboardDemoMetadata() {
  return {
    ns: ['demo', 'dashboard', 'quality'],
    dataSource: {
      quality: { selectionMode: 'none', service: { endpoint: 'demo', uri: 'quality' } },
      nullTrend: { selectionMode: 'none', service: { endpoint: 'demo', uri: 'nullTrend' } },
      byDataset: { selectionMode: 'single', service: { endpoint: 'demo', uri: 'byDataset' } },
      qualityAudit: { selectionMode: 'none', service: { endpoint: 'demo', uri: 'qualityAudit' } },
    },
    view: {
      dataSourceRef: 'quality',
      content: {
        id: 'qualityDashboard',
        kind: 'dashboard',
        title: 'Data Quality Dashboard Demo',
        subtitle: 'A quality-first dashboard variant with checks, summaries, and remediation guidance',
        toolbar: {
          items: [
            {
              id: 'resetDashboardState',
              label: 'Reset Dashboard',
              icon: 'reset',
              align: 'right',
              on: [
                { event: 'onClick', handler: 'window.resetDashboardState', args: ['qualityDashboard'] },
              ],
            },
            {
              id: 'exportDashboard',
              label: 'Download HTML',
              icon: 'download',
              align: 'right',
              on: [
                { event: 'onClick', handler: 'window.exportDashboard', args: ['quality-dashboard-demo.html'] },
              ],
            },
          ],
        },
        layout: {
          kind: 'grid',
          columns: 12,
          gap: '16px',
        },
        containers: [
          {
            id: 'filters',
            kind: 'dashboard.filters',
            title: 'Filters',
            columnSpan: 12,
            items: [
              {
                id: 'domain',
                label: 'Domain',
                field: 'domain',
                multiple: true,
                options: [
                  { label: 'Customer', value: 'customer', default: true },
                  { label: 'Billing', value: 'billing', default: true },
                  { label: 'Identity', value: 'identity' },
                ],
              },
            ],
          },
          {
            id: 'summary',
            kind: 'dashboard.summary',
            title: 'Quality Summary',
            columnSpan: 6,
            dataSourceRef: 'quality',
            metrics: [
              { id: 'rowsChecked', label: 'Rows Checked', selector: 'summary.rows_checked', format: 'compactNumber' },
              { id: 'failedRows', label: 'Failed Rows', selector: 'summary.failed_rows', format: 'compactNumber' },
              { id: 'qualityScore', label: 'Score', selector: 'summary.quality_score_pct', format: 'percent' },
            ],
          },
          {
            id: 'status',
            kind: 'dashboard.status',
            title: 'Quality Checks',
            columnSpan: 6,
            dataSourceRef: 'quality',
            checks: [
              {
                id: 'nullRate',
                label: 'Null Rate',
                selector: 'checks.null_rate_pct',
                format: 'percent',
                tone: { warningAbove: 2, dangerAbove: 5 },
              },
              {
                id: 'dupRate',
                label: 'Duplicate Rate',
                selector: 'checks.duplicate_rate_pct',
                format: 'percent',
                tone: { warningAbove: 1, dangerAbove: 3 },
              },
              {
                id: 'freshness',
                label: 'Freshness Delay (hrs)',
                selector: 'checks.freshness_delay_hours',
                format: 'number',
                tone: { warningAbove: 2, dangerAbove: 6 },
              },
            ],
          },
          {
            id: 'trend',
            kind: 'dashboard.timeline',
            title: 'Null Trend',
            columnSpan: 8,
            dataSourceRef: 'nullTrend',
            filterBindings: {
              domain: 'domain',
            },
            chart: {
              type: 'line',
              width: '100%',
              height: '340px',
              xAxis: { dataKey: 'day', label: 'Day', tickFormat: 'MM/dd' },
              yAxis: { label: 'Null Rate %' },
              cartesianGrid: { strokeDasharray: '3 3' },
              series: {
                nameKey: 'dataset',
                valueKey: 'null_rate_pct',
                values: [{ label: 'Null Rate', value: 'null_rate_pct', name: 'Null Rate' }],
                palette: ['#c23030', '#d9822b', '#137cbd'],
              },
            },
          },
          {
            id: 'messages',
            kind: 'dashboard.messages',
            title: 'Quality Notes',
            columnSpan: 4,
            dataSourceRef: 'quality',
            items: [
              {
                severity: 'warning',
                title: 'Null rate elevated',
                body: 'Current null rate is ${checks.null_rate_pct}%.',
                visibleWhen: { selector: 'checks.null_rate_pct', gt: 2 },
              },
              {
                severity: 'info',
                title: 'Filtered domains',
                body: 'Active domains: ${filters.domain}.',
                visibleWhen: { source: 'filters', field: 'domain', notEmpty: true },
              },
            ],
          },
          {
            id: 'byDataset',
            kind: 'dashboard.dimensions',
            title: 'Issues by Dataset',
            columnSpan: 6,
            dataSourceRef: 'byDataset',
            filterBindings: {
              domain: 'domain',
            },
            dimension: { key: 'dataset', label: 'Dataset' },
            metric: { key: 'issues', label: 'Issues', format: 'number' },
            viewModes: ['chart', 'table'],
            limit: 6,
          },
          {
            id: 'kpiTable',
            kind: 'dashboard.kpiTable',
            title: 'Quality Metrics',
            columnSpan: 6,
            dataSourceRef: 'quality',
            rows: [
              { id: 'passRate', label: 'Pass Rate', value: 'summary.quality_score_pct', format: 'percent', context: 'Score', contextTone: 'success' },
              { id: 'failedRows', label: 'Failed Rows', value: 'summary.failed_rows', format: 'compactNumber', context: 'Volume', contextTone: 'warning' },
              { id: 'delay', label: 'Delay (hrs)', value: 'checks.freshness_delay_hours', format: 'number', context: 'Freshness', contextTone: 'danger' },
            ],
          },
          {
            id: 'report',
            kind: 'dashboard.report',
            title: 'Remediation Report',
            columnSpan: 8,
            sections: [
              {
                id: 'summary',
                title: 'Quality Summary',
                tone: 'info',
                body: [
                  'Quality score is ${summary.quality_score_pct}% across ${summary.rows_checked} checked rows.',
                  'Failed rows currently total ${summary.failed_rows}.',
                ],
              },
              {
                id: 'action',
                title: 'Recommended Action',
                tone: 'warning',
                body: [
                  'Prioritize null remediation in the billing and customer domains before the next downstream sync.',
                ],
              },
            ],
          },
          {
            id: 'audit',
            kind: 'dashboard.feed',
            title: 'Quality Trail',
            columnSpan: 4,
            dataSourceRef: 'qualityAudit',
            filterBindings: {
              domain: 'domain',
            },
            fields: {
              timestamp: 'timestamp',
              title: 'title',
              body: 'body',
            },
          },
        ],
      },
    },
  };
}

export function createQualityDashboardDemoSeed() {
  return {
    quality: {
      metrics: {
        summary: {
          rows_checked: 2800000,
          failed_rows: 126000,
          quality_score_pct: 95.5,
        },
        checks: {
          null_rate_pct: 4.5,
          duplicate_rate_pct: 1.6,
          freshness_delay_hours: 3,
        },
      },
    },
    nullTrend: {
      collection: [
        { day: '2026-04-01', dataset: 'customer_profile', domain: 'customer', null_rate_pct: 2.1 },
        { day: '2026-04-02', dataset: 'customer_profile', domain: 'customer', null_rate_pct: 2.4 },
        { day: '2026-04-03', dataset: 'invoice_fact', domain: 'billing', null_rate_pct: 4.9 },
        { day: '2026-04-04', dataset: 'invoice_fact', domain: 'billing', null_rate_pct: 5.2 },
        { day: '2026-04-05', dataset: 'identity_map', domain: 'identity', null_rate_pct: 1.1 },
      ],
    },
    byDataset: {
      collection: [
        { dataset: 'invoice_fact', domain: 'billing', issues: 68000 },
        { dataset: 'customer_profile', domain: 'customer', issues: 42000 },
        { dataset: 'identity_map', domain: 'identity', issues: 16000 },
      ],
    },
    qualityAudit: {
      collection: [
        { timestamp: '2026-04-07 07:30', domain: 'billing', title: 'Null spike detected', body: 'invoice_fact null rate exceeded 5%.' },
        { timestamp: '2026-04-07 08:05', domain: 'customer', title: 'Validation rerun', body: 'customer_profile checks completed after remediation.' },
        { timestamp: '2026-04-07 08:40', domain: 'identity', title: 'Reference lag', body: 'identity_map freshness delay remains under threshold.' },
      ],
    },
  };
}

const DASHBOARD_DEMO_DEFINITIONS = [
  {
    id: 'performance',
    title: 'Performance Dashboard Demo',
    description: 'Marketing/performance dashboard with country drilldown and export.',
    filename: 'performance-dashboard-demo.html',
    createMetadata: createDashboardDemoMetadata,
    createSeed: createDashboardDemoSeed,
  },
  {
    id: 'operations',
    title: 'Operations Dashboard Demo',
    description: 'Service health and incident dashboard with severity filtering.',
    filename: 'operations-dashboard-demo.html',
    createMetadata: createOperationsDashboardDemoMetadata,
    createSeed: createOperationsDashboardDemoSeed,
  },
  {
    id: 'quality',
    title: 'Data Quality Dashboard Demo',
    description: 'Quality-focused dashboard with checks, distributions, and remediation notes.',
    filename: 'quality-dashboard-demo.html',
    createMetadata: createQualityDashboardDemoMetadata,
    createSeed: createQualityDashboardDemoSeed,
  },
];

export function listDashboardDemoVariants() {
  return DASHBOARD_DEMO_DEFINITIONS.map(({id, title, description, filename}) => ({
    id,
    title,
    description,
    filename,
  }));
}

export function getDashboardDemoDefinition(variant = DEFAULT_DASHBOARD_DEMO_VARIANT) {
  return DASHBOARD_DEMO_DEFINITIONS.find((entry) => entry.id === variant)
    || DASHBOARD_DEMO_DEFINITIONS.find((entry) => entry.id === DEFAULT_DASHBOARD_DEMO_VARIANT);
}

export function createDashboardDemoBundle(variant = DEFAULT_DASHBOARD_DEMO_VARIANT) {
  const definition = getDashboardDemoDefinition(variant);
  return {
    metadata: definition.createMetadata(),
    seed: definition.createSeed(),
  };
}
