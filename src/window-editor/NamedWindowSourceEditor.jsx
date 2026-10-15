import React, {useEffect, useRef, useState} from 'react';
import CodeMirror from '@uiw/react-codemirror';
import {yaml} from '@codemirror/lang-yaml';
import {EditorView} from '@codemirror/view';
import {readDocument} from './windowDocument';

function windowFile(manifest){
  const prefix=`extension/forge/windows/${manifest.binding.windowKey}`;
  return [`${prefix}/main.yaml`,`${prefix}.yaml`,`${prefix}/shared/main.yaml`].find(name=>Object.hasOwn(manifest.files,name))||Object.keys(manifest.files).find(name=>name.startsWith(`${prefix}/`)&&name.endsWith('/main.yaml'))||Object.keys(manifest.files)[0];
}

// The host invokes CompileWindowSource (the original server-side loader), and
// persists sourceManifest beside definition. No browser file/resource fetching
// or embedded script substitute is introduced here.
export default function NamedWindowSourceEditor({sourceManifest,compileSourceManifest,onSourceManifestChange,onChange,onStateChange,readOnly=false,title='Window source'}) {
  const [draft,setDraft]=useState(sourceManifest);
  const [selected,setSelected]=useState(()=>windowFile(sourceManifest));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [newFile,setNewFile]=useState('');
  const latest=useRef(sourceManifest); latest.current=sourceManifest;
  const callback=useRef(onStateChange);callback.current=onStateChange;
  const pending=JSON.stringify(draft)!==JSON.stringify(sourceManifest);
  useEffect(()=>{setDraft(sourceManifest);setSelected(previous=>Object.hasOwn(sourceManifest.files,previous)?previous:windowFile(sourceManifest));setError('');},[sourceManifest]);
  useEffect(()=>{callback.current?.({validSource:!error,pendingEdits:pending?1:0,readOnly,canCommit:!readOnly&&!pending&&!busy&&!error,canonicalStatus:busy?'loading':error?'error':'ready',errors:error?[error]:[]});},[pending,busy,error,readOnly]);
  const apply=async()=>{
    if(readOnly||busy||!pending)return;
    const base=sourceManifest;setBusy(true);setError('');
    try {
      if(typeof compileSourceManifest!=='function')throw new Error('This host must supply the native named-source compiler.');
      const compiled=await compileSourceManifest(draft);
      if(latest.current!==base)throw new Error('Source changed during compilation. Discard this draft and reload.');
      const definition=typeof compiled.definition==='string'?compiled.definition:JSON.stringify(compiled.definition);
      const parsed=readDocument(definition);
      if(parsed.errors.length)throw new Error('Compiler did not return a complete window definition.');
      // Source text is not reconstructed from runtime metadata. Preserve the
      // original named files exactly and emit a full compiled definition.
      onSourceManifestChange?.(draft);
      onChange?.(parsed.document.toString({lineWidth:0}));
      setDraft(draft);
    } catch(error) {setError(error?.message||'Source compilation failed.');}
    finally {setBusy(false);}
  };
  const addFile=()=>{
    if(readOnly||busy)return;
    const name=newFile.trim();
    if(!name.startsWith('extension/forge/')||name.includes('\\')||name.split('/').some(part=>!part||part==='.'||part==='..')||!/\.(yaml|yml|js|css)$/.test(name)){
      setError('Enter a relative YAML, JavaScript or CSS path under extension/forge/.');return;
    }
    if(Object.hasOwn(draft.files,name)){setError('That source file already exists. Select it to edit.');return;}
    setDraft(previous=>({...previous,files:{...previous.files,[name]:''}}));
    setSelected(name);setNewFile('');setError('');
  };
  return <section className="fwe-source" aria-label="Named window source">
    <h2>{title}</h2>
    <label>Source file <select aria-label="Source file" value={selected} disabled={busy} onChange={event=>setSelected(event.target.value)}>{Object.keys(draft.files).sort().map(name=><option key={name} value={name}>{name}</option>)}</select></label>
    {!readOnly&&<div className="fwe-authoring-actions"><label>New source file <input aria-label="New source file" value={newFile} disabled={busy} placeholder="extension/forge/datasources/customers.yaml" onChange={event=>setNewFile(event.target.value)}/></label><button disabled={busy||!newFile.trim()} onClick={addFile}>Add source file</button></div>}
    <CodeMirror value={draft.files[selected]||''} readOnly={readOnly||busy} editable={!readOnly&&!busy} height="100%" extensions={[...(selected?.endsWith('.yaml')?[yaml()]:[]),EditorView.lineWrapping,EditorView.contentAttributes.of({'aria-label':'Named source file'})]} onChange={text=>{if(readOnly||busy)return;setError('');setDraft(previous=>({...previous,files:{...previous.files,[selected]:text}}));}}/>
    <div className="fwe-authoring-actions"><button disabled={readOnly||busy||!pending} onClick={apply}>{busy?'Compiling source…':'Apply source changes'}</button><button disabled={busy||!pending} onClick={()=>{setDraft(sourceManifest);setSelected(previous=>Object.hasOwn(sourceManifest.files,previous)?previous:windowFile(sourceManifest));setNewFile('');setError('');}}>Discard source draft</button></div>
    {error&&<p role="alert">{error}</p>}
    <p>Named YAML and JavaScript files are compiled by the original workspace loader. Imports and script references remain in their source files.</p>
  </section>;
}
