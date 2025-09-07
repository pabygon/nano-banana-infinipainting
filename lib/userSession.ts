import { NextRequest } from 'next/server';

export function getUserId(req: NextRequest): string {
  // Use only client-provided ID for privacy compliance
  const clientId = req.headers.get('x-client-id');
  
  if (clientId) {
    return clientId;
  }
  
  // If no client ID, return a session-only identifier
  // This means concurrent edit protection only works for users with JS enabled
  return `anonymous-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function generateClientId(): string {
  // Generate a random client ID (for use in frontend)
  return `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateClientId(): string {
  // For use in frontend - stores in localStorage
  if (typeof window === 'undefined') {
    return generateClientId();
  }
  
  let clientId = localStorage.getItem('tile-edit-client-id');
  if (!clientId) {
    clientId = generateClientId();
    localStorage.setItem('tile-edit-client-id', clientId);
  }
  
  return clientId;
}
