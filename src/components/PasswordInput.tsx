import React, { useState } from 'react';

interface PasswordInputProps {
  onSubmit: (password: string) => Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
  submitText?: string;
  isLoading?: boolean;
  error?: string;
  showCancel?: boolean;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  onSubmit,
  onCancel,
  placeholder = "Enter password",
  submitText = "Submit",
  isLoading = false,
  error,
  showCancel = false,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim() && !isLoading) {
      await onSubmit(password.trim());
    }
  };

  const handleCancel = () => {
    setPassword('');
    onCancel?.();
  };

  return (
    <form onSubmit={handleSubmit} className="password-input-form">
      <div className="password-input-container">
        <div className="password-field">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={placeholder}
            disabled={isLoading}
            className="password-input"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="toggle-password"
            disabled={isLoading}
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="password-actions">
          <button
            type="submit"
            disabled={!password.trim() || isLoading}
            className="submit-button"
          >
            {isLoading ? 'Loading...' : submitText}
          </button>
          {showCancel && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={isLoading}
              className="cancel-button"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </form>
  );
};
