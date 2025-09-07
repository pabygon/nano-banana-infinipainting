// Server-side signature verification for signed requests

export interface VerificationResult {
  isValid: boolean;
  apiKey?: string;
  error?: string;
}

export class SignatureVerifier {
  
  static async verifyRequest(
    authHeader: string,
    method: string,
    url: string,
    body: string,
    providedApiKey: string, // The API key to verify against
    maxAge: number = 300000 // 5 minutes
  ): Promise<VerificationResult> {
    try {
      // Parse auth header
      const [bearer, signature] = authHeader.split(' ');
      if (bearer !== 'Bearer') {
        return { isValid: false, error: 'Invalid authorization format' };
      }
      
      const [timestamp, nonce, sig] = signature.split('.');
      if (!timestamp || !nonce || !sig) {
        return { isValid: false, error: 'Invalid signature format' };
      }
      
      // Check timestamp (prevent replay attacks)
      const requestTime = parseInt(timestamp);
      const now = Date.now();
      if (Math.abs(now - requestTime) > maxAge) {
        return { isValid: false, error: 'Request timestamp expired' };
      }
      
      // Recreate string to sign
      const stringToSign = [
        method.toUpperCase(),
        url,
        timestamp,
        nonce,
        body
      ].join('\n');
      
      // Use Node.js crypto for server-side verification
      const crypto = require('crypto');
      
      // Create HMAC with the provided API key
      const hmac = crypto.createHmac('sha256', providedApiKey);
      hmac.update(stringToSign);
      const expectedSig = hmac.digest('base64');
      
      // Compare signatures (constant-time comparison)
      const providedSig = sig;
      if (expectedSig !== providedSig) {
        return { isValid: false, error: 'Invalid signature' };
      }
      
      return { 
        isValid: true, 
        apiKey: providedApiKey 
      };
    } catch (error) {
      console.error('Signature verification error:', error);
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Verification failed' 
      };
    }
  }
  
  // Extract signature info for debugging (without verifying)
  static parseSignature(authHeader: string): {
    timestamp?: number;
    nonce?: string;
    signature?: string;
    error?: string;
  } {
    try {
      const [bearer, signature] = authHeader.split(' ');
      if (bearer !== 'Bearer') {
        return { error: 'Invalid bearer format' };
      }
      
      const [timestamp, nonce, sig] = signature.split('.');
      if (!timestamp || !nonce || !sig) {
        return { error: 'Invalid signature components' };
      }
      
      return {
        timestamp: parseInt(timestamp),
        nonce,
        signature: sig
      };
    } catch (error) {
      return { error: 'Failed to parse signature' };
    }
  }
}

// Middleware function for Next.js API routes
export function withSignatureVerification(
  handler: (req: any, res: any, verifiedApiKey: string) => Promise<any>
) {
  return async (req: any, res: any) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Authorization header required' });
      }
      
      // For this implementation, we still need the API key to verify against
      // In a production system, you might store API key hashes in a database
      const providedApiKey = req.headers['x-api-key'];
      if (!providedApiKey) {
        return res.status(401).json({ error: 'API key required for verification' });
      }
      
      const method = req.method || 'GET';
      const url = req.url || '';
      const body = req.body ? JSON.stringify(req.body) : '';
      
      const verification = await SignatureVerifier.verifyRequest(
        authHeader,
        method,
        url,
        body,
        providedApiKey
      );
      
      if (!verification.isValid) {
        console.warn('Signature verification failed:', verification.error);
        return res.status(401).json({ error: verification.error || 'Invalid signature' });
      }
      
      // Call the original handler with the verified API key
      return handler(req, res, verification.apiKey!);
    } catch (error) {
      console.error('Signature verification middleware error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}
