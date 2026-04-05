import React, {createContext, useContext, useEffect, useRef} from 'react';
import { maybeAutoStartUIBridge } from '../ui/autostart.js';


const Setting = createContext({});
const NoopAuthContext = createContext({});

export const SettingProvider = ({endpoints, connectorConfig, authContext, services={}, targetContext = {}, children}) => {

    const safeAuthContext = authContext || NoopAuthContext;
    const useAuth = () => useContext(safeAuthContext);
    const stopRef = useRef(null);

    // Opt-in UI bridge auto-connect (no-op unless URL is provided via env/settings).
    useEffect(() => {
        stopRef.current = maybeAutoStartUIBridge({ endpoints, connectorConfig });
        return () => {
            try { stopRef.current?.(); } catch(_) {}
            stopRef.current = null;
        };
        // Only run once on mount to avoid reconnect loops.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
     return (
        <Setting.Provider value={{endpoints, connectorConfig, useAuth, services, targetContext}}>
            {children}
        </Setting.Provider>
    );
};

export const useSetting = () => useContext(Setting);
