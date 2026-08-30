import { jsonSchemaToFields } from './schema.js';

const schema = {
    type: 'object',
    properties: {
        eventDate: { type: 'string', format: 'date' },
        due: { type: 'string', format: 'date-time' },
    secret: { type: 'string', format: 'password' },
    details: { type: 'object', readOnly: true },
    reportingWindow: { type: 'object', 'x-ui-widget': 'dateRange' },
    advertiserId: { type: 'number', lookup: {dialogId: 'advertiserPicker'} },
    },
};

const fields = jsonSchemaToFields(schema);

// Build dict name -> widget for easier assertion regardless of ordering.
const widgetMap = Object.fromEntries(fields.map((f) => [f.name, f.widget]));

const expectations = {
    eventDate: 'date',
    due: 'datetime',
    secret: 'password',
    details: 'object',
    reportingWindow: 'dateRange',
    advertiserId: 'lookup',
};

for (const [name, expected] of Object.entries(expectations)) {
    const actual = widgetMap[name];
    if (actual !== expected) {
        console.error(`Field '${name}' expected widget ${expected}, got ${actual}`);
        process.exitCode = 1;
    }
}

if (fields.find((field) => field.name === 'details')?.readOnly !== true) {
    console.error('JSON Schema readOnly must be preserved on generated fields');
    process.exitCode = 1;
}

if (fields.find((field) => field.name === 'advertiserId')?.lookup?.dialogId !== 'advertiserPicker') {
    console.error('JSON Schema lookup metadata must be preserved on generated fields');
    process.exitCode = 1;
}

for (const field of fields) {
    if (field.id !== field.name || field.dataField !== field.name) {
        console.error(`Field '${field.name}' must bind id and dataField to its schema property`);
        process.exitCode = 1;
    }
}
