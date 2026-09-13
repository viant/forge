import Foundation

public struct UIActionProjectionResult: Sendable, Equatable {
    public let effects: [JSONValue]
    public let result: JSONValue?
}

/// Snapshot-only metadata UI execution. JavaScript can describe effects but has no host or network access.
public enum UIActionProjection {
    public static func invoke(code: String, function: String, namespace: String?, source: String,
                              snapshots: [String: JSONValue], windowForm: [String: JSONValue],
                              props: [String: JSONValue]) throws -> UIActionProjectionResult {
        var name = function
        if let namespace, name.hasPrefix(namespace + ".") { name.removeFirst(namespace.count + 1) }
        let wrapper = #"""
        (() => {
          const timers=[];
          const setTimeout=(fn,delay=0)=>{if(delay!==0)throw new Error('Delayed UI action timers are unsupported');timers.push(fn);return timers.length;};
          let activeEffects=null;
          const window={open:href=>{if(activeEffects)activeEffects.push({kind:'openURL',ref:null,value:{href}});return true;}};
          const module=(
        """# + code + #"""
          );
          return {run:({name,source,snapshots,windowForm,props})=>{
            const effects=[],contexts={};activeEffects=effects;
            const signal=(state,key,kind,ref)=>{const holder={peek:()=>state[key]};Object.defineProperty(holder,'value',{get:()=>state[key],set:value=>{state[key]=value;effects.push({kind,ref,value});}});return holder;};
            const windowState={value:windowForm},windowFormSignal=signal(windowState,'value','windowForm',null);
            const contextFor=ref=>{
              if(!Object.prototype.hasOwnProperty.call(snapshots,ref))return undefined;
              if(contexts[ref])return contexts[ref];
              const state=snapshots[ref];
              const ctx={identity:{dataSourceRef:ref},Context:contextFor,signals:{
                form:signal(state,'form','form',ref),collection:{peek:()=>state.collection||[],get value(){return state.collection||[];}},
                selection:{peek:()=>state.selection||{},get value(){return state.selection||{};}},input:{peek:()=>state.input||{},get value(){return state.input||{};}},
                metrics:{peek:()=>state.metrics||{},get value(){return state.metrics||{};}},windowForm:windowFormSignal
              },handlers:{dataSource:{
                getFormData:()=>state.form||{},getCollection:()=>state.collection||[],peekFullCollection:()=>state.collection||[],getCollectionInfo:()=>state.metrics||{},
                getSelection:()=>state.selection||{},peekSelection:()=>state.selection||{},peekInput:()=>state.input||{},getInputParameters:()=>state.input?.parameters||{},peekFilter:()=>state.input?.filter||{},peekWindowFormData:()=>windowFormSignal.peek(),
                setFormData:payload=>{const value=payload&&payload.values!==undefined?payload.values:payload;state.form=value||{};effects.push({kind:'form',ref,value:state.form});return true;},
                setEditedFormData:payload=>{const value=payload&&payload.values!==undefined?payload.values:payload;state.form=value||{};effects.push({kind:'form',ref,value:state.form});return true;},
                setCollection:payload=>{const value=Array.isArray(payload)?payload:(payload?.rows||[]);state.collection=value;effects.push({kind:'collection',ref,value});return true;},
                replaceCollection:payload=>{const value=Array.isArray(payload)?payload:(payload?.rows||[]);state.collection=value;effects.push({kind:'collection',ref,value});return true;},
                setSelected:payload=>{const value=payload||{};state.selection=value;effects.push({kind:'selection',ref,value});return true;},
                clearSelection:()=>{effects.push({kind:'resetSelection',ref,value:{}});return true;},
                setWindowFormField:payload=>{const field=payload?.item?.dataField||payload?.item?.field||payload?.field;if(!field)return false;windowState.value={...windowState.value,[field]:payload?.value};effects.push({kind:'windowFormPatch',ref:null,value:{[field]:payload?.value}});return true;},
                setInputParameters:value=>{state.input=value||{};effects.push({kind:'input',ref,value:state.input});return true;},setFilter:value=>{effects.push({kind:'filter',ref,value:value||{}});return true;},
                fetchCollection:options=>{effects.push({kind:'fetch',ref,value:options||{}});return true;},resetSelection:()=>{effects.push({kind:'resetSelection',ref,value:{}});return true;}
              },window:{openDialog:value=>{effects.push({kind:'openDialog',ref:null,value:value||{}});return true;},closeDialog:value=>{effects.push({kind:'closeDialog',ref:null,value:value||{}});return true;},openWindow:value=>{effects.push({kind:'openWindow',ref:null,value:value||{}});return true;},openTarget:value=>{effects.push({kind:'openTarget',ref:null,value:value||{}});return true;}}}};
              contexts[ref]=ctx;return ctx;
            };
            const fn=module[name];if(typeof fn!=='function')throw new Error('Missing UI action: '+name);
            const result=fn({...props,context:contextFor(source)});if(result&&typeof result.then==='function')throw new Error('Async UI actions are unsupported');
            let count=0;while(timers.length){if(++count>100)throw new Error('UI action timer limit exceeded');timers.shift()();}
            return {effects,result:result===undefined?null:result};
          }};
        })()
        """#
        let envelope = try ActionHookRuntime.invoke(code: wrapper, functionName: "run", props: .object([
            "name": .string(name), "source": .string(source), "snapshots": .object(snapshots),
            "windowForm": .object(windowForm), "props": .object(props)
        ]))?.objectValue ?? [:]
        return UIActionProjectionResult(
            effects: envelope["effects"]?.arrayValue ?? [],
            result: envelope["result"] == .null ? nil : envelope["result"]
        )
    }
}
