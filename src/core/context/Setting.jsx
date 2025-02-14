import React, {createContext, useContext} from 'react';


const Setting = createContext({});


export const SettingProvider = ({endpoints, connectorConfig, authContext, services={},  children}) => {

    const useAuth = () => useContext(authContext);

    console.log('pp', useAuth())
    return (
        <Setting.Provider value={{endpoints, connectorConfig, useAuth, services}}>
            {children}
        </Setting.Provider>
    );
};

export const useSetting = () => useContext(Setting);