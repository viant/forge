import React from 'react';
import {createRoot} from 'react-dom/client';
import Chart from '../components/Chart.jsx';

// Independently invented constants exercise the shared Cartesian renderer.
const params = new URLSearchParams(window.location.search);
const chart = {
    type: params.get('type') || 'line',
    appearance: params.has('document') ? 'document' : undefined,
    height: Number(params.get('height')) || 240,
    showControls: false,
    xAxis: {dataKey: 'sample'},
    axes: {
        left: {label: params.has('long') ? 'Number of collected samples' : 'Collected samples', domain: [0, 100]},
        right: {label: params.has('token') ? 'ProcessingDurationInMinutes' : params.has('long') ? 'Average processing duration (minutes)' : 'Duration (minutes)', domain: [0, 10]},
    },
    series: {values: [
        {value: 'count', label: 'Sample count', axis: 'left'},
        {value: 'duration', label: 'Processing duration', axis: 'right'},
    ]},
};
const rows = [{sample:'A', count:30, duration:2}, {sample:'B', count:70, duration:5}, {sample:'C', count:50, duration:4}];
const context = {signals: {collection: {value: rows}, control: {value: {}}, metrics: {value: {}}, windowForm: {value: {}}}};
createRoot(document.getElementById('root')).render(<Chart container={{id:'axis-titles',chart}} context={context}/>);
