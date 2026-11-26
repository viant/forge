// Receipts refer to the collection installed by the datasource. Replacing the
// collection drops its eligibility for reuse without retaining another row set.
import {snapshotFilter} from '../components/dataSourceFetchState.js';
import {protectedDataSourceEpoch, protectedWindowEpoch} from '../core/store/signals.js';

const readersByMetadata = new WeakMap();
const receipts = new WeakMap();
const peek = signal => signal?.peek ? signal.peek() : signal?.value;

export function prepareParentReaders(metadata) {
  if (!metadata) return;
  let refs = readersByMetadata.get(metadata);
  if (refs) return refs;
  refs = new Set();
  const visit = container => {
    if (!container) return;
    for (const operation of container.editableCollection?.operations || []) {
      const spec = operation.prepareSelection;
      if (spec?.parentParameter) refs.add(spec.dataSourceRef);
    }
    for (const child of container.containers || []) visit(child);
  };
  visit(metadata.view?.content);
  for (const dialog of metadata.dialogs || []) visit(dialog.content);
  readersByMetadata.set(metadata, refs);
  return refs;
}

function inputsKey(parameters) {
  return JSON.stringify(snapshotFilter(parameters || {}));
}

function actor(context) {
  return JSON.stringify(context.signals.authorization ? peek(context.signals.authorization) : context.authorization);
}

export function admitParentRead(context, parameters) {
  if (!prepareParentReaders(context.metadata)?.has(context.identity.dataSourceRef)) return null;
  const {windowId, dataSourceId} = context.identity;
  return {
    owner: context.signals.collection, metadata: context.metadata, connector: context.connector,
    actorRef: context.identity.actorRef, actor: actor(context),
    windowEpoch: protectedWindowEpoch(windowId), sourceEpoch: protectedDataSourceEpoch(dataSourceId),
    parameters: inputsKey(parameters),
  };
}

export function recordParentRead(receipt, records) {
  if (receipt && Array.isArray(records) && records.length === 1) receipts.set(records, receipt);
}

export function loadedParentRows(reader, parameters) {
  const {signals, identity} = reader;
  const control = peek(signals?.control);
  if (!control?.loaded || control.loading || control.stale || control.error || control.inactive) return null;
  const rows = peek(signals.collection);
  const receipt = receipts.get(rows);
  if (!receipt || receipt.owner !== signals.collection || receipt.metadata !== reader.metadata ||
      receipt.connector !== reader.connector || receipt.actorRef !== identity.actorRef ||
      receipt.actor !== actor(reader) || receipt.windowEpoch !== protectedWindowEpoch(identity.windowId) ||
      receipt.sourceEpoch !== protectedDataSourceEpoch(identity.dataSourceId)) return null;
  const input = peek(signals.input);
  if (input?.fetch || input?.refresh || receipt.parameters !== inputsKey(input?.parameters) ||
      Object.keys(input?.filter || {}).length || input?.sort?.length || Number(input?.page || 1) !== 1) return null;
  return receipt.parameters === inputsKey(parameters) ? rows : null;
}
