import { useToolbarControlEvents } from './event.js';

const createContext = (calls) => ({
    signals: {
        message: {
            value: [],
            peek: () => [],
        },
    },
    lookupHandler: (id) => {
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
        throw new Error(`unexpected handler lookup: ${id}`);
    },
});

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
}
