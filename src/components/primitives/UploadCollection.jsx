import React from 'react';
import {Alert, Callout, FileInput, Tag} from '@blueprintjs/core';
import {validateUploadCollection} from './workflowModels.js';
import MutationCommand, {useMutationCommandState} from './MutationCommand.jsx';
import {encodeUploadFiles} from './uploadCollectionModel.js';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';
import {usePredicateSignals} from './usePredicateSignals.js';

export default function UploadCollection({container, context}) {
  const spec = container.uploadCollection || {};
  usePredicateSignals(context);
  const unavailable = () => !!((container.disabledWhen && evaluatePlainVisibleWhen(container.disabledWhen, context)) || (container.readOnlyWhen && evaluatePlainVisibleWhen(container.readOnlyWhen, context)));
  const mutationState = useMutationCommandState(context, spec.upload);
  const [files, setFiles] = React.useState([]);
  const [prepared, setPrepared] = React.useState(null);
  const [encodingError, setEncodingError] = React.useState('');
  const [encoding, setEncoding] = React.useState(false);
  const [replacement, setReplacement] = React.useState(null);
  const busy = mutationState.pending || mutationState.guarded || ['validating', 'confirming', 'preparing', 'pending'].includes(mutationState.phase);
  const blocked = unavailable();
  const validation = validateUploadCollection(files, spec);
  const preparedForSelection = prepared?.files === files && prepared?.transport === spec.transport && prepared?.blobField === spec.blobField && prepared?.prepare === spec.upload?.prepare;
  const blobs = preparedForSelection ? prepared.blobs : [];
  const change = (next, operation) => {
    if (busy || unavailable()) return;
    setFiles(next);
    // File references remain local. Authored handlers receive selection metadata
    // so forms can coordinate surrounding controls without reading file bytes.
    const selection = next.map(({name, size, type}) => ({name, size, type}));
    for (const execution of container.on || []) {
      if (execution?.event !== 'onSelectionChange' || !execution.handler) continue;
      context?.lookupHandler?.(execution.handler)?.({context, execution, files: selection, operation});
    }
  };
  const select = event => {
    const next = Array.from(event.currentTarget.files || []);
    // Reset the native chooser even on cancellation of a later confirmation,
    // so selecting the same path again still emits a browser change event.
    event.currentTarget.value = '';
    if (!next.length || busy || unavailable() || replacement) return;
    if (files.length && spec.replaceConfirmation) {
      setReplacement({next, previous: files, commandId: spec.upload?.commandId, dataSourceRef: spec.upload?.dataSourceRef});
      return;
    }
    change(next, 'select');
  };
  const remove = index => {if (!replacement) change(files.filter((_, fileIndex) => fileIndex !== index), 'remove');};
  const confirmReplacement = () => {
    const pending = replacement;
    setReplacement(null);
    if (!pending || pending.previous !== files || pending.commandId !== spec.upload?.commandId || pending.dataSourceRef !== spec.upload?.dataSourceRef) return;
    change(pending.next, 'select');
  };
  React.useEffect(() => {setReplacement(null);}, [blocked, busy, spec.upload?.commandId, spec.upload?.dataSourceRef]);
  React.useEffect(() => {
    let active = true;
    setEncodingError('');
    if (!files.length || !validation.valid) { setPrepared(null); setEncoding(false); return () => { active = false; }; }
    setEncoding(true);
    encodeUploadFiles(files, {...spec, multiple: true}).then((payload) => {
      if (active) setPrepared({files, transport: spec.transport, blobField: spec.blobField, prepare: spec.upload?.prepare, blobs: payload[spec.blobField || 'files']});
    }, (error) => { if (active) { setPrepared(null); setEncodingError(error.message); } }).finally(() => { if (active) setEncoding(false); });
    return () => { active = false; };
  }, [files, validation.valid, spec.transport, spec.blobField, spec.upload?.prepare]);
  const uploadExtras = {
    transport: spec.transport || 'mcpBlob',
    [spec.blobField || 'files']: spec.multiple === false ? blobs[0] : blobs,
    ...(spec.metadataField ? {[spec.metadataField]: context?.handlers?.dataSource?.getFormData?.() || context?.signals?.form?.value || {}} : {}),
  };
  return (
    <div className="forge-upload-collection" data-forge-primitive="uploadCollection">
      <FileInput fill disabled={busy || blocked || !!replacement} multiple={spec.multiple !== false} inputProps={{accept: (spec.accept || []).join(',')}} text={files.length ? `${files.length} file${files.length === 1 ? '' : 's'} selected` : spec.emptyMessage || 'Choose files…'} onInputChange={select}/>
      {files.length ? <div className="forge-upload-collection__files">{files.map((file, index) => <Tag key={`${file.name}:${file.size}:${index}`} onRemove={busy || blocked || replacement ? undefined : () => remove(index)}>{file.name}</Tag>)}</div> : null}
      {!validation.valid || encodingError ? <Callout intent="danger">{[...validation.errors, encodingError].filter(Boolean).join(' ')}</Callout> : null}
      <MutationCommand command={{...spec.upload, label: encoding ? 'Preparing…' : 'Upload', intent: 'primary'}} context={context} extras={uploadExtras} disabled={blocked || !!replacement || !files.length || !validation.valid || encoding || !!encodingError || blobs.length !== files.length} onSettled={({status}) => { if (status === 'succeeded' && !spec.retainOnSuccess) setFiles([]); }}/>
      <Alert isOpen={!!replacement} confirmButtonText="Replace" cancelButtonText="Cancel" onConfirm={confirmReplacement} onCancel={() => setReplacement(null)}>{spec.replaceConfirmation}</Alert>
    </div>
  );
}
