import {evaluatePlainVisibleWhen} from './visibleWhen.js';

export const dialogCloseDisabledWhen = (dialog = {}) => dialog?.closeDisabledWhen
    || dialog?.properties?.closeDisabledWhen
    || null;

export const isDialogCloseDisabled = (dialog, context) => {
    const condition = dialogCloseDisabledWhen(dialog);
    return !!condition && evaluatePlainVisibleWhen(condition, context);
};
