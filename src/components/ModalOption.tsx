import React from 'react';

export type ModalOptionProps = {
  label: string;
  description?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

export const ModalOption: React.FC<ModalOptionProps> = ({
  label,
  description,
  selected = false,
  disabled = false,
  onClick,
}) => {
  return (
    <button
      type="button"
      className={`modal-option${selected ? ' selected' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="modal-option-content">
        <div className="modal-option-text">
          <div className="modal-option-label">{label}</div>
          {description && (
            <div className="modal-option-desc">{description}</div>
          )}
        </div>
        {selected && (
          <span className="modal-option-dot" aria-hidden>
            ●
          </span>
        )}
      </div>
    </button>
  );
};

export default ModalOption;
