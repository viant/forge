// useGenericDataSourceHandlers.js
import { resolveParameters } from "./parameters.js";

const Execution = (context, messageBus) => {
    const executions = [];

    const executeHandler = (execution, args = {}) => {
        try {
            let parameters = {};
            // Resolve parameters before executing handler
            if (execution.parameters && execution.parameters.length > 0) {
                parameters = resolveParameters(execution.parameters, context);
            }

            const initHandler = execution.initHandler;
            if (initHandler) {
                if (!initHandler({ execution, ...args, parameters })) {
                    return false;
                }
            }
            const handler = execution.handler;
            const result = handler({ execution, ...args, parameters });
            if (execution.onDoneHandler) {
                return execution.onDoneHandler({ execution, ...args, result, parameters });
            }
            return result;
        } catch (e) {
            console.error("executeHandler error", execution.id, e);
            const onErrorHandler = execution.onErrorHandler;
            if (onErrorHandler) {
                onErrorHandler({ execution, ...args, error: e });
            } else {
                throw e;
            }
        }
    };

    const scheduleHandler = (execution, args = {}) => {
        messageBus.value = [...messageBus.peek(), { execution: execution, args }];
    };

    let inited = false;
    const init = () => {
        if (!inited) {
            inited = true;
        } else {
            return;
        }

        for (const execution of executions) {
            if (execution.init) {
                execution.initHandler = context.lookupHandler(execution.init);
            }
            if (execution.onError) {
                execution.onErrorHandler = context.lookupHandler(execution.onError);
            }
            if (execution.onDone) {
                execution.onDoneHandler = context.lookupHandler(execution.onDone);
            }
            if (!execution.handler) {
                execution.handler = context.lookupHandler(execution.id);
            }
            // Prepare arguments and parameters
            execution.args = execution.args || [];
            execution.parameters = execution.parameters || [];
        }
    };

    const execute = (args = {}) => {
        init();
        let ret = false;
        for (const execution of executions) {
            if (execution.async) {
                execution["execute"] = (args) => {
                    return executeHandler(execution, args);
                };
                scheduleHandler(execution, args);
                continue;
            }
            ret = executeHandler(execution, args);
        }
        return ret;
    };

    const handlerName = () => {
        init();
        if (executions.length === 0) {
            return null;
        }
        return executions[0].id;
    };

    const push = (execution) => {
        executions.push(execution);
    };

    const size = () => executions.length;
    const hasExecution = () => (executions?.length || 0) > 0;
    return { execute, push, size, handlerName, isDefined: hasExecution };
};

function indexExecution(context, on, handlers, messageBus) {
    on.forEach(({ event, init, handler, onError, onDone, async, args, parameters }) => {
        if (!handlers[event]) {
            handlers[event] = Execution(context, messageBus);
        }
        handlers[event].push({ id: handler, init, onError, onDone, async, args, parameters, handler: null });
    });
}

const isStateEvent = (key) => {
    return ["onValue", "onProperties", "onReadonly"].includes(key);
};

