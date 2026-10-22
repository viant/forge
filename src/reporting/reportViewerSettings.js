export function normalizeReportViewerSettings(value) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Report viewer settings must be an object.');
  if (value.allowChartTableSwitch === undefined) return null;
  if (typeof value.allowChartTableSwitch !== 'boolean') throw new Error('allowChartTableSwitch must be boolean.');
  return {allowChartTableSwitch:value.allowChartTableSwitch};
}
export function resolveReportChartTableSwitch({reportSpec,reportDocument,chartSpec,presentationMode}) {
  if (typeof chartSpec?.allowTableSwitch === 'boolean') return chartSpec.allowTableSwitch;
  const settings=normalizeReportViewerSettings(reportSpec?.viewer ?? reportDocument?.viewer);
  if (settings) return settings.allowChartTableSwitch;
  // Unauthored legacy reports retain their prior host behavior.
  return presentationMode !== 'report';
}
