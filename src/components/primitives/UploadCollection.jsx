import React from 'react';
import {Button, Callout, FileInput, Tag} from '@blueprintjs/core';
import {validateUploadCollection} from './workflowModels.js';
import MutationCommand, {useMutationCommandState} from './MutationCommand.jsx';
import {encodeUploadFiles} from './uploadCollectionModel.js';

export default function UploadCollection({container, context}) {
  const spec = container.uploadCollection || {};
  const mutationState = useMutationCommandState(context, spec.upload);
  const [files, setFiles] = React.useState([]);
  const [blobs, setBlobs] = React.useState([]);
  const [encodingError, setEncodingError] = React.useState('');
  const [encoding, setEncoding] = React.useState(false);
  const validation = validateUploadCollection(files, spec);
  const select = (event) => setFiles(Array.from(event.currentTarget.files || []));
  const remove = (index) => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  React.useEffect(() => {
    let active = true;
    setEncodingError('');
    if (!files.length) { setBlobs([]); setEncoding(false); return () => { active = false; }; }
    setEncoding(true);
    encodeUploadFiles(files, {...spec, multiple: true}).then((payload) => { if (active) setBlobs(payload[spec.blobField || 'files']); }, (error) => { if (active) { setBlobs([]); setEncodingError(error.message); } }).finally(() => { if (active) setEncoding(false); });
    return () => { active = false; };
  }, [files]);
  const uploadExtras = {
    transport: 'mcpBlob',
    [spec.blobField || 'files']: spec.multiple === false ? blobs[0] : blobs,
    ...(spec.metadataField ? {[spec.metadataField]: context?.handlers?.dataSource?.getFormData?.() || context?.signals?.form?.value || {}} : {}),
  };
  return (
    <div className="forge-upload-collection" data-forge-primitive="uploadCollection">
      <FileInput fill disabled={mutationState.pending} multiple={spec.multiple !== false} inputProps={{accept: (spec.accept || []).join(',')}} text={files.length ? `${files.length} file${files.length === 1 ? '' : 's'} selected` : spec.emptyMessage || 'Choose files…'} onInputChange={select}/>
      {files.length ? <div className="forge-upload-collection__files">{files.map((file, index) => <Tag key={`${file.name}:${file.size}:${index}`} onRemove={mutationState.pending ? undefined : () => remove(index)}>{file.name}</Tag>)}</div> : null}
      {!validation.valid || encodingError ? <Callout intent="danger">{[...validation.errors, encodingError].filter(Boolean).join(' ')}</Callout> : null}
      <MutationCommand command={{...spec.upload, label: encoding ? 'Preparing…' : 'Upload', intent: 'primary'}} context={context} extras={uploadExtras} disabled={!files.length || !validation.valid || encoding || !!encodingError || blobs.length !== files.length} onSettled={({status}) => { if (status === 'succeeded') setFiles([]); }}/>
    </div>
  );
}
