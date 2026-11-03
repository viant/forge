import React from 'react';
import {createRoot} from 'react-dom/client';
import Chart from '../../src/components/Chart.jsx';

// Independently invented values exercise raw CSV preservation and CSV quoting.
const rows = [
    {category: 'Plain', amount: 0},
    {category: 'Comma, quote " and café', amount: -1234.125},
    {category: 'Two\nlines', amount: 9007199254740991},
    {category: 'Carriage\rreturn', amount: 0.00000001},
];
const context = {signals: {collection: {value: rows}, control: {value: {}}, metrics: {value: {}}, windowForm: {value: {}}}};
const chart = {type: 'bar', appearance: 'document', xAxis: {dataKey: 'category', label: 'Category, "label"'}, series: {values: [{value: 'amount', label: 'Amount'}]}};
createRoot(document.getElementById('root')).render(<Chart container={{id: 'synthetic-chart-csv', chart}} context={context}/>);
