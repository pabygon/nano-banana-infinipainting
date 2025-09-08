// Browser-side key encryption for securing API keys in memory

class BrowserCrypto {
  private sessionKey: CryptoKey | null = null;
  private isInitialized = false;

  // Get the Web Crypto API (works in browser)
  private get crypto() {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      return window.crypto;
    }
    throw new Error('Web Crypto API not available');
  }

  // Generate a session key when app loads
  async generateSessionKey(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      this.sessionKey = await this.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false, // not extractable - key cannot be exported
        ['encrypt', 'decrypt']
      );
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to generate session key:', error);
      throw error;
    }
  }

  // Encrypt API key for storage
  async encryptApiKey(apiKey: string): Promise<string> {
    if (!this.sessionKey) await this.generateSessionKey();
    
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(apiKey);
      const iv = this.crypto.getRandomValues(new Uint8Array(12));
      
      const encrypted = await this.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.sessionKey!,
        data
      );
      
      // Combine IV + encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Failed to encrypt API key:', error);
      throw error;
    }
  }

  // Decrypt API key for use
  async decryptApiKey(encryptedKey: string): Promise<string> {
    if (!this.sessionKey) {
      console.error('🔐 Session key not available for decryption!');
      console.log('🔐 Crypto state:', { 
        isInitialized: this.isInitialized, 
        hasSessionKey: !!this.sessionKey 
      });
      throw new Error('Session key not initialized. Cannot decrypt API key.');
    }
    
    try {
      const combined = new Uint8Array(
        atob(encryptedKey).split('').map(c => c.charCodeAt(0))
      );
      
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);
      
      const decrypted = await this.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.sessionKey,
        encrypted
      );
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Failed to decrypt API key:', error);
      throw error;
    }
  }

  // Clear the session key (for security)
  clearSessionKey(): void {
    this.sessionKey = null;
    this.isInitialized = false;
    console.log('🔐 Session encryption key cleared');
  }

  // Check if crypto is available
  isAvailable(): boolean {
    try {
      return typeof window !== 'undefined' && 
             window.crypto && 
             window.crypto.subtle && 
             typeof window.crypto.subtle.generateKey === 'function';
    } catch {
      return false;
    }
  }
}

export const browserCrypto = new BrowserCrypto();
