import equal from 'fast-deep-equal';
import {resolveSelectorParts, assertSafeAssignmentPath} from '../../utils/selector.js';
import {snapshotResourceValue} from './resourceModel.js';

// These indexes contain only immutable metadata. Live values belong to one presentation.
const dialogPlans = new WeakMap();
const matchPlans = new WeakMap();
const reviewKey = Symbol('dialog reviewed scope');

function selectorParts(value) {
    if (typeof value !== 'string' || /[:/\[\]]/.test(value)) return null;
    const parts = value.split('.');
    if (parts.some(part => !part || part.trim() !== part)) return null;
    assertSafeAssignmentPath(value);
    return parts;
}

function planFor(matches) {
    if (!Array.isArray(matches) || !matches.length) return null;
    if (matchPlans.has(matches)) return matchPlans.get(matches);
    let plan = null;
    try {
        const fields = matches.map(({parameter, source, field, dataSourceRef}) => {
            const argument = selectorParts(parameter), path = selectorParts(field);
            const validSource = source === 'windowForm' ? !dataSourceRef
                : Boolean(dataSourceRef) && ['collection', 'selection', 'metrics'].includes(source);
            return validSource && argument && path ? {parameter, argument, path, source, dataSourceRef} : null;
        });
        if (fields.every(Boolean)) plan = {fields, key: JSON.stringify(fields)};
    } catch {
        // Invalid external metadata has no review evidence. Other dialogs remain usable.
    }
    matchPlans.set(matches, plan);
    return plan;
}

function plansFor(dialogs) {
    if (dialogPlans.has(dialogs)) return dialogPlans.get(dialogs);
    const byId = new Map();
    for (const dialog of dialogs) {
        const commands = (Array.isArray(dialog?.actions) ? dialog.actions : []).map(action => planFor(action?.mutationCommand?.reviewedScope)).filter(Boolean);
        if (commands.length) byId.set(dialog.id, commands);
    }
    dialogPlans.set(dialogs, byId);
    return byId;
}

function principal(context) {
    const live = context?.signals?.authorization;
    return (live ? live.peek() : context?.authorization)?.principal;
}

export function captureDialogReview(context, dialogId, parameters, props) {
    const dialogs = context?.metadata?.dialogs;
    if (!Array.isArray(dialogs)) return;
    const plans = plansFor(dialogs).get(dialogId);
    if (!plans) return;
    const actor = principal(context);
    if (typeof actor?.subject !== 'string' || !actor.subject.trim()) return;
    const values = new Map(), keys = new Set();
    for (const {key, fields} of plans) {
        keys.add(key);
        for (const {parameter, argument} of fields) {
            if (!values.has(parameter)) values.set(parameter, snapshotResourceValue(resolveSelectorParts(parameters, argument, true)));
        }
    }
    // Unlike launch args used for form binding, this evidence is neither mutable by
    // a draft nor carried through persistence and restoration.
    Object.defineProperty(props, reviewKey, {value: {
        values, keys, subject: actor.subject, issuer: actor.issuer ?? null, tenantId: actor.tenantId ?? null,
    }});
}

function usable(value) {
    return value != null && (typeof value !== 'string' || value.trim().length > 0);
}

export function reviewedActorCurrent(context, props) {
    const review = props?.[reviewKey], actor = principal(context);
    return Boolean(review && actor?.subject === review.subject && (actor.issuer ?? null) === review.issuer &&
        (actor.tenantId ?? null) === review.tenantId);
}

export function reviewedScopeCurrent(context, matches, props) {
    const review = props?.[reviewKey], plan = planFor(matches);
    if (!plan || !review?.keys.has(plan.key)) return false;
    const current = reviewedActorCurrent(context, props) && plan.fields.every(({parameter, source, dataSourceRef, path}) => {
            const owner = dataSourceRef ? context.Context?.(dataSourceRef) : context;
            const value = resolveSelectorParts(owner?.signals?.[source]?.peek?.(), path, true);
            const original = review.values.get(parameter);
            return usable(original) && usable(value) && equal(original, value);
        });
    if (!current) review.keys.delete(plan.key);
    return current;
}

// Pending feedback belongs to the presentation that set it. Release before closing,
// while that presentation still owns its state, and never late-patch a replacement.
export function trackReviewedPending(context, props, pending) {
    const review = props?.[reviewKey], signal = context.signals?.windowForm;
    if (!review || !signal || !pending) return null;
    const prior = signal.peek() || {};
    const fields = Object.entries(pending || {})
        .filter(([field, value]) => !Object.hasOwn(prior, field) || !equal(value, prior[field]))
        .map(([field, value]) => ({field, value, existed:Object.hasOwn(prior, field), previous:snapshotResourceValue(prior[field])}));
    if (!fields.length) return null;
    review.pending ??= new Set();
    const disarm = () => review.pending.delete(release);
    const release = () => {
        if (!disarm()) return;
        const live = signal.peek() || {}, sameActor = reviewedActorCurrent(context, props);
        let patch;
        for (const {field, value, existed, previous} of fields) {
            if (!Object.hasOwn(live, field) || !equal(live[field], value)) continue;
            patch ??= {...live};
            if (sameActor && existed) patch[field] = previous;
            else delete patch[field];
        }
        if (patch) signal.value = patch;
    };
    review.pending.add(release);
    return {disarm, release};
}

export function releaseReviewedPending(props) {
    const pending = props?.[reviewKey]?.pending;
    if (pending?.size) Array.from(pending).reverse().forEach(release => release());
}