export const useControlEvents = (context, items = [], state) => {
    const { signals } = context;
    const { message } = signals;
    const result = {};

    items.forEach((item) => {
        if (!item.id) {
            return;
        }

        const on = item.on || [];
        const handlers = {};
        switch (item.type) {
            case "button":
                handlers.onClick = Execution(context, message);
                break;
            case "select": // fallthrough
            case "dropdown":
                handlers.onItemSelect = Execution(context, message);
                break;
            case "number": // fallthrough
            case "currency":
                handlers.onValueChange = Execution(context, message);
                break;
            case "label": // fallthrough
            case "progressBar":
                // No handler needed for label and progressBar
                break;
            default:
                handlers.onChange = Execution(context, message);
                break;
        }
        if (on.length === 0 && Object.keys(handlers).length === 0) {
            result[item.id] = { events: {}, stateEvents: {} };
            return;
        }
        indexExecution(context, on, handlers, message);
        if (state) {
            const [data, setData] = state;
            const execution = {
                id: "setData",
                handler: ({ item, value }) => {
                    setData((prevData) => {
                        return { ...prevData, [item.id]: value };
                    });
                },
            };

            for (const key in handlers) {
                if (handlers[key] && handlers[key].isDefined()) {
                    if (handlers[key].id === "setData") {
                        handlers[key].handler = execution.handle;
                    }
                }
            }

            if (handlers.onChange && !handlers.onChange.isDefined()) {
                handlers.onChange.push(execution);
            }
            if (handlers.onValueChange && !handlers.onValueChange.isDefined()) {
                handlers.onValueChange.push(execution);
            }
            if (handlers.onItemSelect && !handlers.onItemSelect.isDefined()) {
                handlers.onItemSelect.push(execution);
            }
        } else {
            if (handlers.onChange && !handlers.onChange.isDefined()) {
                handlers.onChange.push({ id: "dataSource.setFormField" });
            }
            if (handlers.onValueChange && !handlers.onValueChange.isDefined()) {
                handlers.onValueChange.push({ id: "dataSource.setFormField" });
            }
            if (handlers.onItemSelect && !handlers.onItemSelect.isDefined()) {
                handlers.onItemSelect.push({ id: "dataSource.setFormField" });
            }
        }

        const events = {};
        const stateEvents = {};
        for (const key in handlers) {
            if (handlers[key] && handlers[key].isDefined()) {
                if (isStateEvent(key)) {
                    stateEvents[key] = () => handlers[key].execute({ item, state });
                    continue;
                }
                switch (key) {

                    case "onClick":
                        events["onClick"] = (event) => {
                            const value = event.target?.value;
                            return handlers[key].execute({ event, item, value, state });
                        };
                        break;
                    case "onChange":
                        switch (item.type) {
                            case "keyValuePairs": // fallthrough
                            case "date": // fallthrough
                            case "datetime":
                                events["onChange"] = (value) => {
                                    return handlers[key].execute({ item, value, state });
                                };
                                break;
                            case "checkbox":
                            case "toggle":
                                events["onChange"] = (event) => {
                                    const value = event.target?.checked;
                                    return handlers[key].execute({ event, item, value, state });
                                };
                                break;
                            default:
                                events["onChange"] = (event) => {
                                    const value = event.target?.value;
                                    return handlers[key].execute({ event, item, value, state });
                                };
                        }
                        break;
                    case "onValueChange":
                        events["onValueChange"] = (value) => {
                            return handlers[key].execute({ item, value, state });
                        };
                        break;
                    case "onItemSelect":
                        events["onItemSelect"] = (event) => {
                            const value = event.target?.value;
                            return handlers[key].execute({ event, item, value, state });
                        };
                        break;
                    default:
                        // Handle other event keys if necessary
                        break;
                }
            }
        }

        result[item.id] = { events, stateEvents };
    });

    return result;
};





export const fileBrowserHandlers = (context, container) => {
    const { signals } = context;
    const { message } = signals;
    const { on = [] } = container.fileBrowser;
    const handlers = {
        onInit: Execution(context, message),
        onNodeSelect: Execution(context, message),
        onFileSelect: Execution(context, message),
        onFolderSelect: Execution(context, message),
    };
    indexExecution(context, on, handlers, message);

    if (!handlers.onInit.isDefined()) {
        // Default behavior to fetch collection
        handlers.onInit.push({ id: "dataSource.fetchCollection" });
    }
    if (!handlers.onNodeSelect.isDefined()) {
        // Default onSelect behavior
        handlers.onNodeSelect.push({ id: "dataSource.toggleSelection" });
    }

    return handlers;
};


export const editorHandlers = (context, container) => {
    const { signals } = context;
    const { message } = signals;
    const { on = [] } = container.editor;
    const handlers = {
        onInit: Execution(context, message),
    };

    return handlers;
};




export const tableHandlers = (context, container) => {
    const { signals } = context;
    const { message } = signals;
    const { on = [] } = container.table;
    const handlers = {
        onInit: Execution(context, message),
        onRowSelect: Execution(context, message),
        onApplyFilter: Execution(context, message),
    };
    indexExecution(context, on, handlers, message);

    if (!handlers.onInit.isDefined()) {
        // TODO if has dependency refresh only if parent is set
        handlers.onInit.push({ id: "dataSource.fetchCollection" });
    }
    if (!handlers.onRowSelect.isDefined()) {
        handlers.onRowSelect.push({ id: "dataSource.toggleSelection" });
    }
    if (!handlers.onApplyFilter.isDefined()) {
        handlers.onApplyFilter.push({ id: "dataSource.setFilter" });
    }

    return handlers;
};

