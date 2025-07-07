// src/utils/schemaExplorer.test.js
// Simple data-driven tests for jsonSchemaToRows.

import assert from 'assert/strict';
import { jsonSchemaToRows } from './schemaExplorer.js';

const cases = [
    {
        name: 'flat object',
        schema: {
            type: 'object',
            properties: {
                name: { type: 'string', default: 'John' },
                age: { type: 'integer' },
            },
        },
        expected: [
            {
                id: 'age',
                level: 0,
                name: 'age',
                type: 'integer',
                widget: 'number',
            },
            {
                id: 'name',
                level: 0,
                name: 'name',
                type: 'string',
                widget: 'text',
                default: 'John',
            },
        ],
    },
    {
        name: 'nested object',
        schema: {
            type: 'object',
            properties: {
                address: {
                    type: 'object',
                    properties: {
                        street: { type: 'string' },
                        city: { type: 'string' },
                    },
                },
            },
        },
        expected: [
            {
                id: 'address',
                level: 0,
                name: 'address',
                type: 'object',
                widget: 'object',
                children: [
                    {
                        id: 'address.city',
                        level: 1,
                        name: 'city',
                        type: 'string',
                        widget: 'text',
                    },
                    {
                        id: 'address.street',
                        level: 1,
                        name: 'street',
                        type: 'string',
                        widget: 'text',
                    },
                ],
            },
        ],
    },
    {
        name: 'array of objects',
        schema: {
            type: 'object',
            properties: {
                users: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'integer' },
                            name: { type: 'string' },
                        },
                    },
                },
            },
        },
        expected: [
            {
                id: 'users',
                level: 0,
                name: 'users',
                type: 'array<object>',
                widget: 'object',
                children: [
                    {
                        id: 'users[].id',
                        level: 1,
                        name: 'id',
                        type: 'integer',
                        widget: 'number',
                    },
                    {
                        id: 'users[].name',
                        level: 1,
                        name: 'name',
                        type: 'string',
                        widget: 'text',
                    },
                ],
            },
        ],
    },
];

let failed = false;

for (const tc of cases) {
    const actual = jsonSchemaToRows(tc.schema);
    try {
        assert.deepEqual(actual, tc.expected);
    } catch (e) {
        failed = true;
        console.error(`Test failed: ${tc.name}`);
        console.error(e.message);
    }
}

if (failed) {
    process.exitCode = 1;
}
