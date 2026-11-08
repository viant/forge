// Independently authored synthetic editor fixture; no application capture or data.
export const calculatedCatalogConfig = {
    dataSourceRef: 'records',
    dimensions: [{ id: 'period', key: 'period', label: 'Period' }],
    measures: [{ id: 'units', key: 'units', label: 'Units' }],
    calculatedFields: ['primary', 'planned', 'observed'].map(datasetRef => ({
        id: `${datasetRef}Adjusted`, key: 'adjusted', datasetRef,
        label: 'Adjusted units', kind: 'rowCalc', expr: 'units * 2', format: 'number',
    })).concat([{ id: 'plannedOnly', datasetRef: 'planned', expr: 'units + 1' }]),
    dataSources: [
        { id: 'planned', dataSourceRef: 'records', request: { measures: { units: true } }, columnOptions: [
            { key: 'period', label: 'Period', kind: 'dimension' },
            { key: 'units', label: 'Units', kind: 'measure' },
        ] },
        { id: 'observed', dataSourceRef: 'records', request: { measures: { units: true } }, capabilities: { inheritRuntimeFieldCatalog: true } },
    ],
};
export const calculatedCatalogBlocks = ['primary', 'planned', 'observed'].flatMap(datasetRef => [
    { id: `${datasetRef}Kpi`, kind: 'kpiBlock', datasetRef, title: 'Adjusted units', valueField: 'adjusted' },
    { id: `${datasetRef}Table`, kind: 'tableBlock', datasetRef, title: 'Units', columns: [{ key: 'units', label: 'Units' }, { key: 'adjusted', label: 'Adjusted units' }] },
    { id: `${datasetRef}Chart`, kind: 'chartBlock', datasetRef, title: 'Trend', chartSpec: { type: 'line', title: 'Trend', xField: 'period', yFields: ['adjusted'] } },
]);
export const calculatedCatalogState = { selectedDimensions: ['period'], selectedMeasures: ['units'], reportDocumentBlocks: calculatedCatalogBlocks };
