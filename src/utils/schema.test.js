import { jsonSchemaToFields } from './schema.js';

const schema = {
    type: 'object',
    properties: {
        eventDate: { type: 'string', format: 'date' },
        due: { type: 'string', format: 'date-time' },
    secret: { type: 'string', format: 'password' },
    details: { type: 'object' },
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
};

for (const [name, expected] of Object.entries(expectations)) {
    const actual = widgetMap[name];
    if (actual !== expected) {
        console.error(`Field '${name}' expected widget ${expected}, got ${actual}`);
        process.exitCode = 1;
    }
}
