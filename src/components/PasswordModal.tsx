import React from 'react';
import { PasswordInput } from './PasswordInput';

interface PasswordModalProps {
  isOpen: boolean;
  title: string;
  onSubmit: (password: string) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string;
  placeholder?: string;
  submitText?: string;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  title,
  onSubmit,
  onCancel,
  isLoading = false,
  error,
  placeholder = "Enter password",
  submitText = "Submit",
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button 
            className="modal-close" 
            onClick={onCancel}
            disabled={isLoading}
          >
            ×
          </button>
        </div>
        
        <div className="modal-body">
          <PasswordInput
            onSubmit={onSubmit}
            onCancel={onCancel}
            placeholder={placeholder}
            submitText={submitText}
            isLoading={isLoading}
            error={error}
            showCancel={true}
          />
        </div>
      </div>
    </div>
  );
};
