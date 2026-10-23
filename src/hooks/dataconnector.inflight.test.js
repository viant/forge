import { describe, expect, it, vi, beforeEach } from 'vitest';

const {warn} = vi.hoisted(() => ({warn: vi.fn()}));

vi.mock('../core', () => ({
    useSetting: () => ({ endpoints: {}, useAuth: () => ({}), targetContext: {} }),
}));

vi.mock('../utils/logger.js', () => ({
    getLogger: () => ({
        debug: () => {},
        warn,
    }),
}));

import { createDataConnector } from './dataconnector.js';

describe('published window binding recovery',()=>{
    const datasource={service:{URL:'/v1/api/datasources/rows/fetch?cohort=1',method:'POST'}};
    const runtime=recoverWindowBinding=>({windowId:'current-window',dataSourceRef:'rows',recoverWindowBinding,
        prepareRequest:request=>({headers:{...request.headers,'Mcp-Session-Id':'session-a'}})});
    const missing=()=>new Response(JSON.stringify({error:'window binding required',code:'window_binding_required',scope:'window'}),
        {status:403,headers:{'Content-Type':'application/json'}});
    it('readmits once and replays one datasource request after the exact missing-binding marker',async()=>{
        const recoverWindowBinding=vi.fn(async()=>{});
        global.fetch=vi.fn().mockResolvedValueOnce(missing()).mockResolvedValueOnce(new Response(JSON.stringify({data:[{id:1}]}),{status:200}));
        const connector=createDataConnector(datasource,runtime(recoverWindowBinding));
        await expect(connector.get({inputParameters:{id:1}})).resolves.toEqual({data:[{id:1}]});
        expect(recoverWindowBinding).toHaveBeenCalledOnce();
        expect(recoverWindowBinding).toHaveBeenCalledWith({windowId:'current-window',signal:null,sessionId:'session-a'});
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(global.fetch.mock.calls[1][1].body).toBe(global.fetch.mock.calls[0][1].body);
    });
    it('does not readmit on a genuine datasource denial or retry after failed metadata admission',async()=>{
        const recoverWindowBinding=vi.fn(async()=>{});
        global.fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({code:'datasource_denied',scope:'dataset'}),{status:403}));
        const connector=createDataConnector(datasource,runtime(recoverWindowBinding));
        await expect(connector.get()).rejects.toMatchObject({status:403,code:'datasource_denied'});
        expect(recoverWindowBinding).not.toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalledTimes(1);
        recoverWindowBinding.mockRejectedValueOnce(new Error('metadata admission denied'));
        global.fetch=vi.fn().mockResolvedValueOnce(missing());
        await expect(connector.get()).rejects.toThrow('metadata admission denied');
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
    it('does not retry a second missing-binding denial',async()=>{
        const recoverWindowBinding=vi.fn(async()=>{});
        global.fetch=vi.fn().mockResolvedValue(missing());
        const connector=createDataConnector(datasource,runtime(recoverWindowBinding));
        await expect(connector.get()).rejects.toMatchObject({status:403,code:'window_binding_required'});
        expect(recoverWindowBinding).toHaveBeenCalledOnce();
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });
    it('replays one GET after readmission and shares the full recovery with a concurrent identical GET',async()=>{
        const recoverWindowBinding=vi.fn(async()=>{});
        global.fetch=vi.fn().mockResolvedValueOnce(missing()).mockResolvedValueOnce(new Response(JSON.stringify({data:[{id:2}]}),{status:200}));
        const connector=createDataConnector({service:{URL:'/v1/api/datasources/rows/fetch?cohort=1',method:'GET'}},
            runtime(recoverWindowBinding));
        const [first,second]=await Promise.all([connector.get(),connector.get()]);
        expect(first).toEqual({data:[{id:2}]});
        expect(second).toEqual(first);
        expect(recoverWindowBinding).toHaveBeenCalledOnce();
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });
});

