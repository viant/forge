import { dataSourceEvents, dialogHandlers, useControlEvents, useToolbarControlEvents } from './event.js';
import assert from 'node:assert/strict';

const createContext = (calls) => {
    const context = {
        signals: {
        message: {
            value: [],
            peek: () => [],
        },
        windowForm: {
            value: {},
            peek() {
                return this.value;
            },
        },
        },
    };
    context.lookupHandler = (id) => {
        if (id === 'schedule.saveSchedule') {
            return () => {
                calls.push(id);
                return true;
            };
        }
        if (id === 'toolbar.readonly') {
            return () => {
                calls.push(id);
                return false;
            };
        }
        if (id === 'datasource.success' || id === 'datasource.error') {
            return () => {
                calls.push(id);
                return true;
            };
        }
        if (id === 'dataSource.setFormField') {
            return ({item, value}) => {
                calls.push(`${id}:${item.dataField}=${value}`);
                context.signals.form.value = {...context.signals.form.value, [item.dataField]: value};
                return true;
            };
        }
        if (id === 'dataSource.openFilter') {
            return () => {
                calls.push(id);
                return true;
            };
        }
        if (id === 'form.changed') {
            return () => {
                calls.push(`${id}:${context.signals.form.value.minimum}`);
                return true;
            };
        }
        if (id === 'form.validate') {
            return ({value}) => value === 'invalid' ? 'Invalid value.' : undefined;
        }
        throw new Error(`unexpected handler lookup: ${id}`);
    };
    return context;
};

{
    const received = [];
    const context = createContext([]);
    context.lookupHandler = id => args => received.push({id, args});
    const item = {id: 'rails', type: 'cardRailGroup', scope: 'windowForm', dataField: 'sections', on: [
        {event: 'onTagClick', handler: 'catalog.filter'},
        {event: 'onCountClick', handler: 'catalog.inventory'},
    ]};
    const {events} = useControlEvents(context, [item]).rails;
    const tag = {target: {value: 6}, detail: {tag: {kind: 'channel', id: 6}, section: {id: 'premium'}}};
    const count = {detail: {section: {id: 'premium'}}};
    events.onTagClick(tag);
    events.onCountClick(count);
    assert.deepEqual(received.map(call => call.id), ['catalog.filter', 'catalog.inventory']);
    assert.equal(received[0].args.event, tag);
    assert.equal(received[0].args.value, 6);
    assert.equal(received[1].args.event, count);
    assert.deepEqual(context.signals.windowForm.value, {}, 'Actions do not replace bound collections');
}

{
    const context = createContext([]);
    const handlers = dialogHandlers(context, {
        actions: [
            {id: 'close', label: 'Close', close: true},
            {id: 'save', label: 'Save Record', mutationCommand: {dataSourceRef: 'record_patch'}},
        ],
    });
    if (!handlers || Object.keys(handlers.actions).length !== 0) {
        console.error('declarative dialog mutation actions must not require legacy on handlers');
        process.exitCode = 1;
    }
}

{
    const calls = [];
    const context = createContext(calls);
    const result = useToolbarControlEvents(context, [
        {id: 'filter'},
        {id: 'filterList'},
    ]);

    result.filter.events.onClick({type: 'click'});
    result.filterList.events.onClick({type: 'click'});

    const openCalls = calls.filter((id) => id === 'dataSource.openFilter').length;
    if (openCalls !== 2) {
        console.error(`expected both filter toolbar aliases to open the filter dialog, got ${openCalls}`);
        process.exitCode = 1;
    }
}

{
    const calls = [];
    const context = createContext(calls);
    const result = useToolbarControlEvents(context, [{
        id: 'save',
        on: [
            { event: 'onClick', handler: 'schedule.saveSchedule' },
            { event: 'onReadonly', handler: 'toolbar.readonly' },
        ],
    }]);

    result.save.events.onClick({ type: 'click' });
    result.save.stateEvents.onReadonly();

    const saveCalls = calls.filter((id) => id === 'schedule.saveSchedule').length;
    const readonlyCalls = calls.filter((id) => id === 'toolbar.readonly').length;

    if (saveCalls !== 1) {
        console.error(`expected one toolbar save execution, got ${saveCalls}`);
        process.exitCode = 1;
    }
    if (readonlyCalls !== 1) {
        console.error(`expected one toolbar readonly evaluation, got ${readonlyCalls}`);
        process.exitCode = 1;
    }

    const stateful = useToolbarControlEvents(context, [{
        id: 'edit',
        on: [{
            event: 'onClick',
            handler: 'schedule.saveSchedule',
            state: {mode: 'editor'},
        }],
    }]);
    stateful.edit.events.onClick({type: 'click'});
    if (context.signals.windowForm.value.mode !== 'editor') {
        console.error('expected event metadata state to update shared window state');
        process.exitCode = 1;
    }
}

