export const WORKFLOW_PRIMITIVES = Object.freeze([
  'editableCollection', 'assignmentPicker', 'mutationCommand', 'statusWorkflow', 'treeEditor', 'wizard',
  'uploadCollection', 'derivedDataSource', 'permissionBoundary', 'responsiveDataGrid', 'historyDiff', 'scheduleEditor',
]);

export const PRESENTATION_PRIMITIVES = Object.freeze([
  'draftForm', 'queryToolbar', 'stableTabs', 'resourceHeader', 'dataStateBoundary', 'relationDrill', 'notificationRules', 'metricSummary', 'detailView', 'masterDetail',
]);

export const UI_PRIMITIVES = Object.freeze([...WORKFLOW_PRIMITIVES, ...PRESENTATION_PRIMITIVES]);
