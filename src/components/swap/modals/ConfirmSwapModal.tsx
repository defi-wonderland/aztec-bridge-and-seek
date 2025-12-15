import React from 'react';
import { Modal } from '../../Modal';

export type ConfirmSwapModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  amountFrom: string;
  amountTo: string;
  tokenFrom: string;
  tokenTo: string;
  minReceived: string;
  slippage: number;
  isSwapping: boolean;
};

export const ConfirmSwapModal: React.FC<ConfirmSwapModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  amountFrom,
  amountTo,
  tokenFrom,
  tokenTo,
  minReceived,
  slippage,
  isSwapping,
}) => {
  return (
    <Modal isOpen={isOpen} title="Confirm swap" onClose={onClose}>
      <div className="confirm-list">
        <div className="confirm-row">
          <span className="confirm-label">You will send</span>
          <span className="confirm-value">
            {amountFrom || '0'} {tokenFrom}
          </span>
        </div>
        <div className="confirm-row">
          <span className="confirm-label">You will receive</span>
          <span className="confirm-value">
            ~{amountTo || '0'} {tokenTo}
          </span>
        </div>
        <div className="confirm-row">
          <span className="confirm-label">Minimum received</span>
          <span className="confirm-value">
            ~{minReceived} {tokenTo}
          </span>
        </div>
        <div className="confirm-row">
          <span className="confirm-label">Slippage tolerance</span>
          <span className="confirm-value">{slippage}%</span>
        </div>
        <div className="confirm-row">
          <span className="confirm-label">Protocol</span>
          <span className="confirm-value">Uniswap</span>
        </div>
        <div className="confirm-row">
          <span className="confirm-label">Chain</span>
          <span className="confirm-value">Base Sepolia</span>
        </div>
        <div className="confirm-row">
          <span className="confirm-label">Bridge</span>
          <span className="confirm-value">Substance</span>
        </div>
      </div>
      <div className="confirm-actions">
        <button type="button" className="button-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="connect-evm-button"
          onClick={onConfirm}
          disabled={isSwapping}
        >
          Confirm
        </button>
      </div>
    </Modal>
  );
};