export const dialogHandlers = (context, container) => {
    const { signals } = context;
    const { message } = signals;
    const { actions = [], items = [], on = [] } = container;
    const handlers = {
        onInit: Execution(context, message),
        onOpen: Execution(context, message),
        onClose: Execution(context, message),
        actions: {},
    };
    actions.forEach((action) => {
        if (!action.on) {
            throw new Error(`Action '${action.id}' 'on' attribute is required`);
        }
        const actionHandler = {
            onClick: Execution(context, message),
        };
        handlers.actions[action.id] = actionHandler;
        indexExecution(context, action.on, actionHandler, message);
    });

    if (on?.length > 0) {
        indexExecution(context, on, handlers, message);
    }
    return handlers;
};

export const dataSourceEvents = (context, dataSource) => {
    const { signals } = context;
    const { message } = signals;
    const { on = [] } = dataSource;
    const handlers = {
        onFetch: Execution(context, message),
    };
    indexExecution(context, on, handlers, message);
    return handlers;
};

export const useCellEvents = ({ context, cellSelection, columnHandlers = {}, onRowClick }) => {
    const keys = Object.keys(columnHandlers);
    const events = {};
    const stateEvents = {};
    if (keys.length === 0) {
        return { events, stateEvents };
    }
    const { isSelected } = context.handlers.dataSource;
    for (const key of keys) {
        const handler = columnHandlers[key];
        if (handler && handler.isDefined()) {
            if (isStateEvent(key)) {
                stateEvents[key] = () => handler.execute({ ...cellSelection });
                continue;
            }
            events[key] = (event) => {
                if (event && event.stopPropagation) {
                    event.stopPropagation();
                    if (!isSelected({ ...cellSelection })) {
                        onRowClick({ event, ...cellSelection });
                    }
                }
                return handler.execute({ event, ...cellSelection });
            };
        }
    }
    return { events, stateEvents };
};

export const useColumnsHandlers = (context, columns = []) => {
    const { signals } = context;
    const { message } = signals;
    const cellHandlers = {};
    columns.forEach((col) => {
        if (!col.id) {
            return;
        }

        const handlers = {
            onClick: null,
            onChange: null,
            onValue: null,
        };

        const on = col.on || [];
        indexExecution(context, on, handlers, message);
        if (col.multiSelect) {
            if (!handlers.onClick) {
                handlers.onClick = Execution(context, message);
                handlers.onClick.push({ id: "dataSource.toggleSelection" });
            }
            if (!handlers.onValue) {
                handlers.onValue = Execution(context, message);
                handlers.onValue.push({ id: "dataSource.isSelected" });
            }
        }

        let isDefined = false;
        Object.keys(handlers).forEach((key) => {
            const handler = handlers[key];
            if (handler && handler.isDefined()) {
                isDefined = true;
            }
        });

        if (isDefined) {
            cellHandlers[col.id] = handlers;
        }
    });
    return cellHandlers;
};




export const useToolbarControlEvents = (context, items = []) => {
    const { signals } = context;
    const { message } = signals;
    const result = {};

    items.forEach((item) => {
        if (!item.id) {
            return;
        }

        const on = item.on || [];
        const handlers = {};
        handlers.onClick = Execution(context, message);
        if (on.length > 0) {
            indexExecution(context, on, handlers, message);
        } else {
            // Default event handlers for some items
            if (item.id === "filterList") {
                handlers.onClick.push({ id: "dataSource.openFilter" });
            } else if (item.id === "refresh") {
                handlers.onClick.push({ id: "dataSource.fetchCollection" });
            } else if (item.id === "settings") {
                handlers.onClick.push({ id: "table.openSetting" });
            }
        }

        // Handle onReadonly event
        if (on.length > 0) {
            indexExecution(context, on, handlers, message);
        }

        const events = {};
        const stateEvents = {};
        for (const key in handlers) {
            const handler = handlers[key];
            if (handler && handler.isDefined()) {
                if (isStateEvent(key)) {
                    stateEvents[key] = () => handler.execute({ item });
                    continue;
                }
                if (key === "onClick") {
                    events["onClick"] = (event) => {
                        return handler.execute({ event, item });
                    };
                }
            }
        }
        result[item.id] = { events, stateEvents };
    });

    return result;
};