"use client";

import { createContext, useContext, useEffect, useState } from 'react';

export type ApiProvider = "Google" | "FAL";

interface ApiKeyState {
  apiKey: string | null;
  provider: ApiProvider | null;
}

const ClientContext = createContext<{
  clientId: string;
  setClientId: (id: string) => void;
  apiKeyState: ApiKeyState;
  setApiKey: (apiKey: string, provider: ApiProvider) => void;
  clearApiKey: () => void;
}>({
  clientId: '',
  setClientId: () => {},
  apiKeyState: { apiKey: null, provider: null },
  setApiKey: () => {},
  clearApiKey: () => {}
});

export function ClientProvider({ children }: { children: React.ReactNode }) {
  const [clientId, setClientId] = useState<string>('');
  const [apiKeyState, setApiKeyState] = useState<ApiKeyState>({ apiKey: null, provider: null });

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

  const setApiKey = (apiKey: string, provider: ApiProvider) => {
    setApiKeyState({ apiKey, provider });
  };

  const clearApiKey = () => {
    setApiKeyState({ apiKey: null, provider: null });
  };

  return (
    <ClientContext.Provider value={{ 
      clientId, 
      setClientId, 
      apiKeyState, 
      setApiKey, 
      clearApiKey 
    }}>
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
