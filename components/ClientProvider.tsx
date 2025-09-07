"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { browserCrypto } from '@/lib/crypto';

export type ApiProvider = "Google" | "FAL";

interface ApiKeyState {
  apiKey: string | null; // Now stores encrypted key
  provider: ApiProvider | null;
  isEncrypted: boolean;
}

const ClientContext = createContext<{
  clientId: string;
  setClientId: (id: string) => void;
  apiKeyState: ApiKeyState;
  setApiKey: (apiKey: string, provider: ApiProvider) => Promise<void>;
  getDecryptedApiKey: () => Promise<string | null>;
  clearApiKey: () => void;
}>({
  clientId: '',
  setClientId: () => {},
  apiKeyState: { apiKey: null, provider: null, isEncrypted: false },
  setApiKey: async () => {},
  getDecryptedApiKey: async () => null,
  clearApiKey: () => {}
});

export function ClientProvider({ children }: { children: React.ReactNode }) {
  const [clientId, setClientId] = useState<string>('');
  const [apiKeyState, setApiKeyState] = useState<ApiKeyState>({ 
    apiKey: null, 
    provider: null, 
    isEncrypted: false 
  });

  useEffect(() => {
    // Initialize crypto and client ID
    const initializeApp = async () => {
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

      // Initialize crypto session
      if (browserCrypto.isAvailable()) {
        try {
          await browserCrypto.generateSessionKey();
        } catch (error) {
          console.warn('Failed to initialize encryption:', error);
        }
      }
    };

    initializeApp();
  }, []);

  const setApiKey = async (apiKey: string, provider: ApiProvider): Promise<void> => {
    try {
      if (browserCrypto.isAvailable()) {
        const encryptedKey = await browserCrypto.encryptApiKey(apiKey);
        
        // Test decryption immediately to verify it works
        const testDecryption = await browserCrypto.decryptApiKey(encryptedKey);
        if (testDecryption !== apiKey) {
          throw new Error('Encryption/decryption test failed');
        }
        
        setApiKeyState({ 
          apiKey: encryptedKey, 
          provider, 
          isEncrypted: true 
        });
        console.log('🔐 API key encrypted and stored securely (verified)');
      } else {
        // Fallback to plain storage if crypto not available
        console.warn('🔓 Web Crypto API not available, storing key in plain text');
        setApiKeyState({ 
          apiKey, 
          provider, 
          isEncrypted: false 
        });
      }
    } catch (error) {
      console.error('Failed to encrypt API key:', error);
      // Fallback to plain storage
      console.warn('🔓 Falling back to plain text storage');
      setApiKeyState({ 
        apiKey, 
        provider, 
        isEncrypted: false 
      });
    }
  };

  const getDecryptedApiKey = async (): Promise<string | null> => {
    console.log('🔐 getDecryptedApiKey called - current state:', {
      hasApiKey: !!apiKeyState.apiKey,
      isEncrypted: apiKeyState.isEncrypted,
      provider: apiKeyState.provider,
      keyLength: apiKeyState.apiKey?.length || 0
    });

    if (!apiKeyState.apiKey) {
      console.log('🔐 No API key stored in state');
      return null;
    }

    try {
      if (apiKeyState.isEncrypted && browserCrypto.isAvailable()) {
        console.log('🔐 Attempting to decrypt stored API key...');
        const decrypted = await browserCrypto.decryptApiKey(apiKeyState.apiKey);
        console.log('🔐 API key decrypted successfully, length:', decrypted?.length || 0);
        return decrypted;
      } else {
        // Return plain text key if not encrypted
        console.log('🔓 Returning plain text API key, length:', apiKeyState.apiKey.length);
        return apiKeyState.apiKey;
      }
    } catch (error) {
      console.error('🔐 Failed to decrypt API key:', error);
      console.log('🔐 Full API key state:', apiKeyState);
      console.log('🔐 Browser crypto available:', browserCrypto.isAvailable());
      
      // Clear the corrupted key
      console.log('🔐 Clearing corrupted API key...');
      setApiKeyState({ 
        apiKey: null, 
        provider: null, 
        isEncrypted: false 
      });
      
      return null;
    }
  };

  const clearApiKey = (): void => {
    setApiKeyState({ 
      apiKey: null, 
      provider: null, 
      isEncrypted: false 
    });
    // Don't clear the session key here - we want to keep it for the session
    // Only clear it when the user explicitly wants to start fresh
    console.log('🔐 API key cleared from memory');
  };

  // Optional: Function to completely clear everything including session keys
  const clearAllKeys = (): void => {
    setApiKeyState({ 
      apiKey: null, 
      provider: null, 
      isEncrypted: false 
    });
    if (browserCrypto.isAvailable()) {
      browserCrypto.clearSessionKey();
    }
    console.log('🔐 All keys and session data cleared');
  };

  return (
    <ClientContext.Provider value={{ 
      clientId, 
      setClientId, 
      apiKeyState, 
      setApiKey, 
      getDecryptedApiKey,
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
