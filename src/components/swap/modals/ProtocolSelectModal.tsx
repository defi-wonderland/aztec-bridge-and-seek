import React from 'react';
import { Modal } from '../../Modal';
import { ModalOption } from '../../ModalOption';

export type ProtocolSelectModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const ProtocolSelectModal: React.FC<ProtocolSelectModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      title="Select protocol"
      description="Select the protocol you want to use."
      onClose={onClose}
    >
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <ModalOption label="Uniswap" selected />
      </div>
    </Modal>
  );
};
