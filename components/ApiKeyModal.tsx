"use client";

import { useState } from "react";
import { validateApiKey, sanitizeApiKey, getProviderFromKey } from "@/lib/apiKeyValidation";

export type ApiProvider = "Google" | "FAL";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string, provider: ApiProvider) => Promise<void>;
}

const ApiKeyModal = ({ isOpen, onClose, onSave }: ApiKeyModalProps) => {
  const [apiKey, setApiKey] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<ApiProvider>("Google");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    
    const cleanKey = sanitizeApiKey(apiKey);
    if (!cleanKey) {
      setValidationError("Please enter an API key");
      return;
    }

    // Validate the API key
    const validation = validateApiKey(cleanKey, selectedProvider);
    if (!validation.isValid) {
      setValidationError(validation.error!);
      return;
    }

    // Auto-detect provider if it doesn't match selection
    const detectedProvider = getProviderFromKey(cleanKey);
    if (detectedProvider && detectedProvider !== selectedProvider) {
      setSelectedProvider(detectedProvider);
      setValidationError(`This appears to be a ${detectedProvider} API key. Please select the correct provider.`);
      return;
    }

    try {
      await onSave(cleanKey, validation.provider!);
      setApiKey("");
      setValidationError(null);
      onClose();
    } catch (error) {
      setValidationError("Failed to save API key. Please try again.");
      console.error('Error saving API key:', error);
    }
  };

  // Auto-detect provider when user types
  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setApiKey(value);
    setValidationError(null);

    // Auto-detect provider from key format
    const detectedProvider = getProviderFromKey(value);
    if (detectedProvider && detectedProvider !== selectedProvider) {
      setSelectedProvider(detectedProvider);
    }
  };

  if (!isOpen) return null;

  const providerInfo = {
    Google: {
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      placeholder: "AIza********************************",
      getApiUrl: "https://aistudio.google.com/app/apikey",
      description: "Generate creative map tiles using Google's Gemini AI"
    },
    FAL: {
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      placeholder: "fal_********************************",
      getApiUrl: "https://fal.ai/dashboard/keys",
      description: "Fast and powerful AI image generation"
    }
  };

  const currentProvider = providerInfo[selectedProvider];

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
        aria-label="Close modal"
      ></div>
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl border border-gray-300">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              {currentProvider.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">API Key Required</h2>
              <p className="text-sm text-gray-600">Choose your AI provider and enter your API key</p>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-700">
              <strong>Privacy Note:</strong> Your API key is stored only in memory and will be cleared when you refresh the page.
            </p>
          </div>
        </div>

        {/* Provider Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            AI Provider
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSelectedProvider("Google")}
              className={`p-3 rounded-lg border-2 transition-colors text-left ${
                selectedProvider === "Google" 
                  ? "border-blue-600 bg-blue-50" 
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <div className="font-medium text-sm">Google Gemini</div>
              <div className="text-xs text-gray-600 mt-1">{providerInfo.Google.description}</div>
            </button>
            <button
              type="button"
              onClick={() => setSelectedProvider("FAL")}
              className={`p-3 rounded-lg border-2 transition-colors text-left ${
                selectedProvider === "FAL" 
                  ? "border-blue-600 bg-blue-50" 
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <div className="font-medium text-sm">FAL AI</div>
              <div className="text-xs text-gray-600 mt-1">{providerInfo.FAL.description}</div>
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-900 mb-2">
              {selectedProvider} API Key
            </label>
            <input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={handleApiKeyChange}
              placeholder={currentProvider.placeholder}
              className={`w-full px-4 py-2 border-2 rounded-lg bg-white text-gray-900 focus:outline-none transition-colors ${
                validationError 
                  ? 'border-red-500 focus:border-red-600' 
                  : 'border-gray-300 focus:border-blue-600'
              }`}
              autoFocus
              required
            />
            {validationError && (
              <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
                {validationError}
              </div>
            )}
          </div>
          
          <div className="text-sm text-gray-600 mb-6">
            <p>Don&apos;t have an API key?</p>
            <a 
              href={currentProvider.getApiUrl}
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-medium"
            >
              Get your {selectedProvider} API key →
            </a>
          </div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              disabled={!apiKey.trim()}
            >
              Save & Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApiKeyModal;
