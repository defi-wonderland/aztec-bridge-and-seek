import React, { ReactNode } from 'react';
import { ConfigProvider } from './ConfigProvider';
import { NotificationProvider } from './NotificationProvider';
import { AztecWalletProvider } from './AztecWalletProvider';
import { TokenProvider } from './TokenProvider';

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <ConfigProvider>
      <NotificationProvider>
        <AztecWalletProvider>
          <TokenProvider>
            {children}
          </TokenProvider>
        </AztecWalletProvider>
      </NotificationProvider>
    </ConfigProvider>
  );
};
