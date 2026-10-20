import {resolveSelector,setSelector} from '../../utils/selector.js';

// Bind a reusable semantic API to authored datasource references and DTO paths.
// Bindings contain every provider method/argument shape; the renderer has no URL,
// token or transport fallback and cannot invoke an undeclared operation.
export function createWorkbenchAPI(context,spec,{onPendingChange=()=>{}}={}) {
 let pending=0;
 const execute=async(binding,args)=>{
  if(!binding?.dataSourceRef)throw new Error('Workbench operation is not configured.');
  let parameters=binding.spreadArg!==undefined?{...(args[binding.spreadArg]||{})}:{};
  for(const [path,source] of Object.entries(binding.parameters||{})){
   let value=source.value!==undefined?source.value:source.arg!==undefined?args[source.arg]:undefined;
   if(source.selector&&value!==undefined)value=resolveSelector(value,source.selector);
   if(value===undefined&&Object.hasOwn(source,'default'))value=source.default;
   if(value!==undefined)parameters=setSelector(parameters,path,value);
  }
  if(binding.mutation){pending++;onPendingChange(pending);}
  try{
   const result=await context.Context(binding.dataSourceRef).handlers.dataSource.fetchRecords({parameters});
   const payload=result?.rows?.[0]??result;
   const selected=binding.responseSelector?resolveSelector(payload,binding.responseSelector):payload;
   return selected===undefined&&Object.hasOwn(binding,'responseDefault')?binding.responseDefault:selected;
  }finally{if(binding.mutation){pending--;onPendingChange(pending);}}
 };
 const api=Object.fromEntries(Object.entries(spec.operations||{}).map(([name,binding])=>[name,(...args)=>execute(binding,args)]));
 api.readLookup=(name,input)=>{const binding=spec.lookups?.[name];if(!binding)throw new Error('Workbench lookup is not configured.');return execute({...binding,spreadArg:0},[input]);};
 api.resourceNamespace=spec.resourceNamespace;
 api.windowServices=context.services;
 return api;
}
