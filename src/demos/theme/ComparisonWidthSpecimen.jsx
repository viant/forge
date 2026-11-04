import React, {useState} from 'react';
import ComparisonBars from '../../components/ComparisonBars.jsx';

const rows = [
    {name: 'Northern region with a descriptive label', value: -25},
    {name: 'Southern region', value: 50},
    {name: 'No change', value: 0},
    {name: 'Not measured', value: null},
];
const series = {value: 'value', color: '#2563eb'};
const format = value => `${value} units`;

export default function ComparisonWidthSpecimen() {
    const [selected, setSelected] = useState('None');
    return <section aria-label="Comparison panel widths" className="forge-chart-document" style={{gridTemplateColumns: 'minmax(0, 1fr)'}}>
        {[300, 700].map(width => <div key={width} data-comparison-panel={width} style={{width, maxWidth: '100%'}}>
            <h3>{width === 300 ? 'Narrow comparison panel' : 'Wide comparison panel'}</h3>
            <ComparisonBars rows={rows} series={series} categoryKey="name" formatter={format}
                onSelect={row => setSelected(row.name)}/>
        </div>)}
        <p aria-label="Selected comparison" aria-live="polite">{selected}</p>
    </section>;
}
