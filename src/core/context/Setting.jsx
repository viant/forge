import React, {createContext, useContext, useLayoutEffect, useRef} from 'react';
import { maybeAutoStartUIBridge } from '../ui/autostart.js';
import { ensureUIBridgeClientId } from '../ui/bridge.js';


const Setting = createContext({});
const NoopAuthContext = createContext({});

export const SettingProvider = ({endpoints, connectorConfig, authContext, services={}, targetContext = {}, children}) => {

    const safeAuthContext = authContext || NoopAuthContext;
    const useAuth = () => useContext(safeAuthContext);
    const stopRef = useRef(null);

    // Allocate a stable bridge client id before the rest of the tree becomes interactive.
    ensureUIBridgeClientId(connectorConfig?.uiBridge?.clientId);

    // Opt-in UI bridge auto-connect (no-op unless URL is provided via env/settings).
    useLayoutEffect(() => {
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
