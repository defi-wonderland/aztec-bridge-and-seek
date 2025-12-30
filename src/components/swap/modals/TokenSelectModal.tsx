import React from 'react';
import { Modal } from '../../Modal';
import { ModalOption } from '../../ModalOption';

export type Token = 'WETH' | 'USDC';

export type TokenSelectModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: Token) => void;
  selectedToken: Token | null;
  disabledToken?: Token;
};

export const TokenSelectModal: React.FC<TokenSelectModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  selectedToken,
  disabledToken,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      title="Select token"
      description="Select the token you want to swap."
      onClose={onClose}
    >
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <ModalOption
          label="WETH"
          description="Wrapped Ether"
          selected={selectedToken === 'WETH'}
          onClick={() => onSelect('WETH')}
          disabled={disabledToken === 'WETH'}
        />
        <ModalOption
          label="USDC"
          description="USD Coin"
          selected={selectedToken === 'USDC'}
          onClick={() => onSelect('USDC')}
          disabled={disabledToken === 'USDC'}
        />
      </div>
    </Modal>
  );
};
