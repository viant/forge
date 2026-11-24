import {draftSnapshot, resetDraft} from '../../components/primitives/draftFormModel.js';
import {editableCellError} from '../../components/table/basic/editableCellValue.js';
import {validateWidgetControlValue} from '../../core/ui/controlActions.js';

// Composed sample choices reuse the registered controls' own type contracts.
// EditableTextCell retains its existing Text/Email/Number validation path.
const sampleCellError = (value, properties = {}) => ['select', 'switch'].includes(properties.type)
    ? validateWidgetControlValue(value, {item: {type: properties.type}, props: properties})
    : editableCellError(value, properties);

// Synthetic-example producer actions, not a persistence API. Committed sample
// records stay in savedRecords; the existing datasource form owns pending edits.
// Cell onValue/onProperties hooks display drafts without changing sort/filter keys.
export function tableEditSpecimenActions(context, columns, onStatus = () => {}) {
    const source = () => context.Context('savedRecords');
    const draft = () => context.Context('pendingEdits');
    const pending = () => draft().signals.form.value?.pending || {};
    const original = row => source().signals.collection.value.find(record => record.id === row.id) || row;
    const value = ({row, col}) => Object.hasOwn(pending()[row.id] || {}, col.id)
        ? pending()[row.id][col.id] : original(row)[col.id];
    const reset = () => resetDraft(draft(), draftSnapshot({pending: {}}), false);
    return {
        editValue: value,
        editProperties: args => {
            const changed = Object.hasOwn(pending()[args.row.id] || {}, args.col.id);
            const error = sampleCellError(value(args), args.col.cellProperties);
            return {
                'data-edit-state': changed ? 'pending' : 'clean',
                'aria-description': [args.col.cellProperties?.['aria-description'], changed ? `Unsaved change. Previous value: ${original(args.row)[args.col.id] ?? 'empty'}.` : ''].filter(Boolean).join(' ') || undefined,
                validationError: error || undefined,
                'aria-invalid': error ? true : undefined,
            };
        },
        edit: ({row, col, event}) => {
            const nextValue = event.target.value;
            const all = {...(draft().signals.form.peek()?.pending || {})};
            const fields = {...all[row.id]};
            if (Object.is(nextValue, original(row)[col.id]) || (typeof nextValue === 'string' && nextValue === String(original(row)[col.id] ?? ''))) delete fields[col.id];
            else fields[col.id] = nextValue;
            if (Object.keys(fields).length) all[row.id] = fields;
            else delete all[row.id];
            draft().handlers.dataSource.setEditedFormData({values: {pending: all}});
            return true;
        },
        revertEdits: () => {reset(); onStatus('Changes reverted.'); return true;},
        applyEdits: () => {
            const edits = draft().signals.form.peek()?.pending || {};
            const state = tableEditSpecimenState(edits, columns);
            if (!state.changeCount || state.invalid) return false;
            source().handlers.dataSource.setCollection(source().handlers.dataSource.peekCollection().map(row => ({...row, ...edits[row.id]})));
            reset();
            onStatus(`${state.changeCount} ${state.changeCount === 1 ? 'change' : 'changes'} applied locally.`);
            return true;
        },
    };
}

export function tableEditSpecimenState(pending = {}, columns = []) {
    const changes = Object.values(pending).flatMap(fields => Object.entries(fields));
    return {
        rowCount: Object.keys(pending).length,
        changeCount: changes.length,
        invalid: changes.some(([field, value]) => {
            const column = columns.find(column => column.id === field);
            return !!sampleCellError(value, column?.cellProperties);
        }),
    };
}
