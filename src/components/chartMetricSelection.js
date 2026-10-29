// Declarative presentation choices over the chart's already admitted fields.
export function normalizeChartMetricSelection(value, fields = []) {
 if (value == null) return null;
 if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Chart metric selection must be an object.');
 const primaryField=String(value.primaryField||'').trim(),secondaryField=String(value.secondaryField||'').trim();
 if (!primaryField || !fields.includes(primaryField) || (secondaryField && !fields.includes(secondaryField)) || secondaryField===primaryField) throw Error('Chart metric selection requires distinct declared primary and secondary fields.');
 return {primaryField,secondaryField};
}
export function applyChartMetricSelection(chart, selection = null) {
 if (!chart?.metricSelection) return chart;
 if (chart.series?.nameKey || !['line','area','bar','horizontal_bar','combo','composed'].includes(chart.type)) throw Error('Metric selection requires a direct cartesian chart.');
 const options=chart.metricSelection.options||chart.series?.values||[];
 const fields=options.map(option=>option.value);
 const defaults=normalizeChartMetricSelection(chart.metricSelection,fields);
 const horizontal=chart.type==='horizontal_bar';
 if(horizontal && (defaults.secondaryField || selection?.secondaryField)) throw Error('Horizontal metric selection supports one primary metric; secondaryField must be empty.');
 if(horizontal && (chart.stacked || chart.layout || options.some(option=>option.axis==='right' || option.stackId || (option.type && option.type!=='horizontal_bar')))) throw Error('Horizontal metric selection requires unstacked horizontal bar options on one value axis.');
 let selected=defaults;
 if(selection){try{selected=normalizeChartMetricSelection(selection,fields)}catch{selected=defaults}}
 const primary=options.find(option=>option.value===selected.primaryField);
 const secondary=options.find(option=>option.value===selected.secondaryField);
 const values=[{...primary,axis:'left'},...(secondary?[{...secondary,axis:'right'}]:[])];
 return {...chart,metricSelection:{...selected,options},series:{...chart.series,values},yAxis:{...chart.yAxis,format:primary.format},axes:{left:{format:primary.format,label:primary.label},...(secondary?{right:{format:secondary.format,label:secondary.label}}:{})}};
}
