import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import useUpload from './useUpload.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, host, uploader;
class UploadRequest {
    static requests = [];
    constructor() {this.upload = {}; UploadRequest.requests.push(this);}
    open(method, url) {this.method = method; this.url = url;}
    send(body) {this.body = body;}
    finish(status, body = '') {this.readyState = 4; this.status = status; this.responseText = body; this.onreadystatechange?.();}
    abort() {this.aborted = true; this.finish(0);}
}
const files = () => [new File(['one'],'One.csv'), new File([], 'Empty.txt')];
function Harness() {uploader = useUpload(); return null;}
beforeEach(async () => {
    UploadRequest.requests = [];
    vi.stubGlobal('XMLHttpRequest', UploadRequest);
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    await act(async () => root.render(<Harness/>));
});
afterEach(async () => {if(root) await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks();});

it('stages before preparation and cancels one file without blocking the rest', async () => {
    let resolve, ids;
    await act(async () => {ids = uploader.start(files(), () => new Promise(done => {resolve = done;}));});
    expect(uploader.items.map(item => item.status)).toEqual(['idle','idle']);
    expect(UploadRequest.requests).toHaveLength(0);
    await act(async () => uploader.abort(ids[0]));
    await act(async () => resolve({conversationId:'example'}));
    expect(UploadRequest.requests).toHaveLength(1);
    const request = UploadRequest.requests[0];
    expect(request.body.get('name')).toBe('Empty.txt');
    expect(request.body.get('conversationId')).toBe('example');
    expect(uploader.items[1].status).toBe('uploading');
    await act(async () => request.upload.onprogress({lengthComputable:true,loaded:5,total:10}));
    expect(uploader.items[1].progress).toBe(.5);
    await act(async () => request.finish(200, JSON.stringify({uri:'local-example://empty'})));
    expect(uploader.items.map(item => item.status)).toEqual(['aborted','done']);
});

it('keeps preparation failures visible and permits dismissal', async () => {
    await act(async () => uploader.start(files(), async () => {throw new Error('Preparation failed');}));
    expect(UploadRequest.requests).toHaveLength(0);
    expect(uploader.items.every(item => item.status === 'error' && item.error.message === 'Preparation failed')).toBe(true);
    await act(async () => uploader.abort(uploader.items[0].id));
    expect(uploader.items[0].status).toBe('aborted');
});

it('reports network, service and malformed-success failures instead of disappearing', async () => {
    const selections = Array.from({length:5}, (_,i) => new File(['example'],`File${i}.txt`));
    await act(async () => uploader.start(selections));
    await act(async () => {
        UploadRequest.requests[0].finish(0);
        UploadRequest.requests[1].finish(500);
        UploadRequest.requests[2].finish(200,'bad JSON');
        UploadRequest.requests[3].finish(200,'{}');
        UploadRequest.requests[4].finish(200,'{"uri":5}');
    });
    expect(uploader.items.every(item => item.status === 'error')).toBe(true);
});

it('ignores late completion after cancel and reset', async () => {
    let ids;
    await act(async () => {ids = uploader.start(files());});
    const [first,second] = UploadRequest.requests;
    await act(async () => uploader.abort(ids[0]));
    await act(async () => first.finish(200,'{"uri":"local-example://late"}'));
    expect(uploader.items[0].status).toBe('aborted');
    await act(async () => uploader.reset());
    expect(second.aborted).toBe(true);
    await act(async () => second.finish(200,'{"uri":"local-example://later"}'));
    expect(uploader.items).toEqual([]);
});

it('does not start a deferred transfer after unmount', async () => {
    let resolve;
    await act(async () => uploader.start(files(), () => new Promise(done => {resolve = done;})));
    await act(async () => root.unmount()); root = null;
    await act(async () => resolve({}));
    expect(UploadRequest.requests).toHaveLength(0);
});

it('keeps concurrent selections distinct even within the same millisecond', async () => {
    vi.spyOn(Date,'now').mockReturnValue(1);
    let first,second;
    const [file] = files();
    await act(async () => {first = uploader.start([file]); second = uploader.start([file]);});
    expect(first[0]).not.toBe(second[0]);
    expect(UploadRequest.requests).toHaveLength(2);
});


it('preserves the existing plain-field upload API and request payload', async () => {
    await act(async () => uploader.start([files()[0]], {conversationId:'example',count:42,missing:null}));
    const request = UploadRequest.requests[0];
    expect(request.method).toBe('POST'); expect(request.url).toBe('/upload');
    expect(request.body.get('conversationId')).toBe('example');
    expect(request.body.get('count')).toBe('42'); expect(request.body.has('missing')).toBe(false);
});
