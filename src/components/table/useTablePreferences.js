import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {browserTablePreferences,createBrowserTablePreferences,createTablePreferenceSession} from '../../core/preferences/tablePreferences.js';

export function useTablePreferences({services = {},config = {},key}) {
    const adapter=useMemo(()=>{
        if(services.tablePreferences) return services.tablePreferences;
        if(config.adapter && config.adapter!=='browser') {
            const unavailable=async()=>{throw new Error('Configured table preference provider is unavailable');};
            return {get:unavailable,set:unavailable,reset:unavailable};
        }
        return config.namespace ? createBrowserTablePreferences({namespace:config.namespace}) : browserTablePreferences;
    },[services.tablePreferences,config.adapter,config.namespace]);
    const [state,setState]=useState({preferences:null,loading:false,error:null});
    const session=useRef(null);
    useEffect(()=>{
        setState({preferences:null,loading:true,error:null});
        const current=createTablePreferenceSession(adapter,key,setState);
        session.current=current;current.load();
        return ()=>{current.dispose();if(session.current===current)session.current=null;};
    },[adapter,key]);
    return {...state,save:useCallback(value=>session.current?.save(value),[]),reset:useCallback(()=>session.current?.reset(),[]),reload:useCallback(()=>session.current?.load(),[])};
}
