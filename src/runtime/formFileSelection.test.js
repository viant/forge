import test from 'node:test';
import assert from 'node:assert/strict';
import {beginFileSelection, currentFileRead, fileRevisionMatches, finishFileRead, submittedFileRevision} from './formFileSelection.js';
import {executeCommand} from '../components/primitives/commandExecutor.js';
import {clearProtectedWindowState, getDialogSignal, removeSignalsForKey} from '../core/store/signals.js';

test('overlapping reads share a top-level guard and finish independently', () => {
    const context = {signals:{form:{}}}, left={dataField:'assets.logo'}, right={dataField:'assets.image'};
    const first = beginFileSelection(context,left);
    const image = beginFileSelection(context,right);
    const latest = beginFileSelection(context,left);
    assert.equal(currentFileRead(first),false);
    assert.equal(currentFileRead(image),true);
    finishFileRead(first);
    finishFileRead(latest);
    assert.throws(()=>submittedFileRevision(context,'assets'),/finish loading/);
    finishFileRead(image);
    const reviewed = submittedFileRevision(context,'assets');
    beginFileSelection(context,{dataField:'notes.file'},false);
    assert.equal(fileRevisionMatches(context,'assets',reviewed),true);
    beginFileSelection(context,left,false);
    assert.equal(fileRevisionMatches(context,'assets',reviewed),false);
});

test('a replacement chosen during confirmation prevents stale dispatch even when already decoded', async () => {
    const id='file-choice-confirmation',did='editor';
    const signal=value=>({peek:()=>value,value});
    const context={identity:{windowId:id,dataSourceRef:'draft'},signals:{form:signal({upload:{data:'AA=='}}),windowForm:signal({})},
        handlers:{dataSource:{setEditedFormData(){}}},Context:()=>{throw new Error('Unexpected writer access');}};
    getDialogSignal(id+'Dialog'+did).value={open:true,props:{id:1}};
    try {
        let confirm;
        const saving=executeCommand(context,{dataSourceRef:'save',confirm:'Save?',successFormState:{upload:null}}, {}, {
            dialogId:did,confirm:()=>new Promise(done=>{confirm=done;}),
        });
        const next=beginFileSelection(context,{dataField:'upload'});
        finishFileRead(next);
        confirm(true);
        const result=await saving;
        assert.equal(result.accepted,false);
        assert.match(result.error.message,/selected file changed/);
        assert.deepEqual(context.signals.form.peek().upload,{data:'AA=='});
    } finally {removeSignalsForKey(id);}
});

test('revoking a protected window discards the unfinished file read', () => {
    const id = 'protected-file-read', context = {identity:{windowId:id,protectedWindow:true}, signals:{form:{}}};
    try {
        const read = beginFileSelection(context,{dataField:'document'});
        assert.equal(currentFileRead(read),true);
        clearProtectedWindowState(id);
        assert.equal(currentFileRead(read),false);
        finishFileRead(read);
        assert.doesNotThrow(()=>submittedFileRevision(context,'document'));
    } finally {removeSignalsForKey(id);}
});
