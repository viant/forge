import test from 'node:test';
import assert from 'node:assert/strict';
import {captureDialogReview, reviewedScopeCurrent, trackReviewedPending, releaseReviewedPending} from './reviewedScope.js';

const signal = value => ({value,peek(){return this.value;}});
function fixture() {
    const matches=[{parameter:'owner',source:'windowForm',field:'parent'}];
    const context={metadata:{dialogs:[{id:'edit',actions:[{mutationCommand:{reviewedScope:matches}}]}]},
        signals:{authorization:signal({principal:{subject:'user'}}),windowForm:signal({parent:[{id:7}],message:'Original'})}};
    const props={};
    captureDialogReview(context,'edit',{owner:[{id:7}]},props);
    return {context, matches, props, state:context.signals.windowForm};
}

test('opening values use typed, ordered structure and cannot be recovered from persisted props',()=>{
    const {context,matches,props,state}=fixture();
    assert.equal(reviewedScopeCurrent(context,structuredClone(matches),props),true);
    assert.equal(reviewedScopeCurrent(context,matches,JSON.parse(JSON.stringify(props))),false);
    state.value={parent:[{id:'7'}]};
    assert.equal(reviewedScopeCurrent(context,matches,props),false);
    state.value={parent:[{id:7}]};
    assert.equal(reviewedScopeCurrent(context,matches,props),false);
});

test('closing releases overlapping pending changes in reverse publication order',()=>{
    const {context,props,state}=fixture();
    for (const patch of [{busy:true,message:'First'},{message:'Second'}]) {
        trackReviewedPending(context,props,patch);state.value={...state.value,...patch};
    }
    releaseReviewedPending(props);
    assert.deepEqual(state.peek(),{parent:[{id:7}],message:'Original'});
});

test('a changed actor cannot receive an earlier actor’s state on close',()=>{
    const {context,props,state}=fixture();
    const patch={busy:true,message:'Saving'};
    trackReviewedPending(context,props,patch);state.value={...state.value,...patch};
    context.signals.authorization.value={principal:{subject:'user',tenantId:'newTenant'}};
    releaseReviewedPending(props);
    assert.deepEqual(state.peek(),{parent:[{id:7}]});
});