describe('createDataConnector', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        warn.mockClear();
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

    it('sends the normal datasource input envelope on a published cohort URL', async () => {
        global.fetch = vi.fn().mockResolvedValue({ok: true, status: 200, json: async () => ({data: []})});
        const connector = createDataConnector({
            service: {URL: '/v1/api/datasources/connectors/fetch?cohort=1', method: 'POST'},
        }, {endpoints: {}, targetContext: {}, auth: {}});

        await connector.get({inputParameters: {namespace: 'demo'}, filter: {status: 'active'}});
        const [url, request] = global.fetch.mock.calls[0];
        expect(url).toBe('/v1/api/datasources/connectors/fetch?cohort=1');
        expect(request.headers['Content-Type']).toBe('application/json');
        expect(JSON.parse(request.body)).toEqual({inputs: {namespace: 'demo', status: 'active'}});
    });

    it('appends target context for mutation methods when requested by the service', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ ok: true }),
        });

        const connector = createDataConnector({
            service: {
                URL: '/v1/api/resource',
                includeTargetContext: true,
            },
        }, {
            endpoints: {},
            targetContext: {
                platform: 'android',
                formFactor: 'phone',
                surface: 'compose',
                capabilities: ['markdown', 'chart'],
            },
            auth: {},
        });

        await expect(connector.post({ body: { name: 'created' } })).resolves.toEqual({ ok: true });
        await expect(connector.patch({ body: { name: 'patched' } })).resolves.toEqual({ ok: true });
        await expect(connector.put({ body: { name: 'updated' } })).resolves.toEqual({ ok: true });
        await expect(connector.del({ id: 'item-1' })).resolves.toEqual({ ok: true });

        expect(global.fetch).toHaveBeenCalledTimes(4);
        for (const [url] of global.fetch.mock.calls) {
            const parsed = new URL(url, 'https://forge.test');
            expect(parsed.searchParams.get('platform')).toBe('android');
            expect(parsed.searchParams.get('formFactor')).toBe('phone');
            expect(parsed.searchParams.get('surface')).toBe('compose');
            expect(parsed.searchParams.getAll('capabilities')).toEqual(['markdown', 'chart']);
        }
    });

    it('preserves existing metadata query parameters when appending the web target', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ ok: true }),
        });
        const reference = JSON.stringify({ uri: 'window://workspace/adOrderPicker' });
        const url = `/v1/api/agently/forge/window/adOrderPicker?resourceRef=${encodeURIComponent(reference)}&providerIdentity=internal`;
        const connector = createDataConnector({ service: { URL: url, includeTargetContext: true } }, {
            endpoints: {}, auth: {},
            targetContext: { platform: 'web', formFactor: 'desktop', surface: 'browser', capabilities: ['markdown'] },
        });

        await expect(connector.get({})).resolves.toEqual({ ok: true });
        const requested = new URL(global.fetch.mock.calls[0][0], 'https://forge.test');
        expect(JSON.parse(requested.searchParams.get('resourceRef'))).toEqual({ uri: 'window://workspace/adOrderPicker' });
        expect(requested.searchParams.get('providerIdentity')).toBe('internal');
        expect(requested.searchParams.get('platform')).toBe('web');
        expect(requested.searchParams.get('formFactor')).toBe('desktop');
        expect(requested.searchParams.get('surface')).toBe('browser');
        expect(requested.searchParams.getAll('capabilities')).toEqual(['markdown']);
    });

    it('exposes a returned artifact hash only to the current metadata caller', async () => {
        const hash = 'a'.repeat(64);
        global.fetch = vi.fn().mockResolvedValue({ok:true,status:200,headers:{get:name=>name==='X-Artifact-Hash'?hash:name==='ETag'?`"${hash}.cohort-v1"`:null},json:async()=>({data:{view:{content:{id:'root'}}}})});
        const connector = createDataConnector({service:{URL:'/v1/api/agently/forge/window/records',method:'GET'}},{endpoints:{},targetContext:{},auth:{}});
        const responseInfo = {};
        await connector.get({responseInfo});
        expect(responseInfo).toEqual({artifactHash:hash,etag:`"${hash}.cohort-v1"`});
    });

    it('marks only declared datasource fetches, not a window metadata connector', async () => {
        const phases=vi.fn();
        vi.stubGlobal('window',{__forgeWindowPerfPhaseRecorder:phases});
        global.fetch=vi.fn().mockResolvedValue({ok:true,status:200,headers:{get:()=>null},json:async()=>({data:[]})});
        const metadata=createDataConnector({service:{URL:'/v1/api/agently/forge/window/records',method:'GET'}},
            {endpoints:{},targetContext:{},auth:{},windowId:'instance'});
        const rows=createDataConnector({service:{URL:'/v1/api/datasources/rows/fetch?cohort=1',method:'POST'}},
            {endpoints:{},targetContext:{},auth:{},windowId:'instance',dataSourceRef:'rows'});
        await metadata.get({});
        await rows.get({});
        expect(phases).toHaveBeenCalledOnce();
        expect(phases).toHaveBeenCalledWith('datasource-fetch-start','instance',expect.any(Number));
        vi.unstubAllGlobals();
    });

    it('returns a conditional 304 only to a caller that supplied the ETag', async () => {
        const hash='a'.repeat(64),etag=`"${hash}.cohort-v1"`;
        global.fetch=vi.fn().mockResolvedValue({ok:false,status:304,headers:{get:name=>name==='X-Artifact-Hash'?hash:name==='ETag'?etag:null}});
        const connector=createDataConnector({service:{URL:'/v1/api/agently/forge/window/records',method:'GET'}},{endpoints:{},targetContext:{},auth:{}});
        const responseInfo={};
        await expect(connector.get({ifNoneMatch:etag,responseInfo})).resolves.toEqual({notModified:true});
        expect(global.fetch.mock.calls[0][1].headers['If-None-Match']).toBe(etag);
        expect(responseInfo).toEqual({artifactHash:hash,etag});
    });

    it('never falls back to a retained model after a conditional admission denial', async () => {
        global.fetch=vi.fn().mockResolvedValue({ok:false,status:403,statusText:'Forbidden',headers:{get:()=>null},clone(){return this;},text:async()=> 'denied'});
        const connector=createDataConnector({service:{URL:'/v1/api/agently/forge/window/records',method:'GET'}},{endpoints:{},targetContext:{},auth:{}});
        await expect(connector.get({ifNoneMatch:`"${'a'.repeat(64)}.cohort-v1"`})).rejects.toThrow(/403/);
    });

    it('does not treat an upstream datasource 401 as an expired workspace session', async () => {
        const handleUnauthorized = vi.fn();
        const response = {
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            headers: { get: () => null },
            clone() { return this; },
            text: async () => 'upstream MCP authorization failed',
        };
        global.fetch = vi.fn().mockResolvedValue(response);
        const connector = createDataConnector({
            service: { URL: '/v1/api/datasources/advertiser/fetch', method: 'POST' },
        }, { endpoints: {}, targetContext: {}, auth: { handleUnauthorized } });

        await expect(connector.get({ filter: {}, inputParameters: {} })).rejects.toThrow('upstream MCP authorization failed');
        expect(handleUnauthorized).not.toHaveBeenCalled();
    });

    it('requests login when Agently explicitly marks a workspace authentication failure', async () => {
        const handleUnauthorized = vi.fn();
        const response = {
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            headers: { get: (name) => name === 'X-Agently-Auth-Required' ? 'true' : null },
            clone() { return this; },
            text: async () => 'authorization required',
        };
        global.fetch = vi.fn().mockResolvedValue(response);
        const connector = createDataConnector({
            service: { URL: '/v1/api/datasources/advertiser/fetch', method: 'POST' },
        }, { endpoints: {}, targetContext: {}, auth: { handleUnauthorized } });

        await expect(connector.get({ filter: {}, inputParameters: {} })).rejects.toThrow('authorization required');
        expect(handleUnauthorized).toHaveBeenCalledOnce();
    });

    it.each([false, true])('diagnoses a 401 safely with host auth marker=%s', async authRequired => {
        const handleUnauthorized = vi.fn();
        const response = {
            ok: false, status: 401, statusText: 'Unauthorized',
            url: 'https://private-user:private-password@host.test:8100/v1/api/agently/forge/window/advertiser?token=query-secret#fragment-secret',
            headers: {get: name => name === 'X-Agently-Auth-Required' && authRequired ? 'true' : null},
            clone() { return this; },
            text: async () => JSON.stringify({code: 'authorization_required', error: 'private-response-body'}),
        };
        global.fetch = vi.fn().mockResolvedValue(response);
        const connector = createDataConnector({service: {URL: '/v1/api/agently/forge/window/advertiser'}}, {
            auth: {handleUnauthorized},
        });
        await expect(connector.get({})).rejects.toMatchObject({status: 401, authRequired, code: 'authorization_required'});
        expect(warn).toHaveBeenCalledExactlyOnceWith('request failed', JSON.stringify({
            url: 'https://host.test:8100/v1/api/agently/forge/window/advertiser',
            status: 401, authRequired, code: 'authorization_required',
        }));
        const diagnostic = JSON.stringify(warn.mock.calls);
        for (const secret of ['private-user', 'private-password', 'query-secret', 'fragment-secret', 'private-response-body']) {
            expect(diagnostic).not.toContain(secret);
        }
        expect(handleUnauthorized).toHaveBeenCalledTimes(authRequired ? 1 : 0);
    });
});

