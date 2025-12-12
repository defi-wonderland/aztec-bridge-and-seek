import React from 'react';
import { Modal } from '../../Modal';
import { SLIPPAGE_PRESETS } from '../constants';
import type { SlippagePreset, SlippageWarning } from '../../../hooks/swap';

export type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  slippage: number;
  slippagePreset: SlippagePreset;
  setSlippagePreset: (preset: SlippagePreset) => void;
  setCustomSlippage: (value: number) => void;
  slippageWarning: SlippageWarning;
  isCustomSlippage: boolean;
  customSlippageInput: string;
  setCustomSlippageInput: (value: string) => void;
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  slippage,
  slippagePreset,
  setSlippagePreset,
  setCustomSlippage,
  slippageWarning,
  isCustomSlippage,
  customSlippageInput,
  setCustomSlippageInput,
}) => {
  return (
    <Modal isOpen={isOpen} title="Settings" onClose={onClose}>
      <div className="slippage-settings">
        <span className="slippage-label">Slippage Tolerance</span>
        <div className="slippage-presets">
          {SLIPPAGE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`slippage-preset-button${
                slippagePreset === preset ? ' active' : ''
              }`}
              onClick={() => setSlippagePreset(preset)}
            >
              {preset}%
            </button>
          ))}
          <button
            type="button"
            className={`slippage-preset-button${isCustomSlippage ? ' active' : ''}`}
            onClick={() => setSlippagePreset('custom')}
          >
            Custom
          </button>
        </div>
        {isCustomSlippage && (
          <div className="slippage-custom-input-wrapper">
            <input
              type="number"
              className="slippage-custom-input"
              placeholder="0.5"
              value={customSlippageInput}
              onChange={(e) => {
                setCustomSlippageInput(e.target.value);
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0) {
                  setCustomSlippage(val);
                }
              }}
              min="0"
              max="100"
              step="0.1"
            />
            <span className="slippage-custom-suffix">%</span>
          </div>
        )}
        {slippageWarning.message && (
          <div
            className={`slippage-warning slippage-warning--${slippageWarning.type}`}
          >
            {slippageWarning.type === 'extreme' ? '🚨' : '⚠️'}{' '}
            {slippageWarning.message}
          </div>
        )}
        <div className="slippage-current">
          Current slippage: <strong>{slippage}%</strong>
        </div>
      </div>
    </Modal>
  );
};
