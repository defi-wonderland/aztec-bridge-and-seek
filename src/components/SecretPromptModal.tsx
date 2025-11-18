import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAztecWallet } from '../hooks';
import { AztecStorageService } from '../services/aztec/core';

const hashSecret = async (secret: string): Promise<string> => {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Secure hashing is not available in this environment.');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const SecretPromptModal: React.FC = () => {
  const {
    createAccount,
    connectedAccount,
    isInitialized,
    disconnectWallet,
  } = useAztecWallet();

  const [secretInput, setSecretInput] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [hasSecretHash, setHasSecretHash] = useState(false);
  const [hasAccountData, setHasAccountData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStoringSecret, setIsStoringSecret] = useState(false);
  const [isAutoCreating, setIsAutoCreating] = useState(false);
  const [shouldAutoCreate, setShouldAutoCreate] = useState(false);

  const autoCreateRef = useRef(false);

  const syncFromStorage = useCallback(() => {
    if (typeof window === 'undefined') {
      return { hasHash: false, hasAccount: false };
    }

    const storageService = new AztecStorageService();
    const hasHash = Boolean(storageService.getAccountSecretHash());
    const hasAccount = Boolean(storageService.getAccount());

    setHasSecretHash(hasHash);
    setHasAccountData(hasAccount);
    setShowModal(!hasHash);

    return { hasHash, hasAccount };
  }, []);

  useEffect(() => {
    const { hasHash, hasAccount } = syncFromStorage();
    if (hasHash && !hasAccount) {
      setShouldAutoCreate(true);
    }
  }, [syncFromStorage]);

  useEffect(() => {
    if (!shouldAutoCreate || autoCreateRef.current) {
      return;
    }

    if (connectedAccount) {
      disconnectWallet();
      return;
    }

    if (!isInitialized) {
      return;
    }

    autoCreateRef.current = true;
    setIsAutoCreating(true);
    setError(null);

    createAccount()
      .catch((err) => {
        console.error('Failed to auto-create deterministic account', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to create deterministic account.'
        );
      })
      .finally(() => {
        autoCreateRef.current = false;
        setIsAutoCreating(false);
        const { hasAccount } = syncFromStorage();
        setShouldAutoCreate(false);
        setHasAccountData(hasAccount);
      });
  }, [
    connectedAccount,
    createAccount,
    disconnectWallet,
    isInitialized,
    shouldAutoCreate,
    syncFromStorage,
  ]);

  useEffect(() => {
    if (connectedAccount && hasSecretHash) {
      setShowModal(false);
      setIsAutoCreating(false);
      setShouldAutoCreate(false);
      setError(null);
      setHasAccountData(true);
    }
  }, [connectedAccount, hasSecretHash]);

  const handleSecretSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isStoringSecret || isAutoCreating) {
      return;
    }

    const normalizedSecret = secretInput.trim();
    if (!normalizedSecret) {
      setError('Secret is required to derive your account.');
      return;
    }

    try {
      setIsStoringSecret(true);
      setError(null);
      const hashedSecret = await hashSecret(normalizedSecret);
      const storageService = new AztecStorageService();
      storageService.saveAccountSecretHash(hashedSecret);
      storageService.clearAccount();
      setHasAccountData(false);
      if (connectedAccount) {
        disconnectWallet();
      }
      setSecretInput('');

      const { hasAccount } = syncFromStorage();
      if (!hasAccount) {
        setShouldAutoCreate(true);
      }
    } catch (err) {
      console.error('Failed to store secret hash', err);
      setError(
        err instanceof Error ? err.message : 'Unable to store your secret.'
      );
    } finally {
      setIsStoringSecret(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setShouldAutoCreate(true);
  };

  const shouldShowLoading = isStoringSecret || isAutoCreating;
  const shouldRenderOverlay =
    showModal ||
    shouldShowLoading ||
    (!!error && !connectedAccount && hasSecretHash && !hasAccountData);

  const loadingMessage = useMemo(() => {
    if (isStoringSecret) {
      return 'Securing your secret...';
    }
    if (isAutoCreating) {
      return 'Generating your deterministic Aztec account...';
    }
    return '';
  }, [isAutoCreating, isStoringSecret]);

  if (typeof window === 'undefined' || !shouldRenderOverlay) {
    return null;
  }

  return (
    <div className="secret-modal-overlay" role="dialog" aria-modal="true">
      <div className="secret-modal-card">
        {showModal ? (
          <>
            <h2>Secure Your Aztec Account</h2>
            <p className="secret-modal-description">
              Provide a secret phrase to deterministically derive your Aztec
              account. We only store a hash of your secret locally.
            </p>
            <form onSubmit={handleSecretSubmit} className="secret-modal-form">
              <label htmlFor="secret-phrase">Secret phrase</label>
              <input
                id="secret-phrase"
                type="password"
                autoComplete="new-password"
                value={secretInput}
                onChange={(event) => setSecretInput(event.target.value)}
                placeholder="Enter a strong secret"
                disabled={isStoringSecret}
              />
              {error && <p className="secret-modal-error">{error}</p>}
              <button
                type="submit"
                className="secret-modal-submit"
                disabled={isStoringSecret}
              >
                Save secret &amp; create account
              </button>
            </form>
          </>
        ) : (
          <div className="secret-modal-loading">
            <div className="secret-modal-spinner" aria-hidden="true" />
            <p>{loadingMessage || 'Finalizing account setup...'}</p>
            {error && (
              <>
                <p className="secret-modal-error">{error}</p>
                <button
                  type="button"
                  className="secret-modal-submit"
                  onClick={handleRetry}
                >
                  Try again
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

