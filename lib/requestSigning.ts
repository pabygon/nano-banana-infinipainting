// Request signing for secure API key usage

export interface SignedRequest {
  timestamp: string;
  nonce: string;
  signature: string;
}

export class RequestSigner {
  
  // Create a signature for the request
  static async signRequest(
    method: string,
    url: string, 
    body: string,
    apiKey: string
  ): Promise<string> {
    try {
      // Get crypto API
      const crypto = window.crypto;
      if (!crypto || !crypto.subtle) {
        throw new Error('Web Crypto API not available');
      }

      // Create signing material
      const timestamp = Date.now().toString();
      const nonce = crypto.getRandomValues(new Uint32Array(1))[0].toString();
      
      // Create string to sign (method + url + timestamp + nonce + body)
      const stringToSign = [
        method.toUpperCase(),
        url,
        timestamp,
        nonce,
        body
      ].join('\n');
      
      // Import key for HMAC
      const keyData = new TextEncoder().encode(apiKey);
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      // Sign the request
      const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(stringToSign)
      );
      
      // Convert signature to base64
      const sigArray = new Uint8Array(signature);
      const sigBase64 = btoa(String.fromCharCode(...sigArray));
      
      // Return authorization header value
      return `Bearer ${timestamp}.${nonce}.${sigBase64}`;
    } catch (error) {
      console.error('Failed to sign request:', error);
      throw error;
    }
  }

  // Verify a signature (for testing purposes)
  static async verifySignature(
    authHeader: string,
    method: string,
    url: string,
    body: string,
    apiKey: string,
    maxAge: number = 300000 // 5 minutes
  ): Promise<boolean> {
    try {
      const crypto = window.crypto;
      if (!crypto || !crypto.subtle) {
        return false;
      }

      // Parse auth header
      const [bearer, signature] = authHeader.split(' ');
      if (bearer !== 'Bearer') return false;
      
      const [timestamp, nonce, sig] = signature.split('.');
      if (!timestamp || !nonce || !sig) return false;
      
      // Check timestamp (prevent replay attacks)
      const requestTime = parseInt(timestamp);
      const now = Date.now();
      if (Math.abs(now - requestTime) > maxAge) {
        console.warn('Request timestamp too old');
        return false;
      }
      
      // Recreate string to sign
      const stringToSign = [
        method.toUpperCase(),
        url,
        timestamp,
        nonce,
        body
      ].join('\n');
      
      // Import key for verification
      const keyData = new TextEncoder().encode(apiKey);
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );
      
      // Convert signature from base64
      const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
      
      // Verify signature
      const isValid = await crypto.subtle.verify(
        'HMAC',
        key,
        sigBytes,
        new TextEncoder().encode(stringToSign)
      );
      
      return isValid;
    } catch (error) {
      console.error('Failed to verify signature:', error);
      return false;
    }
  }
}

// Helper function to create signed fetch requests
export async function signedFetch(
  url: string,
  options: RequestInit,
  apiKey: string
): Promise<Response> {
  const method = options.method || 'GET';
  const body = options.body ? options.body.toString() : '';
  
  // Create signature
  const authHeader = await RequestSigner.signRequest(method, url, body, apiKey);
  
  // Add authorization header
  const headers = {
    ...options.headers,
    'Authorization': authHeader
  };
  
  // Remove the raw API key header if it exists
  delete (headers as any)['X-API-Key'];
  
  return fetch(url, {
    ...options,
    headers
  });
}
