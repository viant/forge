import React, {useCallback, useState} from 'react';
import {createRoot} from 'react-dom/client';
import '@blueprintjs/core/lib/css/blueprint.css';
import '../../packs/blueprint/theme.css';
import {ForgeThemeBoundary, ForgeThemeProvider} from '../ThemeBoundary.jsx';
import {DashboardLookupChips} from '../dashboard/DashboardBlocks.jsx';
import SchemaBasedForm from '../../widgets/SchemaBasedForm.jsx';
import LookupPickerDialog from './LookupPickerDialog.jsx';

const rows = Array.from({length: 150}, (_, index) => ({
    id: index + 1,
    name: index === 0 ? 'Fender Musical Instruments' : `Advertiser ${index + 1}`,
    status: index % 2 ? 'Active' : 'Available',
    metadata: {source: 'interaction-proof'},
}));

window.__lookupPickerProof = {calls: 0, aborts: 0, selected: null, errorCalls: 0, dashboardCalls: [], dashboardAborts: 0};

function abortableDelay(signal) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 50);
        signal.addEventListener('abort', () => {
            clearTimeout(timer);
            window.__lookupPickerProof.aborts += 1;
            reject(new DOMException('Aborted', 'AbortError'));
        }, {once: true});
    });
}

const dashboardDataSourceContext = {
    handlers: {dataSource: {peekFullCollection: () => [], replaceCollection() {}}},
    signals: {selection: {value: {selection: []}}},
};
const dashboardContext = {
    Context: () => dashboardDataSourceContext,
    handlers: {
        lookup: {
            search({dataSourceRef, query, inputs, signal}) {
                const nodeId = inputs?.Body?.treeLookupParam?.id;
                window.__lookupPickerProof.dashboardCalls.push({dataSourceRef, query, nodeId});
                signal?.addEventListener('abort', () => {
                    window.__lookupPickerProof.dashboardAborts += 1;
                }, {once: true});
                const result = dataSourceRef === 'dashboard_children'
                    ? [{id: nodeId * 10 + 1, name: `${nodeId === 1 ? 'Alpha' : nodeId === 2 ? 'Beta' : 'Fresh'} child`}]
                    : String(query).toLowerCase() === 'fresh'
                        ? [{id: 3, name: 'Fresh result'}]
                        : [{id: 1, name: 'Alpha'}, {id: 2, name: 'Beta'}];
                const delay = dataSourceRef === 'dashboard_children' && nodeId !== 2 ? 200 : 20;
                return new Promise((resolve) => setTimeout(() => resolve(result), delay));
            },
        },
    },
};

function App() {
    const [open, setOpen] = useState(false);
    const [disabled, setDisabled] = useState(false);
    const [selected, setSelected] = useState(null);
    const [showDashboardLookup, setShowDashboardLookup] = useState(true);
    const loadRows = useCallback(async ({query, signal}) => {
        window.__lookupPickerProof.calls += 1;
        await abortableDelay(signal);
        const normalized = String(query || '').trim().toLowerCase();
        if (normalized === 'error') {
            window.__lookupPickerProof.errorCalls += 1;
            if (window.__lookupPickerProof.errorCalls === 1) throw new Error('The advertiser service is temporarily unavailable.');
            return {rows: [rows[0]], totalCount: 1};
        }
        if (normalized === 'none') return {rows: [], totalCount: 0};
        const matches = normalized
            ? rows.filter((row) => row.name.toLowerCase().includes(normalized))
            : rows;
        return {rows: matches, totalCount: matches.length};
    }, []);
    const show = (nextDisabled) => {
        setDisabled(nextDisabled);
        setOpen(true);
    };
    return (
        <ForgeThemeProvider themeId="lookup-proof" scopeClassName="agently-workspace">
            <ForgeThemeBoundary windowKey="lookup-proof">
                <main style={{padding: 24}}>
                    <button type="button" onClick={() => show(false)}>Open picker</button>
                    <button type="button" onClick={() => show(true)}>Open disabled picker</button>
                    <output aria-label="Selected row">{selected ? JSON.stringify(selected) : 'No selection'}</output>
                    {showDashboardLookup ? (
                        <section aria-label="Dashboard lookup race proof">
                            <DashboardLookupChips
                                context={dashboardContext}
                                container={{
                                    dataSourceRef: 'dashboard_selection',
                                    lookup: {
                                        dataSourceRef: 'dashboard_roots',
                                        inputLabel: 'Race lookup',
                                        browseLabel: 'Run race lookup',
                                        interactionMode: 'search',
                                        searchAsYouType: false,
                                        minQueryLength: 1,
                                        valueField: 'id',
                                        labelField: 'name',
                                        drill: {dataSourceRef: 'dashboard_children', valueField: 'id', maxDepth: 1},
                                    },
                                }}
                            />
                        </section>
                    ) : <p>Dashboard lookup unmounted</p>}
                    <button type="button" onClick={() => setShowDashboardLookup(false)}>Unmount dashboard lookup</button>
                    <SchemaBasedForm
                        fields={[{
                            id: 'advertiserId',
                            name: 'advertiserId',
                            label: 'Advertiser',
                            widget: 'lookup',
                            lookup: {
                                dataSource: 'advertiser_lookup',
                                display: '${advertiserName}',
                                outputs: [
                                    {location: 'id', name: 'advertiserId'},
                                    {location: 'name', name: 'advertiserName'},
                                ],
                            },
                        }]}
                        data={{advertiserId: '', advertiserName: ''}}
                        context={{
                            handlers: {
                                lookup: {
                                    open: async () => ({id: 99, name: 'Acme Agency'}),
                                },
                            },
                        }}
                        layout={{kind: 'grid', appearance: 'field-tracks', columns: 1, labels: {mode: 'top'}}}
                        showSubmit={false}
                    />
                    <LookupPickerDialog
                        isOpen={open}
                        title="Select advertiser"
                        searchPlaceholder="Search advertisers"
                        disabled={disabled}
                        columns={[{key: 'name', label: 'Advertiser'}, {key: 'status', label: 'Status'}]}
                        loadRows={loadRows}
                        onCancel={() => setOpen(false)}
                        onSelect={(row) => {
                            window.__lookupPickerProof.selected = row;
                            setSelected(row);
                            setOpen(false);
                        }}
                    />
                </main>
            </ForgeThemeBoundary>
        </ForgeThemeProvider>
    );
}

createRoot(document.getElementById('root')).render(<App />);
