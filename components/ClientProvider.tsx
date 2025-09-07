"use client";

import { createContext, useContext, useEffect, useState } from 'react';

const ClientContext = createContext<{
  clientId: string;
  setClientId: (id: string) => void;
}>({
  clientId: '',
  setClientId: () => {}
});

export function ClientProvider({ children }: { children: React.ReactNode }) {
  const [clientId, setClientId] = useState<string>('');

  useEffect(() => {
    // Generate or retrieve client ID with better uniqueness
    let id = localStorage.getItem('tile-edit-client-id');
    if (!id) {
      // More unique ID: timestamp + crypto random + counter
      const timestamp = Date.now();
      const random1 = Math.random().toString(36).slice(2);
      const random2 = Math.random().toString(36).slice(2);
      const counter = Math.floor(Math.random() * 10000);
      id = `client-${timestamp}-${random1}-${random2}-${counter}`;
      localStorage.setItem('tile-edit-client-id', id);
    }
    setClientId(id);
  }, []);

  return (
    <ClientContext.Provider value={{ clientId, setClientId }}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClient() {
  const context = useContext(ClientContext);
  if (!context) {
    throw new Error('useClient must be used within ClientProvider');
  }
  return context;
}
