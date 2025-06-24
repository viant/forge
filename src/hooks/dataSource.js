// useGenericDataSourceHandlers.js
import {
    getInputSignal,
} from "../core";
import {resolveSelector, setSelector} from "../utils/selector.js";

import {arrayEquals} from "../utils/equal.js";

function findDataSourceDependencies(dataSourceRef, dataSources) {
    const dependencies = {};
    Object.entries(dataSources).forEach(([ref, dataSource]) => {
        if (dataSourceRef === ref) return; // Skip self


        const {parameters = []} = dataSource;
        if (!parameters) return;

        parameters.forEach((param) => {
            const {location, in: inWhere} = param;
            const isDependent = inWhere === "dataSource" && location.startsWith(`${dataSourceRef}.`)
            if (isDependent) {
                if (!dependencies[ref]) {
                    dependencies[ref] = [];
                }
                dependencies[ref].push(param);
            }
        });
    });
    return dependencies;
}


function cardinality(config) {
    if (config.cardinality) {
        return config.cardinality;
    }
    if (config.sourceDataKey) {
        return 'one';
    }
    return 'many';
}


/**
 *
 * A generic hook that given a dataSourceId and the entire dataSources,
 * returns handlers for addNew, update, delete, etc., automatically considering deps.
 */
export function useDataSourceHandlers(identity, signals, dataSources, connector) {
    const dataSource = dataSources[identity.dataSourceRef];
    if (!dataSource) {
        throw new Error(`No config found for DS ${identity.dataSourceRef}`);
    }
    const {control, form, selection, collection, input, collectionInfo} = signals
    const dataSourceDependencies = findDataSourceDependencies(identity.dataSourceRef, dataSources)
    const selectionMode = dataSource.selectionMode || 'single';

    const dependencyInputs = {};

    const setInactive = (inactive) => {
        control.value = { ...control.peek(), inactive };
    };

    const isInactive = () => {
        return control.value?.inactive || false;
    }

    const setLoading = (loading) => {
        control.value = {...control.peek(), loading};
    }

    const setError = (error) => {
        control.value = {...control.peek(), error, loading: false};
    }

    const peekLoading = () => {
        return control.peek()?.loading || false;
    }

    const getLoading = () => {
        return control.value?.loading || false;
    }

    const peekError = () => {
        return control.peek()?.error || null;
    }

    const getError = () => {
        return control.value?.error || null;
    }


    /**
     * Extracts a unique filter object for a record based on the uniqueKey array in the dataSource.
     * Each entry in uniqueKey contains `filter` and `parameter` properties.
     *
     * @param {Object} record - The record object to extract the unique filter from.
     * @returns {Object} - A result object with keys from `filter` and values from the record.
     */
    function getUniqueKeyFilter(record) {
        const uniqueKey = dataSource.uniqueKey || [];
        if (!record || !uniqueKey.length) {
            return {}; // Handle invalid inputs gracefully
        }

        const result = {};
        uniqueKey.forEach(({field, parameter}) => {
            if (field && parameter) {
                result[parameter] = resolveSelector(record, field) || '';
            }
        });
        return result;
    }

    /**
     * Extracts a unique value for a record based on the uniqueKey array in the dataSource.
     * Each entry in uniqueKey contains `filter` and `parameter` properties.
     * If only one key is present, the value of that key is returned directly.
     * If multiple keys are present, their values are concatenated.
     *
     * @param {Object} record - The record object to extract the unique value from.
     * @returns {string} - The unique concatenated value for the record.
     */
    function getUniqueKeyValue(record) {
        const uniqueKey = dataSource.uniqueKey || [];
        if (!uniqueKey.length) {
            throw new Error("No unique key found in dataSource");
        }

        // If only one unique key, return the corresponding value directly
        if (uniqueKey.length === 1) {
            const {field} = uniqueKey[0];
            return resolveSelector(record, field) || '';
        }

        // If multiple unique keys, concatenate their values
        return uniqueKey
            .map(({field}) => resolveSelector(record, field) || '') // Extract each value, default to empty string if undefined
            .join('_'); // Concatenate with an underscore or any other delimiter
    }


    /**
     * pushDependencies
     *  - For each child dataSource that references this dataSource,
     *    update the child's input signal with the relevant parameter values from `record`.
     *  - If `record` is null, we can push empty/undefined parameters (so the child won't fetch).
     */
    function pushDependencies(record = {}) {
        Object.entries(dataSourceDependencies).forEach(([depRef, depParameters]) => {


            console.log("pushDependencies", depRef, depParameters)
            let depInput = dependencyInputs[depRef];
            if (!depInput) {
                const childDataSourceId = identity.getDataSourceId(depRef);
                depInput = getInputSignal(childDataSourceId);
                dependencyInputs[depRef] = depInput
            }
            // Prepare new param values
            const newParamValues = {...(depInput.peek().parameters || {})};

            // For each param referencing us
            depParameters.forEach((depParameter) => {
                let paramVal;
                if (record) {
                    const index = depParameter.location.indexOf(".")
                    let fieldName = depParameter.location
                    if (index > 0) {
                        fieldName = depParameter.location.substring(index + 1, depParameter.location.length);
                    }
                    paramVal = resolveSelector(record, fieldName)

                } else {
                    paramVal = undefined;
                }
                newParamValues[depParameter.name] = paramVal;
            });

            // Decide if we automatically set fetch=true or let the child’s DataSource do the check
            // Typically we do set fetch=true if we have a valid record
            const hasAnyParam = Object.values(newParamValues).some((v) => v != null);
            const newFetchVal = !!record && hasAnyParam; // example logic

            // Update child's input
            depInput.value = {
                ...depInput.peek(),
                fetch: true,
                parameters: newParamValues,
            };
        });
    }


    const peekInput = () => {
        return input.peek() || {};
    }


    function setSelected(newSelection) {
        if (dataSource.selfReference) {
            // Tree structure handling
            if (!newSelection || (selectionMode !== 'multi' && !newSelection.nodePath)) {
                // For single selection, clear selection
                selection.value = selectionMode === 'multi' ? {selection: []} : {selected: null, nodePath: null};
                form.value = {};
                if (selectionMode === 'single') {
                    pushDependencies(null);
                }
                return;
            }

            if (selectionMode === 'multi') {
                selection.value = newSelection;
                // No form update or dependency pushing in multi-selection mode
                return;
            }

            // For single selection
            selection.value = newSelection;
            form.value = {...newSelection.selected};

            if (selectionMode === 'single') {
                // Push updates to dependencies
                pushDependencies(newSelection.selected);
            }

            return
        }

        // Existing flat data handling
        if (!newSelection || (selectionMode !== 'multi' && newSelection.rowIndex === -1)) {
            // For single selection, clear selection
            selection.value = selectionMode === 'multi' ? {selection: []} : {selected: null, rowIndex: -1};
            form.value = {};
            if (selectionMode === 'single') {
                pushDependencies(null);
            }
            return;
        }

        if (selectionMode === 'multi') {
            selection.value = newSelection;
            // No form update or dependency pushing in multi-selection mode
            return;
        }

        // For single selection
        selection.value = newSelection;
        form.value = {...newSelection.selected};

        if (selectionMode === 'single') {

            // Push updates to dependencies
            pushDependencies(newSelection.selected);
        }

    }


    const pushLocalState = ({execution, state}) => {
        const [data] = state
        const {args} = execution;
        if (args.length === 0) {
            throw new Error('pushLocalState requires dest argument');
        }
        switch (args[0]) {
            case "filter":
                pushFilterValues({filter: data});
                break;
            case "form":
                setFormData(data);
                break;
            default:
                throw new Error(`Unknown pushLocalState destination: ${args[0]}`);
        }
    }


    const pushFormDependencies = () => {
        const formData = form.peek();
        pushDependencies(formData)
    }

    const setSelection = (props) => {
        const {args} = props;
        let {rowIndex = -1} = args;
        const items = collection.peek() || [];
        let item = {};
        if (rowIndex >= 0 && rowIndex < items.length) {
            item = items[rowIndex];
        }
        setSelected({selected: item, rowIndex: rowIndex});
    };


    // Updated peekSelection and getSelection to handle nodePath
    const getSelection = () => {
        return selection.value || (selectionMode === 'multi' ? {selection: []} : {
            selected: null,
            rowIndex: -1,
            nodePath: null
        });
    };
    const peekSelection = () => {
        return selection.peek() || (selectionMode === 'multi' ? {selection: []} : {
            selected: null,
            rowIndex: -1,
            nodePath: null
        });
    };

    // Updated isSelected function
    const isSelected = ({row, nodePath}) => {
        const currentSelection = getSelection();

        if (dataSource.selfReference) {
            if (selectionMode === 'multi') {
                const selectedItems = currentSelection.selection || [];
                return selectedItems.some(
                    (selectedItem) => arrayEquals(selectedItem.nodePath, nodePath)
                );
            }
            const selectedItem = currentSelection.selected;
            return selectedItem && arrayEquals(currentSelection.nodePath, nodePath);
        }
        // Existing flat data handling
        if (!row) {
            return false;
        }
        const uniqueKeyValue = getUniqueKeyValue(row);
        if (selectionMode === 'multi') {
            const selectedItems = currentSelection.selection || [];
            return selectedItems.some(
                (selectedItem) => getUniqueKeyValue(selectedItem) === uniqueKeyValue
            );
        }
        const selectedItem = currentSelection.selected;
        return selectedItem && getUniqueKeyValue(selectedItem) === uniqueKeyValue;
    };


    const noSelection = () => {
       return ! hasSelection()
    }

    const hasSelection = () => {
        const currentSelection = getSelection();
        if (selectionMode === 'multi') {
            return  currentSelection.selection && currentSelection.selection?.length > 0;
        }
        return !!currentSelection.selected;
    }



    const setAllSelection = () => {
        if (selectionMode !== 'multi') return;
        const items = collection.peek() || [];
        selection.value = {
            selection: items,
        };
    };

    const resetSelection = () => {
        if (selectionMode === 'multi') {
            selection.value = {
                selection: [],
            };
        } else {
            selection.value = {
                selected: null,
                rowIndex: -1,
            };
        }
    };


    // Updated toggleSelection function
    const toggleSelection = ({nodePath, node, rowIndex, row}) => {
        if (dataSource.selfReference) {
            let item = node || getNodeByPath(collection.peek(), nodePath, dataSource.selfReference);
            if (!item) {
                return;
            }
            if (selectionMode === 'multi') {
                const currentSelection = peekSelection().selection || [];
                const existingIndex = currentSelection.findIndex(
                    (selectedItem) => arrayEquals(selectedItem.nodePath, nodePath)
                );
                let newSelection;
                if (existingIndex !== -1) {
                    // Item is already selected, remove it
                    newSelection = currentSelection.filter((_, index) => index !== existingIndex);
                } else {
                    // Item is not selected, add it
                    newSelection = [...currentSelection, {selected: item, nodePath}];
                }
                selection.value = {
                    selection: newSelection,
                };
                return
            }
            if (selectionMode === 'single') {
                const prev = selection.peek() || {selected: null, nodePath: null};
                if (arrayEquals(prev.nodePath, nodePath)) {
                    // De-select
                    setSelected({selected: null, nodePath: null});
                } else {
                    setSelected({selected: item, nodePath});
                }
            }

            return
        }
        // Existing flat data handling
        const items = collection.peek() || [];
        let item = row;
        if (!item && rowIndex >= 0 && rowIndex < items.length) {
            item = items[rowIndex];
        }

        if (selectionMode === 'multi') {
            const currentSelection = peekSelection().selection || [];
            const uniqueKey = getUniqueKeyValue(item);
            const existingIndex = currentSelection.findIndex(
                (selectedItem) => getUniqueKeyValue(selectedItem) === uniqueKey
            );
            let newSelection;
            if (existingIndex !== -1) {
                // Item is already selected, remove it
                newSelection = currentSelection.filter((_, index) => index !== existingIndex);
            } else {
                // Item is not selected, add it
                newSelection = [...currentSelection, item];
            }
            selection.value = {
                selection: newSelection,
            };
        } else if (selectionMode === 'single') {
            const prev = selection.peek() || {selected: null, rowIndex: -1};
            if (prev.rowIndex === rowIndex) {
                // De-select
                setSelected({selected: null, rowIndex: -1});
            } else {
                setSelected({selected: item, rowIndex});
            }
        }
    }


    const handleAddNew = () => {
        resetSelection()
        form.value = {};
    };


    const setInputArgs = (args) => {
        input.value = {
            ...input.peek(),
            args: args,
        };
    };

    const setPage = (page) => {
        input.value = {
            ...input.peek(),
            page,
            fetch: true,
        };
    };


    const getPage = () => {
        return input.value?.page || 1;
    };


    const setFilter = ({filter = {}}) => {
        input.value = {
            ...input.value,
            filter: filter,
            fetch: true,
        };
    };

    // Update filter values without triggering a remote fetch but still
    // propagate the change to any UI subscribers by publishing a fresh
    // input object (immutability keeps reactivity alive).
    const setSilentFilterValues = ({filter = {}}) => {
        const current = input.peek();
        input.value = {
            ...current,
            filter: {
                ...(current.filter || {}),
                ...filter,
            },
        };
    };






    const pushFilterValues = ({filter = {}}) => {
        input.value = {...input.value, fetch: true, filter: filter};
    };


    const getFilter = () => {
        return input.value?.filter || {};
    }

    const peekFilter = () => {
        return input.peek().filter || {};
    }


    const setFormField = ({item, value}) => {
        const fieldKey = item.dataField || item.bindingPath || item.id;
        const previous = form.peek();
        form.value = setSelector(previous, fieldKey, value);
    }

    const setSilentFormField = ({item, value}) => {
        const fieldKey = item.dataField || item.bindingPath || item.id;
        const prev = form.peek();
        form.value = setSelector(prev, fieldKey, value);
    }

    const setFilterValue = ({item, value}) => {
        const fieldKey = item.dataField || item.bindingPath || item.id;
        const prev = input.peek();
        input.value = {
            ...input.value,
            filter: setSelector(prev.filter || {}, fieldKey, value),
        };
        return true
    };


    const setSilentFilterValue = ({item, value}) => {
        const fieldKey = item.dataField || item.bindingPath || item.id;
        const snapshot = input.peek();
        input.value = {
            ...snapshot,
            filter: setSelector(snapshot.filter || {}, fieldKey, value),
        };
        return true;
    };


    const setFormData = ({values = {}}) => {
        form.value = values;
    }

    const setSilentFormData = ({values = {}}) => {
        form.value = {
            ...form.peek(),
            ...values,
        };
        return true;
    }

    const getFormData = () => {
        return form.value || {};
    };


    const peekFormData = () => {
        return form.peek() || {};
    };


    const peekCollection = () => {
        return collection.peek() || [];
    };

    const getCollection = () => {
        return collection.value || [];
    };

    
    const setCollection = (collection) => {
        collection.value  = collection;
    };



    const getDataSourceValue = (scope) => {
        switch (scope) {
            case 'collection':
                return getCollection();
            case 'form':
                return getFormData();
            case 'filter':
                return getFilter();
            case 'filterSet':
                return getFilterSet();
            case 'activeFilter':
                return getActiveFilter();
            default:
                return getFormData();
        }
    }


    const peekDataSourceValue = (scope) => {
        switch (scope) {
            case 'collection':
                return peekCollection();
            case 'form':
                return peekFormData();
            case 'filter':
                return peekFilter();
            case 'filterSet':
                return getFilterSet();
            case 'activeFilter':
                return getActiveFilter();
            default:
                return peekFormData();
        }
    }

    const setActiveFilter = ({execution}) => {
        if (execution.args.length === 0) {
            throw new Error('setActiveFilter requires a name argument');
        }
        const name = execution.args[0];
        const filterSet = dataSource.filterSet || [];
        const activeFilterSet = filterSet.find((fs) => fs.name === name);
        filterSet.forEach((fs) => {
            if (fs.name !== name) {
                fs.default = false;
            }
        });
        activeFilterSet.default = true;
    }


    const getActiveFilter = () => {
        const filterSet = dataSource.filterSet || [];
        const active = filterSet.find((fs) => fs.default)

        return active
    }

    const getFilterSet = () => {
        return dataSource.filterSet || [];

    }

    const getCollectionInfo = () => {
        return collectionInfo.value || {};
    }

    const fetchCollection = (props) => {
        const {filter = {}} = props || {}
        const inputFilter = input.value.filter || {};
        const newValue =  {
            ...input.peek(),
            filter: {...inputFilter, ...filter},
            fetch: true,
        };
        input.value =newValue
    };


    const refreshSelected = () => {
        const snapshot = peekSelection();
        if (snapshot.rowIndex < 0 || selectionMode !== 'single') {
            return;
        }
        const selectedRecord = snapshot.selected;
        if (!selectedRecord) {
            return;
        }
        const filter = getUniqueKeyFilter(selectedRecord);
        input.value = {
            ...input.value,
            refreshFilter: {...filter},
            fetch: true,
            refresh: true,
        };
    };


    const refreshSelection = ({filter = {}}) => {
        const snapshot = peekSelection()
        if (snapshot.rowIndex < 0) {
            return
        }

        const selectedRecord = snapshot.selected
        if (!selectedRecord) {
            return
        }
        input.value = {
            ...input.value,
            refreshFilter: {...filter},
            refresh: true,
        };
    }

    return {
        handleAddNew,
        toggleSelection,
        setSelection,
        setSelected,
        peekSelection,
        getSelection,
        setAllSelection,
        resetSelection,
        isSelected,
        hasSelection,
        noSelection,
        setPage,
        getPage,
        setFilter,
        setSilentFilterValues,


        setFilterValue,
        setSilentFilterValue,
        getFilter,
        peekFilter,
        fetchCollection,
        refreshSelected,
        refreshSelection,
        getCollection,
        setCollection,
        peekCollection,
        getCollectionInfo,
        pushFormDependencies,
        getUniqueKeyFilter,
        getUniqueKeyValue,
        getFormData,
        setFormData,
        setSilentFormData,
        peekFormData,
        setFormField,
        setSilentFormField,
        setError,
        setInactive,
        isInactive,
        setLoading,
        getError,
        peekError,
        getLoading,
        peekLoading,
        peekInput,
        setInputArgs,
        setActiveFilter,
        getActiveFilter,
        getFilterSet,
        pushLocalState,
        getDataSourceValue,
        peekDataSourceValue,

        // Utility: buildOptions – returns {options:[{value,label}]}
        buildOptions: (props) => {
            const  {execution = {}, parameters = {}, args = [], context} = props;
            try {
                const {args: execArgs = []} = execution;
                let dataSourceRef = execArgs[0];
                let labelField    = execArgs[1] || 'label';
                let valueField    = execArgs[2] || 'id';
                let noneLabel     = execArgs[3] || '— default —';
                if (!dataSourceRef) {
                    throw new Error('dataSourceRef is required');
                }
                const dsCtx = context.Context(dataSourceRef);
                const recs = dsCtx?.signals?.collection?.peek() || [];
                const opts = [
                    {value: '', label: noneLabel},
                    ...recs.map((rec) => ({
                        value: rec[valueField],
                        label: rec[labelField] ?? rec[valueField],
                    })),
                ];
                return {options: opts};
            } catch (e) {
                console.error('buildOptions error', e);
                return {};
            }
        },
    };
}
