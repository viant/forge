import React, {useState} from 'react';
import {signal} from '@preact/signals-react';
import Typography from '../../components/Typography.jsx';
import WidgetRenderer from '../../runtime/WidgetRenderer.jsx';
import Chart from '../../components/Chart.jsx';
import './typographySpecimen.css';

const chartContext = {signals: {collection: signal([{name: 'Monday delivery volume', value: 12}, {name: 'Tuesday delivery volume', value: 18}]), control: signal({}), selection: signal({}), input: signal({})}};
const chart = {id: 'type-chart', chart: {type: 'bar', height: 220, showControls: false, xAxis: {dataKey: 'name', categoryLabel: {maxCharacters: 14, lines: 2}}, series: {dataKey: 'name', values: [{name: 'Volume', value: 'value'}]}}};

export default function TypographySpecimen() {
    const state = useState({specimenInput: '', specimenDisabled: ''});
    return <section className="forge-type-specimen" aria-label="Typography specimen">
        <Typography as="h1" typeRole="display">Workspace typography</Typography>
        <Typography as="h2" typeRole="heading">A clear page title with room for long names</Typography>
        <Typography as="h3" typeRole="title">Report title</Typography>
        <Typography as="h4" typeRole="section">Section heading</Typography>
        <Typography as="p" typeRole="body">Shared text roles keep instructions, controls and supporting evidence consistent. This paragraph wraps within a comfortable reading width as the available space changes.</Typography>
        <Typography as="p" typeRole="small">Compact supporting text</Typography>
        <Typography as="p" typeRole="metadata">Updated today at 10:24 AM</Typography>
        <Typography as="p" typeRole="caption">Chart caption</Typography>
        <Typography as="p" typeRole="metric">12,345</Typography>
        <Typography as="code" typeRole="code">order_id = 12345</Typography>
        <Typography as="p" typeRole="label">Control label</Typography>
        <WidgetRenderer item={{id: 'specimenInput', label: 'Shared text control', widget: 'text', scope: 'local', properties: {typographyRole: 'body'}}} state={state}/>
        <WidgetRenderer item={{id: 'specimenDisabled', label: 'Disabled control', widget: 'text', scope: 'local', disabled: true, properties: {typographyRole: 'body'}}} state={state}/>
        <WidgetRenderer item={{id: 'specimenInvalid', label: 'Required control', widget: 'text', scope: 'local', validationError: 'Enter a name.', properties: {typographyRole: 'body'}}} state={state}/>
        <WidgetRenderer item={{id: 'specimenAction', label: 'Save example', widget: 'button', icon: 'tick', isStandalone: true, scope: 'local', properties: {typographyRole: 'body'}}} state={state}/>
        <Chart container={chart} context={chartContext} embedded/>
    </section>;
}
