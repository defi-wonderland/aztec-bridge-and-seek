import React, { ReactNode } from 'react';
import { ConfigProvider } from './ConfigProvider';
import { ErrorProvider } from './ErrorProvider';
import { AztecWalletProvider } from './AztecWalletProvider';
import { TokenProvider } from './TokenProvider';
import { ThemeProvider } from './ThemeProvider';

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <ThemeProvider>
      <ConfigProvider>
        <ErrorProvider>
          <AztecWalletProvider>
            <TokenProvider>
              {children}
            </TokenProvider>
          </AztecWalletProvider>
        </ErrorProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
};
