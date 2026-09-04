import {resolveSelector} from '../../../utils/selector.js';
import {evaluatePlainVisibleWhen} from '../../visibleWhen.js';

export function resolveTableCellBadge(row = {}, badge = null, context = null) {
    if (!badge || typeof badge !== 'object') return null;
    if (badge.visibleWhen && !evaluatePlainVisibleWhen(badge.visibleWhen, context)) return null;
    const actual = badge.field ? resolveSelector(row, badge.field) : undefined;
    const mapKey = String(actual);
    const hasMappedLabel = !!badge.valueMap && Object.prototype.hasOwnProperty.call(badge.valueMap, mapKey);
    if (badge.equals !== undefined && actual !== badge.equals) return null;
    if (badge.equals === undefined && badge.field && !actual && !hasMappedLabel) return null;
    const mappedLabel = badge.valueMap && Object.prototype.hasOwnProperty.call(badge.valueMap, mapKey)
        ? badge.valueMap[mapKey]
        : undefined;
    const mappedTone = badge.toneMap && Object.prototype.hasOwnProperty.call(badge.toneMap, mapKey)
        ? badge.toneMap[mapKey]
        : undefined;
    const label = String(mappedLabel ?? badge.label ?? '').trim();
    if (!label) return null;
    return {
        label,
        icon: String(badge.icon || '').trim(),
        tone: String(mappedTone || badge.tone || 'neutral').trim().toLowerCase(),
        className: String(badge.className || '').trim(),
        tooltip: String(badge.tooltip || label).trim(),
        replaceValue: badge.replaceValue === true,
    };
}