it('preserves the server dataset denial code/scope and leaves it recoverable',async()=>{
 global.fetch=vi.fn(async()=>new Response(JSON.stringify({error:'Datasource access denied. Adjust the filter or retry.',code:'datasource_denied',scope:'dataset'}),{status:403,statusText:'Forbidden',headers:{'Content-Type':'application/json'}}));
 const connector=createDataConnector({service:{URL:'/v1/api/datasources/rows/fetch'}});
 await expect(connector.get({})).rejects.toMatchObject({status:403,code:'datasource_denied',scope:'dataset',isUnauthorized:false});
});
it('does not turn an untyped403 or401 into a dataset marker',async()=>{
 global.fetch=vi.fn(async()=>new Response(JSON.stringify({error:'denied'}),{status:403,statusText:'Forbidden'}));
 const connector=createDataConnector({service:{URL:'/v1/api/datasources/rows/fetch'}});
 await expect(connector.get({})).rejects.toMatchObject({status:403,isUnauthorized:true});
});
it('explicit fresh metadata reads bypass pending GET sharing and browser response caches',async()=>{
 const completions=[];global.fetch=vi.fn(()=>new Promise(resolve=>completions.push(()=>resolve({ok:true,json:async()=>({fresh:true})}))));
 const connector=createDataConnector({service:{URL:'/v1/workspace/metadata',method:'GET'}},{endpoints:{},targetContext:{},auth:{}});
 const normal=connector.get({}),fresh=connector.get({fresh:true});expect(global.fetch).toHaveBeenCalledTimes(2);expect(global.fetch.mock.calls[0][1]).not.toHaveProperty('cache');expect(global.fetch.mock.calls[1][1].cache).toBe('no-store');for(const complete of completions)complete();await normal;await fresh;
});
