import {protectedWindowEpoch} from '../core/store/signals.js';

// Async file reads belong to the bound form signal. A receipt needs only a
// revision and pending-read state, never the File, encoded bytes or DOM node.
const forms = new WeakMap();

function fieldSelections(context, key) {
    return forms.get(context?.signals?.form)?.get(key);
}

export function beginFileSelection(context, item, reading = true) {
    const owner = context?.signals?.form;
    const path = item?.dataField || item?.bindingPath || item?.id;
    if (!owner || (item?.scope || 'form') !== 'form' || typeof path !== 'string' || !path) return {};
    const key = path.split('.', 1)[0];
    let fields = forms.get(owner);
    if (!fields) {
        fields = new Map();
        forms.set(owner, fields);
    }
    let field = fields.get(key);
    if (!field) {
        field = {revision: 0, pending: new Map()};
        fields.set(key, field);
    }
    const revision = ++field.revision;
    if (reading) field.pending.set(path, revision);
    else field.pending.delete(path);
    const windowId = context.identity?.protectedWindow ? context.identity.windowId : undefined;
    return {field, path, revision, windowId, epoch: windowId ? protectedWindowEpoch(windowId) : undefined};
}

export function currentFileRead(ticket) {
    return (!ticket.windowId || protectedWindowEpoch(ticket.windowId) === ticket.epoch) &&
        (!ticket.field || ticket.field.pending.get(ticket.path) === ticket.revision);
}

export function finishFileRead(ticket) {
    if (ticket?.field && ticket.field.pending.get(ticket.path) === ticket.revision) {
        ticket.field.pending.delete(ticket.path);
    }
}

export function submittedFileRevision(context, name) {
    const field = fieldSelections(context, name);
    if (field?.pending.size) throw new Error('Wait for the selected file to finish loading.');
    return field?.revision || 0;
}

export function fileRevisionMatches(context, name, revision) {
    const field = fieldSelections(context, name);
    return !field?.pending.size && (field?.revision || 0) === revision;
}
