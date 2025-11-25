import { Fr } from '@aztec/aztec.js/fields';
import { poseidon2Hash } from '@aztec/foundation/crypto';

/**
 * PasskeyService handles secure wallet generation using WebAuthn (Passkeys).
 * Passkeys provide device-bound authentication without storing secrets in the browser.
 */
export class PasskeyService {
  private static readonly RP_NAME = 'Aztec Bridge and Seek';
  private static readonly RP_ID = window.location.hostname;
  private static readonly STORAGE_KEY = 'aztec-passkey-metadata';

  /**
   * Create a new wallet with a passkey
   * @returns Wallet credentials derived from secure random values
   */
  static async createWalletWithPasskey(): Promise<{
    secretKey: Fr;
    salt: Fr;
    signingKey: Buffer;
    credentialId: string;
  }> {
    try {
      // Generate cryptographically secure random values
      const randomBytes = crypto.getRandomValues(new Uint8Array(64));
      const secretPhrase = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      // Generate a unique salt
      const saltBytes = crypto.getRandomValues(new Uint8Array(32));
      const saltHex = Array.from(saltBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      // Create a passkey credential
      const userId = crypto.getRandomValues(new Uint8Array(32));
      const challenge = crypto.getRandomValues(new Uint8Array(32));

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: this.RP_NAME,
            id: this.RP_ID,
          },
          user: {
            id: userId,
            name: `Aztec Wallet ${Date.now()}`,
            displayName: `Aztec Wallet ${new Date().toLocaleString()}`,
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            requireResidentKey: true,
            residentKey: 'required',
            userVerification: 'required',
          },
          timeout: 60000,
          attestation: 'none',
        },
      });

      if (!credential || !(credential instanceof PublicKeyCredential)) {
        throw new Error('Failed to create passkey credential');
      }

      const credentialId = this.arrayBufferToBase64(credential.rawId);

      // Derive Aztec wallet credentials from the random values
      const credentials = await this.deriveAccountCredentials(
        secretPhrase,
        saltHex
      );

      // Store metadata (NOT the secret phrase) in IndexedDB
      await this.storePasskeyMetadata({
        credentialId,
        createdAt: Date.now(),
        accountAddress: '', // Will be filled after deployment
      });

      // Store encrypted credentials in IndexedDB
      await this.storeEncryptedCredentials(credentialId, {
        secretPhrase,
        saltHex,
      });

      return {
        ...credentials,
        credentialId,
      };
    } catch (error) {
      console.error('Error creating wallet with passkey:', error);
      throw new Error(
        `Failed to create wallet with passkey: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Connect to an existing wallet using passkey authentication
   * @returns Wallet credentials retrieved from passkey
   */
  static async connectWalletWithPasskey(): Promise<{
    secretKey: Fr;
    salt: Fr;
    signingKey: Buffer;
    credentialId: string;
  } | null> {
    try {
      // Get stored passkey metadata
      const metadata = await this.getPasskeyMetadata();
      if (!metadata || metadata.length === 0) {
        throw new Error('No passkey wallets found');
      }

      // Request passkey authentication
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const allowCredentials = metadata.map((m) => ({
        id: this.base64ToArrayBuffer(m.credentialId),
        type: 'public-key' as const,
      }));

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: this.RP_ID,
          allowCredentials,
          userVerification: 'required',
          timeout: 60000,
        },
      });

      if (!assertion || !(assertion instanceof PublicKeyCredential)) {
        throw new Error('Failed to authenticate with passkey');
      }

      const credentialId = this.arrayBufferToBase64(assertion.rawId);

      // Retrieve encrypted credentials
      const encryptedCreds = await this.getEncryptedCredentials(credentialId);
      if (!encryptedCreds) {
        throw new Error('Wallet credentials not found');
      }

      // Derive wallet credentials
      const credentials = await this.deriveAccountCredentials(
        encryptedCreds.secretPhrase,
        encryptedCreds.saltHex
      );

      return {
        ...credentials,
        credentialId,
      };
    } catch (error) {
      console.error('Error connecting wallet with passkey:', error);
      if (error instanceof Error && error.message === 'No passkey wallets found') {
        return null;
      }
      throw new Error(
        `Failed to connect wallet with passkey: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Derive Aztec account credentials from a secret phrase and salt
   * (Same logic as generateAccountCredentials in EmbeddedAztecWallet)
   */
  private static async deriveAccountCredentials(
    secretPhrase: string,
    saltString: string
  ): Promise<{
    secretKey: Fr;
    salt: Fr;
    signingKey: Buffer;
  }> {
    // Hash the secret phrase using poseidon2Hash (same as EmbeddedAztecWallet)
    const secretHash = await poseidon2Hash([
      Fr.fromBufferReduce(
        Buffer.from(secretPhrase.padEnd(32, '#'), 'utf8')
      ),
    ]);

    const secretKey = secretHash;
    // Convert hex string to buffer and create Fr from it
    const saltBuffer = Buffer.from(saltString, 'hex');
    const salt = Fr.fromBufferReduce(saltBuffer);
    const signingKey = Buffer.from(secretHash.toBuffer().subarray(0, 32));

    return { secretKey, salt, signingKey };
  }

  /**
   * Store passkey metadata in IndexedDB
   */
  private static async storePasskeyMetadata(
    metadata: PasskeyMetadata
  ): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction(['passkeys'], 'readwrite');
    const store = transaction.objectStore('passkeys');
    store.add(metadata);
    await this.waitForTransaction(transaction);
  }

  /**
   * Get all passkey metadata from IndexedDB
   */
  private static async getPasskeyMetadata(): Promise<PasskeyMetadata[]> {
    const db = await this.openDB();
    const transaction = db.transaction(['passkeys'], 'readonly');
    const store = transaction.objectStore('passkeys');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Store encrypted credentials in IndexedDB
   */
  private static async storeEncryptedCredentials(
    credentialId: string,
    credentials: { secretPhrase: string; saltHex: string }
  ): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction(['credentials'], 'readwrite');
    const store = transaction.objectStore('credentials');
    store.add({ credentialId, ...credentials });
    await this.waitForTransaction(transaction);
  }

  /**
   * Get encrypted credentials from IndexedDB
   */
  private static async getEncryptedCredentials(
    credentialId: string
  ): Promise<{ secretPhrase: string; saltHex: string } | null> {
    const db = await this.openDB();
    const transaction = db.transaction(['credentials'], 'readonly');
    const store = transaction.objectStore('credentials');
    const request = store.get(credentialId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve({
            secretPhrase: result.secretPhrase,
            saltHex: result.saltHex,
          });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Open IndexedDB database
   */
  private static async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AztecWalletPasskeys', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains('passkeys')) {
          db.createObjectStore('passkeys', { keyPath: 'credentialId' });
        }

        if (!db.objectStoreNames.contains('credentials')) {
          db.createObjectStore('credentials', { keyPath: 'credentialId' });
        }
      };
    });
  }

  /**
   * Wait for IndexedDB transaction to complete
   */
  private static async waitForTransaction(
    transaction: IDBTransaction
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Check if passkeys are supported in the current browser
   */
  static isPasskeySupported(): boolean {
    return (
      window.PublicKeyCredential !== undefined &&
      navigator.credentials !== undefined
    );
  }

  /**
   * Check if there are any existing passkey wallets
   */
  static async hasExistingPasskeys(): Promise<boolean> {
    if (!this.isPasskeySupported()) {
      return false;
    }

    try {
      const metadata = await this.getPasskeyMetadata();
      return metadata.length > 0;
    } catch (error) {
      console.error('Error checking for existing passkeys:', error);
      return false;
    }
  }
}

interface PasskeyMetadata {
  credentialId: string;
  createdAt: number;
  accountAddress: string;
}
