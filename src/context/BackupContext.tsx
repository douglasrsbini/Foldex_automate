import React, { createContext, useContext, useState } from 'react';

interface BackupContextData {
  executingIds: number[];
  addExecuting: (id: number) => void;
  removeExecuting: (id: number) => void;
}

const BackupContext = createContext<BackupContextData>({} as BackupContextData);

export const BackupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [executingIds, setExecutingIds] = useState<number[]>([]);

  const addExecuting = (id: number) => {
    setExecutingIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  };

  const removeExecuting = (id: number) => {
    setExecutingIds(prev => prev.filter(i => i !== id));
  };

  return (
    <BackupContext.Provider value={{ executingIds, addExecuting, removeExecuting }}>
      {children}
    </BackupContext.Provider>
  );
};

export const useBackup = () => useContext(BackupContext);