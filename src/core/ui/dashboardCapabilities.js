export const DASHBOARD_BLOCK_KINDS = [
  'dashboard.summary',
  'dashboard.compare',
  'dashboard.kpiTable',
  'dashboard.filters',
  'dashboard.geoMap',
  'dashboard.timeline',
  'dashboard.composition',
  'dashboard.dimensions',
  'dashboard.messages',
  'dashboard.status',
  'dashboard.feed',
  'dashboard.badges',
  'dashboard.table',
  'dashboard.report',
  'dashboard.detail',
];

export const DASHBOARD_CHART_TYPES = ['line', 'bar', 'area', 'pie', 'donut', 'geoMap'];

export const DASHBOARD_METADATA_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://viant.github.io/forge/schemas/dashboard-metadata.schema.json',
  title: 'Forge Dashboard Metadata',
  type: 'object',
  additionalProperties: true,
  properties: {
    id: { type: 'string' },
    kind: { enum: ['dashboard'] },
    title: { type: 'string' },
    subtitle: { type: 'string' },
    defaultMode: { enum: ['dashboard', 'analyze', 'report', 'document'] },
    toolbar: {
      type: 'object',
      additionalProperties: true,
      properties: {
        modes: {
          type: 'array',
          items: { enum: ['dashboard', 'analyze', 'report', 'document'] },
        },
      },
    },
    report: { $ref: '#/$defs/reportConfig' },
    dashboard: { $ref: '#/$defs/dashboardConfig' },
    containers: {
      type: 'array',
      items: { $ref: '#/$defs/block' },
    },
  },
  $defs: {
    reportConfig: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: { type: 'boolean' },
        mode: { enum: ['document', 'report'] },
        defaultMode: { enum: ['dashboard', 'analyze', 'report', 'document'] },
        title: { type: 'string' },
        subtitle: { type: 'string' },
        generatedAt: { type: 'string' },
        include: {
          type: 'array',
          items: { enum: ['narrative', 'summary', 'report', 'kpis', 'charts', 'tables', 'audit'] },
        },
        export: {
          type: 'array',
          items: { enum: ['html', 'pdf', 'markdown', 'csv'] },
        },
        includeState: {
          type: 'object',
          additionalProperties: { type: 'boolean' },
        },
      },
    },
    block: {
      type: 'object',
      additionalProperties: true,
      properties: {
        id: { type: 'string' },
        kind: { enum: DASHBOARD_BLOCK_KINDS },
        title: { type: 'string' },
        subtitle: { type: 'string' },
        columnSpan: { type: 'number', minimum: 1 },
        dataSourceRef: { type: 'string' },
        filterBindings: { $ref: '#/$defs/bindings' },
        selectionBindings: { $ref: '#/$defs/bindings' },
        visibleWhen: { $ref: '#/$defs/condition' },
        metric: { $ref: '#/$defs/metric' },
        dimension: {
          type: 'object',
          additionalProperties: true,
          properties: {
            key: { type: 'string' },
            label: { type: 'string' },
          },
        },
        chart: {
          type: 'object',
          additionalProperties: true,
          properties: {
            type: { enum: DASHBOARD_CHART_TYPES },
          },
        },
        geo: { $ref: '#/$defs/geoConfig' },
        dashboard: { $ref: '#/$defs/dashboardConfig' },
        report: { $ref: '#/$defs/reportConfig' },
        containers: {
          type: 'array',
          items: { $ref: '#/$defs/block' },
        },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: true,
            properties: {
              title: { type: 'string' },
              tone: { enum: ['info', 'success', 'warning', 'danger'] },
              body: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      },
    },
    dashboardConfig: {
      type: 'object',
      additionalProperties: true,
      properties: {
        visibleWhen: { $ref: '#/$defs/condition' },
        reportOptions: { $ref: '#/$defs/reportConfig' },
        summary: {
          type: 'object',
          additionalProperties: true,
          properties: {
            metrics: {
              type: 'array',
              items: { $ref: '#/$defs/metric' },
            },
          },
        },
        compare: {
          type: 'object',
          additionalProperties: true,
          properties: {
            items: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
        },
        kpiTable: {
          type: 'object',
          additionalProperties: true,
          properties: {
            rows: { type: 'array', items: { type: 'object', additionalProperties: true } },
            columns: { type: 'array', items: { type: ['string', 'object'] } },
          },
        },
        filters: {
          type: 'object',
          additionalProperties: true,
          properties: {
            items: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
        },
        geo: { $ref: '#/$defs/geoConfig' },
        dimensions: {
          type: 'object',
          additionalProperties: true,
          properties: {
            dimension: {
              type: 'object',
              additionalProperties: true,
              properties: {
                key: { type: 'string' },
                label: { type: 'string' },
              },
            },
            metric: { $ref: '#/$defs/metric' },
            viewModes: {
              type: 'array',
              items: { enum: ['chart', 'table'] },
            },
            limit: { type: 'number', minimum: 1 },
          },
        },
        messages: {
          type: 'object',
          additionalProperties: true,
          properties: {
            items: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
        },
        status: {
          type: 'object',
          additionalProperties: true,
          properties: {
            checks: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
        },
        feed: {
          type: 'object',
          additionalProperties: true,
          properties: {
            fields: { type: 'object', additionalProperties: true },
          },
        },
        report: {
          type: 'object',
          additionalProperties: true,
          properties: {
            sections: {
              type: 'array',
              items: { type: 'object', additionalProperties: true },
            },
          },
        },
        badges: {
          type: 'object',
          additionalProperties: true,
          properties: {
            items: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
        },
        table: {
          type: 'object',
          additionalProperties: true,
          properties: {
            columns: { type: 'array', items: { type: ['string', 'object'] } },
            limit: { type: 'number', minimum: 1 },
            quickFilter: { type: 'boolean' },
            density: { type: 'string' },
            formattingRules: { type: 'array', items: { type: 'object', additionalProperties: true } },
            rowActions: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
        },
      },
    },
    bindings: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
    condition: {
      type: 'object',
      additionalProperties: true,
      properties: {
        source: { enum: ['metrics', 'filters', 'selection'] },
        dataSourceRef: { type: 'string' },
        selector: { type: 'string' },
        field: { type: 'string' },
        key: { type: 'string' },
        when: {},
        equals: {},
        notEquals: {},
        in: {
          type: 'array',
          items: {},
        },
        gt: { type: 'number' },
        gte: { type: 'number' },
        lt: { type: 'number' },
        lte: { type: 'number' },
        empty: { type: 'boolean' },
        notEmpty: { type: 'boolean' },
      },
    },
    metric: {
      type: 'object',
      additionalProperties: true,
      properties: {
        key: { type: 'string' },
        selector: { type: 'string' },
        label: { type: 'string' },
        format: { enum: ['currency', 'number', 'percent', 'compact'] },
      },
    },
    geoConfig: {
      type: 'object',
      additionalProperties: true,
      properties: {
        shape: { enum: ['us-states', 'us-state-tiles'] },
        key: { type: 'string' },
        codeKey: { type: 'string' },
        regionKey: { type: 'string' },
        labelKey: { type: 'string' },
        nameKey: { type: 'string' },
        dimension: { type: 'string' },
        metric: { $ref: '#/$defs/metric' },
        metricKey: { type: 'string' },
        valueKey: { type: 'string' },
        valueLabel: { type: 'string' },
        format: { enum: ['currency', 'number', 'percent', 'compact'] },
        aggregate: { enum: ['sum', 'avg', 'min', 'max', 'first'] },
        limit: { type: 'number', minimum: 1 },
        legend: { type: 'boolean' },
        palette: {
          type: 'array',
          items: { type: 'string' },
        },
        emptyColor: { type: 'string' },
        color: {
          type: 'object',
          additionalProperties: true,
          properties: {
            field: { type: 'string' },
            palette: {
              type: 'array',
              items: { type: 'string' },
            },
            empty: { type: 'string' },
            rules: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: true,
                properties: {
                  value: {},
                  equals: {},
                  when: {},
                  label: { type: 'string' },
                  color: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
};

export const DASHBOARD_COMMANDS = [
  'ui.dashboard.capabilities',
  'ui.dashboard.listDemos',
  'ui.dashboard.getDemo',
  'ui.dashboard.openDemo',
  'ui.dashboard.listDemoArtifacts',
  'ui.dashboard.generateDemoArtifacts',
  'ui.dashboard.exportHtml',
  'ui.dashboard.exportFromContainer',
  'ui.dashboard.exportWindow',
  'ui.dashboard.filter.set',
  'ui.dashboard.filter.clear',
  'ui.dashboard.selection.set',
  'ui.dashboard.selection.clear',
  'ui.dashboard.state.get',
  'ui.dashboard.state.reset',
];
