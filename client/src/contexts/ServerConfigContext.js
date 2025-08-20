import React, { createContext, useContext } from 'react';

const ServerConfigContext = createContext();

export const useServerConfig = () => {
  const context = useContext(ServerConfigContext);
  if (!context) {
    throw new Error('useServerConfig must be used within a ServerConfigProvider');
  }
  return context;
};

export default ServerConfigContext;