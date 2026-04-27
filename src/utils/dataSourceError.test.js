import { describe, expect, it } from 'vitest';
import { formatDataSourceError, normalizeDataSourceError } from './dataSourceError.js';

describe('dataSourceError', () => {
    it('preserves auth status on normalized request errors', () => {
        const normalized = normalizeDataSourceError({
            message: 'GET error: 403 Forbidden',
            status: 403,
            statusText: 'Forbidden',
            isUnauthorized: true,
        });
        expect(normalized.status).toBe(403);
        expect(normalized.isUnauthorized).toBe(true);
        expect(normalized.message).toBe('GET error: 403 Forbidden');
        expect(String(normalized)).toBe('Access denied. You do not have permission to load this data.');
    });

    it('formats forbidden errors for generic UI surfaces', () => {
        const message = formatDataSourceError({
            message: 'GET error: 403 Forbidden',
            status: 403,
            statusText: 'Forbidden',
        });
        expect(message).toBe('Access denied. You do not have permission to load this data.');
    });

    it('formats unauthorized errors for generic UI surfaces', () => {
        const message = formatDataSourceError({
            message: 'GET error: 401 Unauthorized',
            status: 401,
            statusText: 'Unauthorized',
        });
        expect(message).toBe('Authentication required. Please sign in to continue.');
    });
});
