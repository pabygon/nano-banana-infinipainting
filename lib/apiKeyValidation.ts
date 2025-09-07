import { ApiProvider } from "@/components/ClientProvider";

export const API_KEY_PATTERNS = {
  Google: /^AIza[0-9A-Za-z_-]{35}$/,
  FAL: /^fal_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
} as const;

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  provider?: ApiProvider;
}

export function validateApiKey(key: string, expectedProvider?: ApiProvider): ValidationResult {
  // Remove whitespace
  const cleanKey = key.trim();
  
  if (!cleanKey) {
    return { isValid: false, error: 'API key cannot be empty' };
  }

  if (cleanKey.length < 10) {
    return { isValid: false, error: 'API key is too short' };
  }

  // Auto-detect provider if not specified
  let provider = expectedProvider;
  if (!provider) {
    if (cleanKey.startsWith('AIza')) provider = 'Google';
    else if (cleanKey.startsWith('fal_')) provider = 'FAL';
    else return { isValid: false, error: 'Unknown API key format. Keys should start with "AIza" (Google) or "fal_" (FAL)' };
  }

  // Validate format
  const pattern = API_KEY_PATTERNS[provider];
  if (!pattern.test(cleanKey)) {
    return { 
      isValid: false, 
      error: `Invalid ${provider} API key format. Please check your key and try again.` 
    };
  }

  // Additional length checks
  if (provider === 'Google' && cleanKey.length !== 39) {
    return { isValid: false, error: 'Google API key must be exactly 39 characters long' };
  }

  if (provider === 'FAL' && cleanKey.length !== 40) {
    return { isValid: false, error: 'FAL API key must be exactly 40 characters long' };
  }

  return { isValid: true, provider };
}

export function getProviderFromKey(key: string): ApiProvider | null {
  const cleanKey = key.trim();
  if (cleanKey.startsWith('AIza')) return 'Google';
  if (cleanKey.startsWith('fal_')) return 'FAL';
  return null;
}

export function sanitizeApiKey(key: string): string {
  return key.trim().replace(/\s+/g, '');
}
