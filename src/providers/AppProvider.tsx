import React, { ReactNode } from 'react';
import { ConfigProvider } from './ConfigProvider';
import { ErrorProvider } from './ErrorProvider';
import { AztecWalletProvider } from './AztecWalletProvider';
import { EVMWalletProvider } from './EVMWalletProvider';
import { TokenProvider } from './TokenProvider';

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <EVMWalletProvider>
      <ConfigProvider>
        <ErrorProvider>
          <AztecWalletProvider>
            <TokenProvider>
              {children}
            </TokenProvider>
          </AztecWalletProvider>
        </ErrorProvider>
      </ConfigProvider>
    </EVMWalletProvider>
  );
};
