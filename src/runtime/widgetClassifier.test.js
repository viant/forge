// Basic unit tests for widgetClassifier classify() – data-driven approach.

import { classify } from './widgetClassifier.js';

/**
 * Data-driven test cases.
 * Each object defines the *item* passed to `classify` and the expected widget key.
 */
const cases = [
    // Format-based classification
    { item: { type: 'string', format: 'date' }, expected: 'date' },
    { item: { type: 'string', format: 'date-time' }, expected: 'datetime' },
    { item: { type: 'string', format: 'datetime' }, expected: 'datetime' },

    // Link classifier – should keep working after our change
    { item: { type: 'string', format: 'uri', default: 'https://example.com' }, expected: 'link' },

    // Fallback to generic classifier when no format provided
    { item: { type: 'number' }, expected: 'number' },
    // Password format/type
    { item: { type: 'string', format: 'password' }, expected: 'password' },
    { item: { type: 'password' }, expected: 'password' },
    // Object type
    { item: { type: 'object' }, expected: 'object' },
    // Markdown format/type
    { item: { type: 'string', format: 'markdown' }, expected: 'markdown' },
    { item: { type: 'markdown' }, expected: 'markdown' },
    // Multi-select type
    { item: { type: 'multiSelect' }, expected: 'multiSelect' },
];

for (const { item, expected } of cases) {
    const actual = classify(item);
    if (actual !== expected) {
        console.error(`classify(%o) – expected %s, got %s`, item, expected, actual);
        process.exitCode = 1;
    }
}
