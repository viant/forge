import { buildDashboardDefaultFilters } from '../../components/dashboard/dashboardUtils.js';
import { buildDashboardExportModel, buildStandaloneDashboardDocument } from './dashboardExport.js';
import { createDashboardDemoBundle, DEFAULT_DASHBOARD_DEMO_VARIANT, getDashboardDemoDefinition, listDashboardDemoVariants } from './dashboardDemo.js';

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

export function getDashboardDemoExportFilename(variant = DEFAULT_DASHBOARD_DEMO_VARIANT) {
  return getDashboardDemoDefinition(variant)?.filename || `${variant}-dashboard-demo.html`;
}

export function buildDashboardDemoContext(variant = DEFAULT_DASHBOARD_DEMO_VARIANT, options = {}) {
  const { metadata, seed } = createDashboardDemoBundle(variant);
  const rootContainer = getDashboardContainer(metadata);
  const locale = options.locale || rootContainer?.locale || 'en-US';
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
      locale,
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
    locale,
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
        locale,
      };
    },
  };
}

export function buildDashboardDemoExportModel(variant = DEFAULT_DASHBOARD_DEMO_VARIANT, options = {}) {
  const context = buildDashboardDemoContext(variant, options);
  return buildDashboardExportModel({
    container: context.rootContainer,
    context,
    generatedAt: options.generatedAt,
    title: options.title || context.rootContainer?.title,
    subtitle: options.subtitle || context.rootContainer?.subtitle,
  });
}

export function buildDashboardDemoStandaloneHtml(variant = DEFAULT_DASHBOARD_DEMO_VARIANT, options = {}) {
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