{
    const calls = [];
    const context = createContext(calls);
    const result = useControlEvents(context, [{
        id: 'domain',
        type: 'text',
        scope: 'form',
        dataField: 'domain',
        on: [{event: 'onValidate', handler: 'form.validate'}],
    }]);

    if (result.domain.stateEvents.onValidate({value: 'invalid'}) !== 'Invalid value.') {
        console.error('expected control onValidate metadata to remain a synchronous state evaluator');
        process.exitCode = 1;
    }
}

{
    const calls = [];
    const context = createContext(calls);
    context.signals.form = {value: {minimum: 12}, peek() { return this.value; }};
    const result = useControlEvents(context, [{
        id: 'minimum',
        type: 'currency',
        scope: 'form',
        dataField: 'minimum',
        on: [{event: 'onChange', handler: 'form.changed'}],
    }]);

    result.minimum.events.onValueChange(16);
    if (context.signals.form.value.minimum !== 16) {
        console.error('expected a custom currency onChange to retain the default form write');
        process.exitCode = 1;
    }
    if (calls.join(',') !== 'dataSource.setFormField:minimum=16,form.changed:16') {
        console.error(`expected form write before custom handler, got ${calls.join(',')}`);
        process.exitCode = 1;
    }
}

{
    const calls = [];
    const context = createContext(calls);
    const events = dataSourceEvents(context, {on: [
        {event: 'onSuccess', handler: 'datasource.success'},
        {event: 'onError', handler: 'datasource.error'},
    ]});
    events.onSuccess.execute({collection: [{id: 1}]});
    events.onError.execute({error: new Error('expected')});
    if (calls.join(',') !== 'datasource.success,datasource.error') {
        console.error(`expected datasource lifecycle events, got ${calls.join(',')}`);
        process.exitCode = 1;
    }
}

// Blueprint boolean widgets emit values; legacy controls emit DOM events.
for (const type of ['checkbox', 'toggle']) {
    const context = createContext([]);
    const lookup = context.lookupHandler;
    context.lookupHandler = id => id === 'dataSource.setWindowFormField' ? ({item, value}) => {context.signals.windowForm.value = {...context.signals.windowForm.value, [item.dataField]: value};} : lookup(id);
    const control = useControlEvents(context, [{id: 'history', type, scope: 'windowForm', dataField: 'history'}]).history;
    control.events.onChange(true);
    assert.equal(context.signals.windowForm.value.history, true);
    control.events.onChange(false);
    assert.equal(context.signals.windowForm.value.history, false);
    control.events.onChange({target: {checked: true}});
    assert.equal(context.signals.windowForm.value.history, true);
}

// The file adapter already stores encoded Blob objects. An authored callback
// must not replace those with the native input's fake path string.
{
 const encoded=[{filename:'a.mp4',data:'AQ=='}];let current=encoded,observed;
 const context={signals:{message:{value:[],peek:()=>[]}},lookupHandler:id=>id==='dataSource.setFormField'?()=>{current='overwritten'}:id==='file.changed'?()=>{observed=current}:()=>true};
 const handlers=useControlEvents(context,[{id:'files',type:'file',dataField:'files',scope:'form',on:[{event:'onChange',handler:'file.changed'}]}]);
 handlers.files.events.onChange({target:{value:'C:\\fakepath\\a.mp4'}});
 assert.equal(current,encoded);assert.equal(observed,encoded);
}

// Window-scoped controls do not need a datasource just to update display state.
for (const [type, event, value] of [['filterChips','onChange',['a']],['text','onChange',''],['number','onValueChange',0],['checkbox','onChange',false]]) {
 const context=createContext([]);let observed;
 context.signals.windowForm.value={filters:{other:'retained'}};
 context.lookupHandler=id=>{assert.equal(id,'changed','no datasource handler lookup');return ()=>{observed=context.signals.windowForm.value.filters.value;};};
 const controls=useControlEvents(context,[{id:'control',type,scope:'windowForm',dataField:'filters.value',on:[{event:'onChange',handler:'changed'}]}]);
 controls.control.events[event](value);
 assert.deepEqual(observed,value,'authored callback observes the new value');
 assert.deepEqual(context.signals.windowForm.value,{filters:{other:'retained',value}});
}
