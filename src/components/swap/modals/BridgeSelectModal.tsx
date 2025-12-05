import React from 'react';
import { Modal } from '../../Modal';
import { ModalOption } from '../../ModalOption';

export type BridgeSelectModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const BridgeSelectModal: React.FC<BridgeSelectModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      title="Select bridge"
      description="Select the bridge you want to use."
      onClose={onClose}
    >
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <ModalOption label="Substance" selected />
      </div>
    </Modal>
  );
};
