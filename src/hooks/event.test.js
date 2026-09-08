import { dataSourceEvents, dialogHandlers, useControlEvents, useToolbarControlEvents } from './event.js';

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
