import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../core', () => ({
    useSetting: () => ({ endpoints: {}, useAuth: () => ({}), targetContext: {} }),
}));

vi.mock('../utils/logger.js', () => ({
    getLogger: () => ({
        debug: () => {},
    }),
}));

import { createDataConnector } from './dataconnector.js';

describe('createDataConnector', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('dedupes identical in-flight GET requests by exact request identity', async () => {
        let resolveFetch;
        global.fetch = vi.fn().mockImplementation(() => new Promise((resolve) => {
            resolveFetch = () => resolve({
                ok: true,
                status: 200,
                json: async () => ({ ok: true }),
            });
        }));

        const connector = createDataConnector({
            service: {
                URL: '/v1/workspace/metadata',
                method: 'GET',
            },
        }, { endpoints: {}, targetContext: {}, auth: {} });

        const first = connector.get({});
        const second = connector.get({});
        resolveFetch();

        await expect(first).resolves.toEqual({ ok: true });
        await expect(second).resolves.toEqual({ ok: true });
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('applies caller-provided request preparation without hardcoding app context', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ ok: true }),
        });

        const connector = createDataConnector({
            service: {
                URL: '/v1/api/datasources/account/fetch',
                method: 'POST',
            },
        }, {
            endpoints: {},
            targetContext: {},
            auth: {},
            prepareRequest: ({ queryParams, body }) => {
                queryParams.append('scope', 'conversation');
                if (body && typeof body === 'object') {
                    body.conversationId = 'conv-1';
                }
            },
        });

        await expect(connector.get({ filter: {}, inputParameters: {} })).resolves.toEqual({ ok: true });
        expect(global.fetch).toHaveBeenCalledWith(
            '/v1/api/datasources/account/fetch?scope=conversation',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    inputs: {},
                    conversationId: 'conv-1',
                }),
            })
        );
    });
});
