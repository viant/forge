import { buildDashboardDefaultFilters } from '../../components/dashboard/dashboardUtils.js';
import { buildDashboardExportModel, buildStandaloneDashboardDocument } from './dashboardExport.js';
import { createDashboardDemoBundle, listDashboardDemoVariants } from './dashboardDemo.js';

const demoFilenameByVariant = {
  performance: 'performance-dashboard-demo.html',
  operations: 'operations-dashboard-demo.html',
  quality: 'quality-dashboard-demo.html',
};

function createSignalValue(value) {
  return {
    peek: () => value,
    value,
  };
}

function getDashboardContainer(metadata = {}) {
  return metadata?.view?.content || {};
}

function getDashboardId(metadata = {}) {
  return getDashboardContainer(metadata)?.id || 'dashboard';
}

export function getDashboardDemoExportFilename(variant = 'performance') {
  return demoFilenameByVariant[variant] || `${variant}-dashboard-demo.html`;
}

export function buildDashboardDemoContext(variant = 'performance', options = {}) {
  const { metadata, seed } = createDashboardDemoBundle(variant);
  const rootContainer = getDashboardContainer(metadata);
  const dashboardFilters = options.dashboardFilters || buildDashboardDefaultFilters(rootContainer);
  const dashboardSelection = options.dashboardSelection || {};
  const byDataSource = {};

  Object.entries(seed || {}).forEach(([dataSourceRef, value]) => {
    byDataSource[dataSourceRef] = {
      signals: {
        metrics: createSignalValue(value?.metrics || {}),
        collection: createSignalValue(value?.collection || []),
      },
      dashboardFilters,
      dashboardSelection,
      dashboardKey: `${variant}:${getDashboardId(metadata)}`,
    };
  });

  const defaultRef = metadata?.view?.dataSourceRef || Object.keys(byDataSource)[0];

  return {
    metadata,
    seed,
    rootContainer,
    dashboardKey: `${variant}:${getDashboardId(metadata)}`,
    dashboardFilters,
    dashboardSelection,
    signals: {
      metrics: byDataSource[defaultRef]?.signals?.metrics || createSignalValue({}),
      collection: byDataSource[defaultRef]?.signals?.collection || createSignalValue([]),
    },
    Context(dataSourceRef) {
      return byDataSource[dataSourceRef] || {
        signals: {
          metrics: createSignalValue({}),
          collection: createSignalValue([]),
        },
        dashboardFilters,
        dashboardSelection,
        dashboardKey: `${variant}:${getDashboardId(metadata)}`,
      };
    },
  };
}

export function buildDashboardDemoExportModel(variant = 'performance', options = {}) {
  const context = buildDashboardDemoContext(variant, options);
  return buildDashboardExportModel({
    container: context.rootContainer,
    context,
    generatedAt: options.generatedAt,
    title: options.title || context.rootContainer?.title,
    subtitle: options.subtitle || context.rootContainer?.subtitle,
  });
}

export function buildDashboardDemoStandaloneHtml(variant = 'performance', options = {}) {
  const context = buildDashboardDemoContext(variant, options);
  return buildStandaloneDashboardDocument({
    container: context.rootContainer,
    context,
    generatedAt: options.generatedAt,
    title: options.title || context.rootContainer?.title,
    subtitle: options.subtitle || context.rootContainer?.subtitle,
  });
}

export function listDashboardDemoArtifacts() {
  return listDashboardDemoVariants().map((variant) => ({
    ...variant,
    filename: getDashboardDemoExportFilename(variant.id),
  }));
}
