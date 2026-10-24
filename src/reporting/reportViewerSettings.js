export function normalizeReportViewerSettings(value) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Report viewer settings must be an object.');
  if (value.allowChartTableSwitch !== undefined && typeof value.allowChartTableSwitch !== 'boolean') throw new Error('allowChartTableSwitch must be boolean.');
  if (value.appearance !== undefined && value.appearance !== 'document') throw new Error('Unsupported report viewer appearance.');
  const settings = {...(value.allowChartTableSwitch !== undefined ? {allowChartTableSwitch:value.allowChartTableSwitch} : {}), ...(value.appearance ? {appearance:value.appearance} : {})};
  return Object.keys(settings).length ? settings : null;
}
export function resolveReportChartTableSwitch({reportSpec,reportDocument,chartSpec,presentationMode}) {
  if (typeof chartSpec?.allowTableSwitch === 'boolean') return chartSpec.allowTableSwitch;
  const settings=normalizeReportViewerSettings(reportSpec?.viewer ?? reportDocument?.viewer);
  if (typeof settings?.allowChartTableSwitch === 'boolean') return settings.allowChartTableSwitch;
  // Unauthored legacy reports retain their prior host behavior.
  return presentationMode !== 'report';
}
export function updateReportChartTableSwitch(viewer, value) {
  const settings = {...normalizeReportViewerSettings(viewer)};
  if (value === 'true' || value === 'false') settings.allowChartTableSwitch = value === 'true';
  else delete settings.allowChartTableSwitch;
  return normalizeReportViewerSettings(settings);
}
