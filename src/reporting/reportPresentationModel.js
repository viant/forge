import {applyChartMetricSelection,normalizeChartMetricSelection} from '../components/chartMetricSelection.js';

// Applies presentation-only choices to an already approved report definition.
// It never accepts datasource descriptors, rows, query arguments, or formulas.
export function applyReportChartSelections(reportSpec, selections = {}) {
 if(!reportSpec || reportSpec.kind!=='reportSpec' || !Array.isArray(reportSpec.blocks)) throw Error('Approved reportSpec required for chart presentation.');
 if(!selections || typeof selections!=='object' || Array.isArray(selections)) throw Error('Chart metric selections must be an object map.');
 const result=JSON.parse(JSON.stringify(reportSpec));
 const blocks=new Map(result.blocks.map(block=>[block.id,block]));
 if(blocks.size!==result.blocks.length) throw Error('Ambiguous report block identity.');
 for(const [id,selection] of Object.entries(selections)) {
  const block=blocks.get(id);
  if(!block || block.kind!=='chartBlock' || !block.chartSpec?.metricSelection || !block.chartModel?.metricSelection) throw Error(`Chart '${id}' does not admit metric selection.`);
  if(!selection || typeof selection!=='object' || Array.isArray(selection) || Object.keys(selection).some(key=>!['primaryField','secondaryField'].includes(key))) throw Error('Only primary and secondary metric fields are admitted.');
  const allowed=block.chartModel.metricSelection.options.map(option=>option.value).filter(field=>block.chartSpec.yFields.includes(field));
  const normalized=normalizeChartMetricSelection(selection,allowed);
  block.chartSpec.metricSelection=normalized;
  // Validation above rejects an invalid request rather than using the chart
  // renderer's compatibility fallback for stale local UI state.
  block.chartModel=applyChartMetricSelection(block.chartModel,normalized);
 }
 return result;
}
