import React, { useState } from 'react';

interface SecretInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (secretPhrase: string) => void;
}

export const SecretInputModal: React.FC<SecretInputModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [secretPhrase, setSecretPhrase] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!secretPhrase.trim()) {
      setError('Secret phrase cannot be empty');
      return;
    }

    onSubmit(secretPhrase.trim());
    setSecretPhrase('');
  };

  const handleClose = () => {
    setSecretPhrase('');
    setError(null);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Enter Secret Phrase</h2>
          <button
            type="button"
            className="modal-close-button"
            onClick={handleClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <label htmlFor="secret-phrase-input" className="modal-label">
              Secret Phrase
            </label>
            <input
              id="secret-phrase-input"
              type="text"
              className="modal-input"
              value={secretPhrase}
              onChange={(e) => {
                setSecretPhrase(e.target.value);
                setError(null);
              }}
              placeholder="Enter your secret phrase"
              autoFocus
            />
            {error && <div className="modal-error">{error}</div>}
            <p className="modal-help-text">
              This secret phrase will be used to generate your Aztec account. Make sure to keep it secure.
            </p>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              Create Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
