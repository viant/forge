import {lowerReportDocumentToReportSpec} from './reportDocumentModel.js';

// Only the trusted lowerer constructs this error. The bridge reads structured
// locations, never an authored message, request value, row or exception text.
export class AuthoredReportChartValidationError extends Error {
  constructor(diagnostics) {
    super('Authored report contains invalid chart fields.');
    this.name = 'AuthoredReportChartValidationError';
    this.authoredChartValidation = diagnostics;
  }
}

const bounded = value => typeof value === 'string' && value.length <= 128 ? value : '';
function selectedField(chartSpec, field) {
  if(field==='center.value.field')return bounded(chartSpec?.center?.value?.field);
  if (field.startsWith('heatmap.')) return bounded(chartSpec?.heatmap?.[field.slice(8)]);
  if (field === 'xField' || field === 'seriesField') return bounded(chartSpec?.[field]);
  const tooltipIndex = /^tooltip\.fields\.([0-9]+)\.field$/.exec(field);
  if(tooltipIndex)return bounded(chartSpec?.tooltip?.fields?.[Number(tooltipIndex[1])]?.field);
  const index = /^yFields\.([0-9]+)$/.exec(field);
  return index ? bounded(chartSpec?.yFields?.[Number(index[1])]) : '';
}

// Source compilation is independent of data execution. An empty result cannot
// make an invalid field catalog valid, and no parent catalog is inferred here.
export function lowerValidatedReportDocument(document, options = {}) {
  const diagnostics = [];
  const reportSpec = lowerReportDocumentToReportSpec(document, {
    ...options,
    onChartValidation: ({blockId, datasetRef, chartSpec, validation}) => {
      if (validation?.valid) return;
      for (const error of Array.isArray(validation?.errors) ? validation.errors : []) {
        if (diagnostics.length >= 64) break;
        const field = bounded(error?.field);
        diagnostics.push({
          blockId: bounded(blockId), datasetRef: bounded(datasetRef), field,
          fieldRef: selectedField(chartSpec, field), validationCode: bounded(error?.code),
        });
      }
    },
  });
  if (diagnostics.length) throw new AuthoredReportChartValidationError(diagnostics);
  return reportSpec;
}
