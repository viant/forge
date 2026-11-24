import React from 'react';
import Toolbar from '../../components/table/basic/Toolbar.jsx';

// Presentation recipe only. The producer keeps pending values in the native
// datasource form and commits or resets them through its existing handlers.
export default function TableEditReview({context, changeCount, rowCount, invalid = false}) {
    if (!changeCount) return null;
    const text = <><span data-forge-value-type="number">{changeCount}</span> unsaved {changeCount === 1 ? 'change' : 'changes'} in <span data-forge-value-type="number">{rowCount}</span> {rowCount === 1 ? 'row' : 'rows'}</>;
    return <Toolbar context={context} className="forge-table-edit-review"
        leftContent={<span className="forge-table-edit-review__status" role="status" aria-live="polite"><span className="forge-table-edit-review__dot" aria-hidden="true"/><span>{text}{invalid && <span className="forge-table-edit-review__error">Complete the highlighted fields before applying changes.</span>}</span></span>}
        toolbarItems={[
            {id: 'revert-edits', label: 'Revert all', variant: 'secondary', align: 'right', on: [{event: 'onClick', handler: 'example.revertEdits'}]},
            {id: 'apply-edits', label: 'Apply changes', intent: 'primary', align: 'right', disabled: invalid, on: [{event: 'onClick', handler: 'example.applyEdits'}]},
        ]}/>;
}
