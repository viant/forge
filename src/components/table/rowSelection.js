import {evaluatePlainVisibleWhen} from '../visibleWhen.js';

export const isRowSelectionDisabled = (condition, row, context = {}) => {
    if (!condition) return false;
    return evaluatePlainVisibleWhen(condition, {...context, row: row || {}});
};
