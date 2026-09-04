import { evaluatePlainVisibleWhen } from '../../components/visibleWhen.js';

export function permittedOptions(options = [], context) {
    return (Array.isArray(options) ? options : []).filter((option) => {
        if (!option || typeof option !== 'object') return true;
        if (option.visibleWhen && !evaluatePlainVisibleWhen(option.visibleWhen, context)) return false;
        if (option.hiddenWhen && evaluatePlainVisibleWhen(option.hiddenWhen, context)) return false;
        return true;
    });
}
