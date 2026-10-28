import React from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {useSignals} from '@preact/signals-react/runtime';
import {DashboardReportRuntime} from '../../components/dashboard/DashboardBlocks.jsx';
import {ForgeThemeBoundary} from '../../components/ThemeBoundary.jsx';
import Button from '../../components/Button.jsx';
import '@blueprintjs/core/lib/css/blueprint.css';

// Independently invented UI fixture. The datasource contract is simulated;
// transport/authentication integration is tested by the host, not this page.
const input = signal({page: 4, parameters: {fixedActor: 'fixture', query: {
    offset: 75, limit: 25, filters: {mode: 1, minimum: 10, fixedScope: 7,
        from: '2026-01-01', to: '2026-01-31', requiredKinds: ['a'], optionalKinds: ['x'], optionalCount: 5, optionalAmount: 1.5},
}}});
const control = signal({loaded: true});
const collection = signal([{label: 'Initial sample', amount: 10}]);
const fetchCount = signal(0);
const source = {signals: {control, collection}, handlers: {dataSource: {
    peekInput: () => input.value,
    setLoading: loading => { control.value = {...control.value, loading}; },
    setError: error => { control.value = {...control.value, error}; },
    setInputParameters: parameters => { input.value = {...input.value, parameters}; },
    setPage: page => { input.value = {...input.value, page}; },
    fetchCollection: () => { fetchCount.value++; },
}}};
const param = (id, kind, label, value, options) => ({id, kind, label, value, required: true, options,
    filterBindings: [{datasetRef: 'primary', path: id}]});
const scopeParams = [
    param('mode', 'select', 'Mode', 1, [{label: 'First mode', value: 1}, {label: 'Second mode', value: 2}]),
    param('minimum', 'integer', 'Minimum samples', 10),
    {id: 'period', kind: 'dateRange', label: 'Observation period', required: true,
        value: {start: '2026-01-01', end: '2026-01-31'},
        filterBindings: [{datasetRef: 'primary', path: 'from', valuePath: 'start'},
            {datasetRef: 'primary', path: 'to', valuePath: 'end'}]},
    {...param('requiredKinds', 'select', 'Required kinds', ['a'],
        [{label: 'Required alpha', value: 'a'}, {label: 'Required beta', value: 'b'}]), multiple: true},
    {...param('optionalKinds', 'select', 'Optional kinds', ['x'],
        [{label: 'Optional gamma', value: 'x'}, {label: 'Optional delta', value: 'y'}]), multiple: true, required: false},
    {...param('optionalCount', 'integer', 'Optional count', 5), required: false},
    {...param('optionalAmount', 'number', 'Optional amount', 1.5), required: false},
];
const reportSpec = {
    title: 'Sample observations', viewer: {appearance: 'document'},
    scope: {dataSourceRef: 'reader', params: scopeParams},
    datasets: [{id: 'primary', request: input.value.parameters.query}],
    layoutIntent: {blockOrder: ['filters', 'records']},
    blocks: [
        {id: 'filters', kind: 'filterBarBlock', title: 'Inputs', paramIds: scopeParams.map(param => param.id)},
        {id: 'records', kind: 'tableBlock', title: 'Readings', datasetRef: 'primary',
            columns: [{key: 'label', label: 'Label'}, {key: 'amount', label: 'Amount', dataType: 'number'}]},
    ],
};
const container = {reportRuntime: {reportSpec,
    datasetBindings: {primary: {dataSourceRef: 'reader', queryPath: 'query'}}, presentationMode: 'report'}};
const context = {Context: () => source};
function complete(kind) {
    collection.value = kind === 'empty' ? [] : [{label: 'Updated sample', amount: input.value.parameters.query.filters.minimum}];
    control.value = {loaded: true, loading: false, ...(kind === 'denied' ? {error: {status: 403}} : {})};
}
function App() {
    useSignals();
    return <ForgeThemeBoundary presentation="document">
        <h1>Native report controls fixture</h1>
        <p>Local simulated datasource lifecycle; no external data.</p>
        <Button variant="secondary" onClick={() => complete('ready')}>Complete response</Button>
        <Button variant="secondary" onClick={() => complete('empty')}>Empty response</Button>
        <Button variant="secondary" onClick={() => complete('denied')}>Denied response</Button>
        <output id="request-state">{JSON.stringify({...input.value, fetchCount: fetchCount.value})}</output>
        <DashboardReportRuntime container={container} context={context}/>
    </ForgeThemeBoundary>;
}
createRoot(document.getElementById('root')).render(<App/>);
