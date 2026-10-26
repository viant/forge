import React from 'react';
import {Button, Callout, FileInput, Tag} from '@blueprintjs/core';
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
  const validation = validateUploadCollection(files, spec);
  const preparedForSelection = prepared?.files === files && prepared?.transport === spec.transport && prepared?.blobField === spec.blobField && prepared?.prepare === spec.upload?.prepare;
  const blobs = preparedForSelection ? prepared.blobs : [];
  const change = (next, operation) => {
    if (mutationState.pending || unavailable()) return;
    setFiles(next);
    // File references remain local. Authored handlers receive selection metadata
    // so forms can coordinate surrounding controls without reading file bytes.
    const selection = next.map(({name, size, type}) => ({name, size, type}));
    for (const execution of container.on || []) {
      if (execution?.event !== 'onSelectionChange' || !execution.handler) continue;
      context?.lookupHandler?.(execution.handler)?.({context, execution, files: selection, operation});
    }
  };
  const select = event => change(Array.from(event.currentTarget.files || []), 'select');
  const remove = index => change(files.filter((_, fileIndex) => fileIndex !== index), 'remove');
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
      <FileInput fill disabled={mutationState.pending || unavailable()} multiple={spec.multiple !== false} inputProps={{accept: (spec.accept || []).join(',')}} text={files.length ? `${files.length} file${files.length === 1 ? '' : 's'} selected` : spec.emptyMessage || 'Choose files…'} onInputChange={select}/>
      {files.length ? <div className="forge-upload-collection__files">{files.map((file, index) => <Tag key={`${file.name}:${file.size}:${index}`} onRemove={mutationState.pending || unavailable() ? undefined : () => remove(index)}>{file.name}</Tag>)}</div> : null}
      {!validation.valid || encodingError ? <Callout intent="danger">{[...validation.errors, encodingError].filter(Boolean).join(' ')}</Callout> : null}
      <MutationCommand command={{...spec.upload, label: encoding ? 'Preparing…' : 'Upload', intent: 'primary'}} context={context} extras={uploadExtras} disabled={unavailable() || !files.length || !validation.valid || encoding || !!encodingError || blobs.length !== files.length} onSettled={({status}) => { if (status === 'succeeded') setFiles([]); }}/>
    </div>
  );
}
